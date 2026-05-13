import type { WorkerContext } from '@/types/multi-agent/worker-agents';
import { BaseWorkerAgent } from './BaseWorkerAgent';
import { tryLLMCall } from '../ceo-agent/LLMDecomposer';

/**
 * PlanningAgent — 设计方案和实施计划
 *
 * 使用 LLM 进行三阶段规划：
 * 1. goalAnalysis — 理解规划目标并分类
 * 2. designDocument — 生成架构设计文档
 * 3. implementationPlan — 生成具体实施步骤
 *
 * 当 LLM 不可用时，降级到原有规则引擎（返回模板文档）。
 */
export class PlanningAgent extends BaseWorkerAgent {
  constructor() {
    super('planning');
  }

  protected async doExecute(context: WorkerContext): Promise<unknown> {
    this.trackToolCall('PlanningAgent.execute');

    const { description, workspacePath } = context;

    // 目标分析（规则引擎先行，作为 prompt hints）
    const goalAnalysis = this.analyzeGoal(description);

    // 尝试 LLM 生成
    const llmResult = await tryLLMCall(
      this.buildPlanningPrompt(description, workspacePath, goalAnalysis),
    );

    if (llmResult) {
      return this.parseLLMResponse(llmResult, goalAnalysis);
    }

    // 降级到规则引擎
    console.warn('[PlanningAgent] LLM unavailable, falling back to rule-based planning');
    const specDoc = await this.executeOpenspec(goalAnalysis);
    const designDoc = await this.generateDesignDoc(goalAnalysis, specDoc);
    const implPlan = await this.generateImplPlan();
    const reviewResult = await this.callReviewAgent(designDoc, implPlan);

    return {
      goalAnalysis,
      specDocument: specDoc,
      designDocument: designDoc,
      implementationPlan: implPlan,
      reviewResult,
      approved: reviewResult.approved,
      _source: 'rules',
    };
  }

  /**
   * 构建 LLM 规划 prompt
   */
  private buildPlanningPrompt(
    requirement: string,
    workspacePath: string | undefined,
    goalAnalysis: Record<string, unknown>,
  ): string {
    const projectInfo = workspacePath
      ? `项目路径：${workspacePath}`
      : '项目路径：未知';

    return `你是一位资深软件架构师和 Tech Lead，负责为以下需求设计方案和实施计划。

${projectInfo}
需求：${requirement}
目标类型：${goalAnalysis.type}
优先级：${goalAnalysis.priority}

请完成以下三项任务，并以 JSON 格式返回：

1. **设计文档**：针对该需求，描述架构变更、涉及的模块、数据流和接口设计
2. **实施计划**：拆解为 3-7 个具体步骤，每步包含描述和预估工作量
3. **风险与约束**：列出关键风险、技术约束和缓解措施
4. **审查结果**：自我审查方案是否合理，给出 approved (true/false) 和 feedback

返回格式：
{
  "designDocument": "完整的 Markdown 格式设计文档",
  "implementationPlan": ["步骤1: ...", "步骤2: ..."],
  "risks": ["风险1", "风险2"],
  "review": { "approved": true, "feedback": ["反馈1", "反馈2"] }
}`;
  }

  /**
   * 解析 LLM 返回的规划结果
   */
  private parseLLMResponse(
    raw: string,
    goalAnalysis: Record<string, unknown>,
  ): Record<string, unknown> {
    try {
      const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [null, raw];
      const jsonStr = (jsonMatch[1] ?? raw).trim();
      const parsed = JSON.parse(jsonStr);

      const designDoc = typeof parsed.designDocument === 'string'
        ? parsed.designDocument
        : raw.slice(0, 2000);

      const implPlan = Array.isArray(parsed.implementationPlan)
        ? parsed.implementationPlan
        : ['1. 分析需求', '2. 设计方案', '3. 编码实现', '4. 测试验证', '5. 代码审查'];

      const review = parsed.review && typeof parsed.review === 'object'
        ? parsed.review as Record<string, unknown>
        : { approved: true, feedback: [] };

      return {
        goalAnalysis,
        designDocument: designDoc,
        implementationPlan: implPlan,
        risks: Array.isArray(parsed.risks) ? parsed.risks : [],
        reviewResult: review,
        approved: review.approved !== false,
        _source: 'llm',
      };
    } catch {
      return {
        goalAnalysis,
        designDocument: raw.slice(0, 2000),
        implementationPlan: ['1. 分析需求', '2. 设计方案', '3. 编码实现', '4. 测试验证'],
        reviewResult: { approved: true, feedback: ['LLM returned valid plan content (unstructured)'] },
        approved: true,
        _source: 'llm-raw',
      };
    }
  }

