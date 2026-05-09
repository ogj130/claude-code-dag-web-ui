import type { AgentPlan, WorkerType } from '@/types/multi-agent/ceo-agent';
import { LLM_DECOMPOSE_PROMPT } from '../types';

export interface LLMDecomposerConfig {
  llmAvailable?: boolean;
  llmCall?: (prompt: string) => Promise<string>;
}

/**
 * LLMDecomposer — 混合模式需求分解器
 * LLM 在线时优先 LLM，不可用时降级到增强规则引擎
 */
export class LLMDecomposer {
  private llmAvailable: boolean;
  private llmCall?: (prompt: string) => Promise<string>;

  constructor(config: LLMDecomposerConfig = {}) {
    this.llmAvailable = config.llmAvailable ?? true;
    this.llmCall = config.llmCall;
  }

  setLLMAvailable(available: boolean): void {
    this.llmAvailable = available;
  }

  setLLMCall(fn: (prompt: string) => Promise<string>): void {
    this.llmCall = fn;
  }

  async decompose(requirement: string): Promise<AgentPlan> {
    if (this.llmAvailable && this.llmCall) {
      try {
        return await this.decomposeWithLLM(requirement);
      } catch (err) {
        console.warn('[LLMDecomposer] LLM decompose failed, falling back to rules:', err);
      }
    }
    return this.decomposeWithRules(requirement);
  }

  private async decomposeWithLLM(requirement: string): Promise<AgentPlan> {
    if (!this.llmCall) throw new Error('LLM call function not configured');
    const prompt = LLM_DECOMPOSE_PROMPT + requirement;
    const raw = await this.llmCall(prompt);
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [null, raw];
    const jsonStr = (jsonMatch[1] ?? raw).trim();
    const parsed = JSON.parse(jsonStr) as AgentPlan;
    if (!Array.isArray(parsed.agents) || parsed.agents.length === 0) {
      throw new Error('LLM returned invalid AgentPlan: no agents');
    }
    return this.validateAndNormalize(parsed);
  }

  decomposeWithRules(requirement: string): AgentPlan {
    const lower = requirement.toLowerCase();
    const agents: AgentPlan['agents'] = [];

    interface KeywordRule { keywords: string[]; type: WorkerType; weight: number; description: string }
    const rules: KeywordRule[] = [
      { keywords: ['分析', 'analyze', '了解', 'understand', '查看', '检查', 'review code',
                    '项目', 'project', '代码', 'codebase', '结构', 'structure', '依赖', 'dependency'],
        type: 'context', weight: 0, description: '分析项目上下文和技术栈' },

      { keywords: ['设计', 'design', '架构', 'architect', '方案', 'plan', '规划',
                    '接口', 'interface', 'api', '数据模型', 'data model'],
        type: 'planning', weight: 0, description: '设计实现方案和架构' },

      { keywords: ['实现', 'implement', '写', 'write', '构建', 'build', '修复', 'fix',
                    '重构', 'refactor', '优化', 'optimize', '新增', 'add', '修改', 'modify',
                    '创建', 'create', '删除', 'delete', '更新', 'update', '配置', 'config'],
        type: 'execution', weight: 0, description: '执行代码实现和修改' },

      { keywords: ['审查', 'review', '测试', 'test', '验证', 'verify',
                    '质量', 'quality', '安全', 'security', '性能', 'performance'],
        type: 'review', weight: 0, description: '审查代码质量和正确性' },
    ];

    for (const rule of rules) {
      let hits = 0;
      for (const kw of rule.keywords) {
        if (lower.includes(kw)) hits++;
      }
      rule.weight = hits;
    }

    const matched = rules.filter(r => r.weight > 0).sort((a, b) => b.weight - a.weight);

    if (matched.length === 0) {
      agents.push(
        this.makeAgent('agent-context', 'context', 'ContextAgent', `分析需求：${requirement.slice(0, 60)}`, [], 1, ['project_structure_analyzed']),
        this.makeAgent('agent-execution', 'execution', 'ExecutionAgent', `执行：${requirement.slice(0, 60)}`, ['agent-context'], 2, ['task_completed']),
      );
    } else {
      const seenTypes = new Set<WorkerType>();
      let idx = 0;

      for (const { type, description } of matched) {
        if (seenTypes.has(type)) continue;
        seenTypes.add(type);
        idx++;

        const deps: string[] = [];
        if (type !== 'context' && matched.some(r => r.type === 'context')) {
          deps.push('agent-context');
        }
        if (type === 'execution' && matched.some(r => r.type === 'planning')) {
          deps.push('agent-planning');
        }

        agents.push(this.makeAgent(
          `agent-${type}`,
          type,
          this.agentNameForType(type),
          `${description}：${requirement.slice(0, 60)}`,
          deps,
          idx,
          this.inferCriteria(type),
        ));
      }
    }

    const strategy: AgentPlan['strategy'] =
      agents.some(a => a.dependsOn.length > 0) ? 'pipeline' : 'parallel';

    return { agents, strategy, estimatedDuration: agents.length * 1500 };
  }

  private validateAndNormalize(plan: AgentPlan): AgentPlan {
    const validTypes: WorkerType[] = ['context', 'planning', 'execution', 'review'];
    return {
      agents: plan.agents.map((a, i) => ({
        id: a.id || `agent-${i + 1}`,
        type: validTypes.includes(a.type) ? a.type : 'execution',
        name: a.name || this.agentNameForType(a.type),
        description: a.description || 'Execute task',
        dependsOn: a.dependsOn ?? [],
        priority: a.priority ?? i + 1,
        verificationCriteria: a.verificationCriteria ?? ['task_completed'],
      })),
      strategy: ['pipeline', 'parallel', 'mixed'].includes(plan.strategy) ? plan.strategy : 'pipeline',
      estimatedDuration: plan.estimatedDuration ?? plan.agents.length * 1500,
    };
  }

  private makeAgent(
    id: string, type: WorkerType, name: string,
    description: string, dependsOn: string[], priority: number,
    verificationCriteria: string[]
  ): AgentPlan['agents'][number] {
    return { id, type, name, description, dependsOn, priority, verificationCriteria };
  }

  private agentNameForType(type: WorkerType): string {
    const map: Record<WorkerType, string> = { context: 'ContextAgent', planning: 'PlanningAgent', execution: 'ExecutionAgent', review: 'ReviewAgent' };
    return map[type];
  }

  private inferCriteria(type: WorkerType): string[] {
    const map: Record<WorkerType, string[]> = {
      context: ['project_structure_analyzed'],
      planning: ['design_approved'],
      execution: ['task_completed'],
      review: ['quality_checks_passed'],
    };
    return map[type];
  }
}
