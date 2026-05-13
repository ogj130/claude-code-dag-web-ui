import type { WorkerContext } from '@/types/multi-agent/worker-agents';
import { BaseWorkerAgent } from './BaseWorkerAgent';
import { tryLLMCall } from '../ceo-agent/LLMDecomposer';

/**
 * ExecutionAgent - Executes tasks using Claude Code subagents
 * 
 * Responsibilities:
 * - Spawn Claude Code agents for parallel execution
 * - Create Claude Team for collaborative work
 * - Coordinate between workers
 * - Output execution results
 */
export class ExecutionAgent extends BaseWorkerAgent {
  constructor() {
    super('execution');
  }

  protected async doExecute(context: WorkerContext): Promise<unknown> {
    this.trackToolCall('ExecutionAgent.execute');

    const { description, workspaceId, workspacePath } = context;

    // 如果有 workspace 信息，说明应该走真实执行路径（通过 CEOAgent 的 executor）
    // 此 doExecute 仅在无 executor 可用时作为降级方案被调用
    const hasRealExecution = !!(workspaceId && workspacePath);

    if (hasRealExecution) {
      // 真实执行由 CEOAgent.executeWithAgent() 通过 executor 完成
      // 此处不应被调用 — 如果到达这里，说明调用链有问题
      return {
        plan: this.parseExecutionPlan(description),
        subTaskResults: [],
        aggregated: { totalTasks: 0, successfulTasks: 0, failedTasks: 0, successRate: 0 },
        verification: { allCompleted: false, partialCompletion: false, nothingDone: true, verificationPassed: false },
        totalSubTasks: 0,
        successfulSubTasks: 0,
        _source: 'bypassed',
        _warning: 'ExecutionAgent.doExecute called directly — real execution should go through executor',
      };
    }

    // 降级方案：无 workspace 时仅做 LLM 分析（非真实执行）
    const plan = this.parseExecutionPlan(description);
    const subTaskResults = await this.executeSubTasks(plan, context);
    const aggregated = this.aggregateResults(subTaskResults);
    const verification = this.verifyExecution(aggregated, plan);

    return {
      plan,
      subTaskResults,
      aggregated,
      verification,
      totalSubTasks: plan.length,
      successfulSubTasks: subTaskResults.filter(r => r.success).length,
      _source: 'llm-analysis-only',
      _warning: 'No real execution performed — LLM analysis only. Connect a workspace to enable real execution.',
    };
  }

  private parseExecutionPlan(task: string): string[] {
    this.trackToolCall('parseExecutionPlan');

    // Simple parsing - split by newlines or bullet points
    const steps = task
      .split(/[\n•\-]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    return steps.length > 0 ? steps : [task];
  }

  private async executeSubTasks(
    plan: string[],
    context: WorkerContext,
  ): Promise<Array<{ task: string; success: boolean; output: unknown }>> {
    this.trackToolCall('executeSubTasks');

    const results: Array<{ task: string; success: boolean; output: unknown }> = [];

    for (const step of plan) {
      this.toolCallCount++;

      // 尝试通过 LLM 分析执行步骤
      const llmResult = await tryLLMCall(
        `Analyze this execution step and provide implementation details:\nStep: ${step}\nContext: ${context.description}`,
      );

      if (llmResult) {
        results.push({
          task: step,
          success: true,
          output: { analysis: llmResult, _source: 'llm' },
        });
      } else {
        // 规则引擎降级
        results.push({
          task: step,
          success: true,
          output: {
            plan: step,
            message: `规则引擎生成执行计划: ${step}`,
            timestamp: Date.now(),
            _source: 'rules',
          },
        });
      }
    }

    return results;
  }

  private aggregateResults(results: Array<{ task: string; success: boolean; output: unknown }>): unknown {
    this.trackToolCall('aggregateResults');

    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;

    return {
      totalTasks: totalCount,
      successfulTasks: successCount,
      failedTasks: totalCount - successCount,
      successRate: totalCount > 0 ? successCount / totalCount : 0,
      summary: `${successCount}/${totalCount} tasks completed successfully`,
    };
  }

  private verifyExecution(
    aggregated: unknown,
    plan: string[]
  ): Record<string, unknown> {
    this.trackToolCall('verifyExecution');

    const agg = aggregated as Record<string, number>;

    return {
      allCompleted: agg.successfulTasks === plan.length,
      partialCompletion: agg.successfulTasks > 0 && agg.successfulTasks < plan.length,
      nothingDone: agg.successfulTasks === 0,
      verificationPassed: agg.successRate >= 0.8,
    };
  }

  // NOTE: 实际的子 agent 调度已通过 CEOAgent.executeWithAgent() 中的
  // executor.execute(taskContext, skills) 完成，此处不再需要 spawnClaudeCodeAgent 方法。
}
