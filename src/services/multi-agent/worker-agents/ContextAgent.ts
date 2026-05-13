import * as fs from 'fs';
import * as path from 'path';
import type { WorkerContext } from '@/types/multi-agent/worker-agents';
import { BaseWorkerAgent } from './BaseWorkerAgent';
import { tryLLMCall } from '../ceo-agent/LLMDecomposer';

/**
 * ContextAgent — 分析项目上下文和技术栈
 *
 * 使用 LLM 对用户需求进行上下文分析：
 * - 识别需要检查的项目目录和文件
 * - 分析相关技术栈和依赖
 * - 生成上下文摘要供 PlanningAgent 使用
 *
 * 当 LLM 不可用（无 API key / 网络错误）时，降级到规则引擎。
 */
export class ContextAgent extends BaseWorkerAgent {
  constructor() {
    super('context');
  }

  protected async doExecute(context: WorkerContext): Promise<unknown> {
    this.trackToolCall('ContextAgent.execute');

    const { description, workspacePath } = context;

    // 规则引擎分析（用作 prompt hints + 降级结果）
    const contextNeeded = this.analyzeContextNeeds(description);

    // 始终先执行文件系统扫描，获取真实数据
    const effectivePath = workspacePath || process.cwd();
    let projectStructure = { directories: [] as string[], files: [] as string[], fileCount: 0 };
    let relevantCode: Array<{ path: string; snippet: string }> = [];

    try {
      projectStructure = this.scanProjectStructure(effectivePath);
      relevantCode = this.extractRelevantCode(projectStructure, description);
    } catch (err) {
      // 浏览器环境或无 fs 权限时优雅降级
      console.warn('[ContextAgent] File scan failed (browser/no-fs?), proceeding with LLM only');
    }

    // 尝试 LLM 分析（用真实扫描数据增强 prompt）
    const llmResult = await tryLLMCall(
      this.buildContextPrompt(description, workspacePath, contextNeeded, projectStructure),
    );

    if (llmResult) {
      // LLM 成功 → 解析结构化输出 + 附加真实扫描数据
      const parsed = this.parseLLMResponse(llmResult, description, contextNeeded);
      return {
        ...parsed,
        // 用真实扫描数据覆盖 LLM 的虚数
        projectStructure,
        relevantCode,
        filesAnalyzed: relevantCode.length,
        directoriesScanned: projectStructure.directories.length,
        totalFilesFound: projectStructure.fileCount,
      };
    }

    // 降级到规则引擎 — 使用真实文件系统扫描
    console.warn('[ContextAgent] LLM unavailable, falling back to rule-based analysis');
    const summary = this.generateSummary(description, projectStructure, relevantCode);
    return {
      description,
      contextNeeded,
      projectStructure,
      relevantCode,
      summary,
      filesAnalyzed: relevantCode.length,
      directoriesScanned: projectStructure.directories.length,
      totalFilesFound: projectStructure.fileCount,
      _source: 'rules',
    };
  }

  /**
   * 构建 LLM 上下文分析 prompt
   */
  private buildContextPrompt(
    requirement: string,
    workspacePath: string | undefined,
    hints: string[],
    projectStructure?: { directories: string[]; files: string[]; fileCount: number },
  ): string {
    const projectInfo = workspacePath
      ? `项目路径：${workspacePath}`
      : '项目路径：未知（请在 workspace 中配置）';

    const scanInfo = projectStructure && projectStructure.fileCount > 0
      ? `已扫描项目结构：${projectStructure.fileCount} 个文件，${projectStructure.directories.length} 个目录\n` +
        `根目录内容：${projectStructure.directories.slice(0, 10).join('、')}`
      : '项目未扫描（路径不存在或无可读权限）';

    return `你是一位资深软件架构师，负责分析用户需求并确定需要检查的项目上下文。

${projectInfo}
${scanInfo}
用户需求：${requirement}

规则引擎建议关注以下目录/领域：${hints.join('、')}

请分析：
1. 这个需求涉及项目的哪些模块/目录？
2. 需要了解哪些技术栈和依赖？
3. 项目的关键架构约束是什么？
4. 提供一段简洁的上下文摘要（200字以内）。

请以 JSON 格式回复，结构如下：
{
  "domains": ["需要关注的目录列表"],
  "techStack": ["相关技术栈"],
  "constraints": ["架构约束"],
  "summary": "上下文摘要（中文，200字以内）",
  "filesToCheck": ["建议检查的具体文件模式，如 src/auth/*.ts"]
}`;
  }