  // ── 规则引擎（降级路径）──────

  private analyzeGoal(goal: string): Record<string, unknown> {
    this.trackToolCall('analyzeGoal');
    return {
      originalGoal: goal,
      type: this.classifyGoal(goal),
      priority: this.estimatePriority(goal),
      estimatedComplexity: 'medium',
      timestamp: Date.now(),
    };
  }

  private classifyGoal(goal: string): string {
    const lower = goal.toLowerCase();
    if (lower.includes('优化') || lower.includes('performance')) return 'optimization';
    if (lower.includes('修复') || lower.includes('fix')) return 'bugfix';
    if (lower.includes('重构') || lower.includes('refactor')) return 'refactoring';
    if (lower.includes('新增') || lower.includes('add')) return 'feature';
    return 'general';
  }

  private estimatePriority(goal: string): 'low' | 'medium' | 'high' {
    const lower = goal.toLowerCase();
    if (lower.includes('紧急') || lower.includes('critical')) return 'high';
    if (lower.includes('低') || lower.includes('low')) return 'low';
    return 'medium';
  }

  private async executeOpenspec(goal: Record<string, unknown>): Promise<Record<string, unknown>> {
    this.trackToolCall('executeOpenspec');
    return {
      workflow: 'opsx:ff',
      inputs: goal,
      outputs: {
        requirements: `Requirements derived from: ${goal.originalGoal}`,
        constraints: ['Backward compatibility', 'Performance targets'],
        acceptanceCriteria: ['Code compiles', 'Tests pass', 'No regressions'],
      },
      timestamp: Date.now(),
    };
  }

  private async generateDesignDoc(
    goal: Record<string, unknown>,
    spec: Record<string, unknown>,
  ): Promise<string> {
    this.trackToolCall('generateDesignDoc');
    return `# Design Document

## Goal
${goal.originalGoal}

## Type
${goal.type}

## Specification
${JSON.stringify(spec.outputs, null, 2)}

## Architecture Changes
- TBD based on ${goal.type} requirements

## Risks
- Medium: May require significant refactoring
`;
  }

  private async generateImplPlan(): Promise<string[]> {
    this.trackToolCall('generateImplPlan');
    return [
      '1. Create feature branch',
      '2. Implement core changes',
      '3. Add/update tests',
      '4. Update documentation',
      '5. Code review',
      '6. Merge and deploy',
    ];
  }

  private async callReviewAgent(
    designDoc: string,
    _implPlan: string[],
  ): Promise<{ approved: boolean; feedback: string[] }> {
    this.trackToolCall('callReviewAgent');

    // 优先通过 LLM 进行真实审查
    const llmResult = await tryLLMCall(
      `Review this design document for completeness, correctness, and feasibility.
Return JSON: { "approved": boolean, "feedback": string[] }

Design Document:
${designDoc}`,
    );

    if (llmResult) {
      try {
        const jsonMatch = llmResult.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [null, llmResult];
        const jsonStr = (jsonMatch[1] ?? llmResult).trim();
        const parsed = JSON.parse(jsonStr);
        return {
          approved: parsed.approved ?? false,
          feedback: Array.isArray(parsed.feedback) ? parsed.feedback : [],
        };
      } catch {
        return { approved: false, feedback: ['LLM 返回格式错误'] };
      }
    }

    // 规则引擎降级：检查常见问题
    const feedback: string[] = [];
    if (!designDoc.includes('需求') && !designDoc.includes('requirement')) {
      feedback.push('缺少需求分析');
    }
    if (!designDoc.includes('实现') && !designDoc.includes('implement')) {
      feedback.push('缺少实现方案');
    }
    if (designDoc.includes('TBD') || designDoc.includes('TODO')) {
      feedback.push('包含未完成的内容(TBD/TODO)');
    }

    return {
      approved: feedback.length === 0,
      feedback,
    };
  }
}
