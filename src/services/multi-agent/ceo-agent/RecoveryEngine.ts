import type { FailureCategory, RecoveryAction, RecoveryStrategy } from '../types';
import type { Goal, AgentPlan, WorkerType } from '@/types/multi-agent/ceo-agent';

/**
 * RecoveryEngine — 分析失败原因并生成恢复策略
 */
export class RecoveryEngine implements RecoveryStrategy {
  diagnose(error: string, _agentType: WorkerType): FailureCategory {
    const lower = error.toLowerCase();

    if (lower.includes('timeout') || lower.includes('etimedout') ||
        lower.includes('timed out') || lower.includes('deadline exceeded')) {
      return 'timeout';
    }

    if (lower.includes('eacces') || lower.includes('permission denied') ||
        lower.includes('not permitted') || lower.includes('access denied')) {
      return 'permission';
    }

    if (lower.includes('syntaxerror') || lower.includes('typeerror') ||
        lower.includes('referenceerror') || lower.includes('unexpected token') ||
        lower.includes('is not a function') || lower.includes('cannot read property')) {
      return 'syntax_error';
    }

    if (lower.includes('command not found') || lower.includes('tool execution failed') ||
        lower.includes('exit code') || lower.includes('no such file')) {
      return 'tool_error';
    }

    return 'unknown';
  }

  recover(category: FailureCategory, goal: Goal, _originalPlan: AgentPlan): RecoveryAction {
    switch (category) {
      case 'timeout':
        return {
          type: 'split',
          subTasks: [
            `${goal.description} (Part 1/2)`,
            `${goal.description} (Part 2/2)`,
          ],
        };

      case 'permission':
        return {
          type: 'retry',
          newAgentType: 'review',
        };

      case 'syntax_error':
        return {
          type: 'retry',
          newAgentType: 'review',
        };

      case 'tool_error':
        return {
          type: 'split',
          subTasks: [
            `${goal.description} — 简化版`,
          ],
        };

      case 'unknown':
      default:
        return {
          type: 'fail',
          reason: `Unrecoverable error for goal: ${goal.description}`,
        };
    }
  }
}