  /**
   * 解析 LLM 返回的结构化上下文分析
   */
  private parseLLMResponse(
    raw: string,
    description: string,
    fallbackContexts: string[],
  ): Record<string, unknown> {
    try {
      // 尝试提取 JSON（可能被 markdown 代码块包裹）
      const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [null, raw];
      const jsonStr = (jsonMatch[1] ?? raw).trim();
      const parsed = JSON.parse(jsonStr);

      const domains = Array.isArray(parsed.domains) ? parsed.domains : fallbackContexts;
      const summary = typeof parsed.summary === 'string' ? parsed.summary : raw.slice(0, 300);

      return {
        description,
        contextNeeded: domains,
        summary,
        techStack: Array.isArray(parsed.techStack) ? parsed.techStack : [],
        constraints: Array.isArray(parsed.constraints) ? parsed.constraints : [],
        filesToCheck: Array.isArray(parsed.filesToCheck) ? parsed.filesToCheck : [],
        filesAnalyzed: domains.length,
        _source: 'llm',
      };
    } catch {
      // JSON 解析失败，返回原始文本作为摘要
      return {
        description,
        contextNeeded: fallbackContexts,
        summary: raw.slice(0, 500),
        filesAnalyzed: fallbackContexts.length,
        _source: 'llm-raw',
      };
    }
  }

  // ── 规则引擎（降级路径）──────

  private analyzeContextNeeds(description: string): string[] {
    const needs: string[] = [];
    const lower = description.toLowerCase();

    if (lower.includes('component') || lower.includes('ui') || lower.includes('界面')) {
      needs.push('components');
    }
    if (lower.includes('state') || lower.includes('store') || lower.includes('状态')) {
      needs.push('stores');
    }
    if (lower.includes('api') || lower.includes('service') || lower.includes('服务')) {
      needs.push('services');
    }
    if (lower.includes('test') || lower.includes('测试')) {
      needs.push('tests');
    }
    if (lower.includes('type') || lower.includes('interface') || lower.includes('类型')) {
      needs.push('types');
    }

    if (needs.length === 0) {
      needs.push('src', 'components', 'stores', 'services', 'types');
    }

    return needs;
  }

  private scanProjectStructure(workspacePath: string): { directories: string[]; files: string[]; fileCount: number } {
    this.trackToolCall('scanProjectStructure');

    const directories: string[] = [];
    const files: string[] = [];
    const MAX_DEPTH = 3;
    const IGNORED = ['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', '.cache'];

    const walk = (dir: string, depth: number) => {
      if (depth > MAX_DEPTH) return;
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (IGNORED.includes(entry.name)) continue;
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            directories.push(fullPath);
            walk(fullPath, depth + 1);
          } else {
            files.push(fullPath);
          }
        }
      } catch {
        // Permission error or invalid path — silently skip
      }
    };

    walk(workspacePath, 0);
    return { directories, files, fileCount: files.length };
  }

  private extractRelevantCode(
    projectStructure: { files: string[] },
    description: string,
  ): Array<{ path: string; snippet: string }> {
    this.trackToolCall('extractRelevantCode');

    const keywords = description.toLowerCase().split(/\s+/);
    const relevantFiles = projectStructure.files.filter(f => {
      const lower = f.toLowerCase();
      return keywords.some(k => k.length > 2 && lower.includes(k));
    }).slice(0, 10);

    return relevantFiles.map(filePath => {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        return {
          path: filePath,
          snippet: content.slice(0, 500),
        };
      } catch {
        return { path: filePath, snippet: '(无法读取)' };
      }
    });
  }

  private generateSummary(
    task: string,
    structure: { directories: string[]; files: string[]; fileCount: number },
    code: Array<{ path: string; snippet: string }>,
  ): string {
    return `Context analysis for: ${task}\n` +
      `Directories scanned: ${structure.directories.length}\n` +
      `Total files found: ${structure.fileCount}\n` +
      `Relevant files extracted: ${code.length}`;
  }
}
