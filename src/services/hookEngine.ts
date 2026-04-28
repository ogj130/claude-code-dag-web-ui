/**
 * hookEngine — Hooks 自动化引擎
 *
 * 事件驱动的自动化系统：触发器 → 条件评估 → 动作执行。
 *
 * 使用方式：
 *   import { hookEngine } from '@/services/hookEngine';
 *   hookEngine.register({ trigger: 'task_complete', action: '...' });
 *   hookEngine.emit('task_complete', { taskId: '...' });
 */

// ── 类型定义 ────────────────────────────────────────────────

export type TriggerType =
  | 'task_complete'
  | 'task_fail'
  | 'file_change'
  | 'model_switch'
  | 'session_start'
  | 'session_end'
  | 'error_detected'
  | 'user_feedback'
  | 'manual';

export interface HookCondition {
  field: string;
  operator: 'eq' | 'neq' | 'contains' | 'gt' | 'lt' | 'in';
  value: unknown;
}

export interface HookAction {
  type: 'notify' | 'record_episode' | 'run_command' | 'trigger_skill' | 'webhook';
  params: Record<string, unknown>;
}

export interface Hook {
  id: string;
  name: string;
  description: string;
  trigger: TriggerType;
  conditions: HookCondition[];
  actions: HookAction[];
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
  executionCount: number;
  lastExecutedAt?: number;
}

export interface HookLog {
  id: string;
  hookId: string;
  hookName: string;
  trigger: TriggerType;
  timestamp: number;
  status: 'success' | 'failed' | 'skipped';
  durationMs: number;
  details?: string;
  error?: string;
}

export interface EmitContext {
  [key: string]: unknown;
}

// ── ID 生成 ─────────────────────────────────────────────────

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── 存储 ────────────────────────────────────────────────────

const _hooks: Map<string, Hook> = new Map();
const _logs: HookLog[] = [];
const MAX_LOGS = 500;

// ── CRUD ────────────────────────────────────────────────────

/**
 * 注册 Hook
 */
export function register(params: {
  name: string;
  description?: string;
  trigger: TriggerType;
  conditions?: HookCondition[];
  actions: HookAction[];
}): Hook {
  const hook: Hook = {
    id: generateId('hook'),
    name: params.name,
    description: params.description ?? '',
    trigger: params.trigger,
    conditions: params.conditions ?? [],
    actions: params.actions,
    enabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    executionCount: 0,
  };

  _hooks.set(hook.id, hook);
  return hook;
}

/**
 * 获取 Hook
 */
export function getById(id: string): Hook | null {
  return _hooks.get(id) ?? null;
}

/**
 * 列出 Hooks
 */
export function list(options?: {
  trigger?: TriggerType;
  enabled?: boolean;
}): Hook[] {
  let results = [..._hooks.values()];

  if (options?.trigger) {
    results = results.filter((h) => h.trigger === options.trigger);
  }
  if (options?.enabled !== undefined) {
    results = results.filter((h) => h.enabled === options.enabled);
  }

  return results.sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * 更新 Hook
 */
export function update(id: string, updates: Partial<Pick<Hook, 'name' | 'description' | 'conditions' | 'actions' | 'enabled'>>): Hook | null {
  const hook = _hooks.get(id);
  if (!hook) return null;

  const updated = { ...hook, ...updates, updatedAt: Date.now() };
  _hooks.set(id, updated);
  return updated;
}

/**
 * 删除 Hook
 */
export function remove(id: string): boolean {
  return _hooks.delete(id);
}

// ── 条件评估 ────────────────────────────────────────────────

function evaluateCondition(condition: HookCondition, context: EmitContext): boolean {
  const fieldValue = context[condition.field];

  switch (condition.operator) {
    case 'eq':
      return fieldValue === condition.value;
    case 'neq':
      return fieldValue !== condition.value;
    case 'contains':
      return typeof fieldValue === 'string' && fieldValue.includes(String(condition.value));
    case 'gt':
      return typeof fieldValue === 'number' && fieldValue > (condition.value as number);
    case 'lt':
      return typeof fieldValue === 'number' && fieldValue < (condition.value as number);
    case 'in':
      return Array.isArray(condition.value) && condition.value.includes(fieldValue);
    default:
      return false;
  }
}

function evaluateConditions(conditions: HookCondition[], context: EmitContext): boolean {
  if (conditions.length === 0) return true;
  return conditions.every((c) => evaluateCondition(c, context));
}

// ── 动作执行（占位）─────────────────────────────────────────

async function executeAction(action: HookAction, _context: EmitContext): Promise<string> {
  // 模拟执行
  await new Promise((resolve) => setTimeout(resolve, 50));

  switch (action.type) {
    case 'notify':
      return `通知: ${action.params.message ?? 'OK'}`;
    case 'record_episode':
      return `记录 episode: ${action.params.content ?? 'auto'}`;
    case 'run_command':
      return `执行命令: ${action.params.command ?? 'none'}`;
    case 'trigger_skill':
      return `触发 Skill: ${action.params.skillId ?? 'unknown'}`;
    case 'webhook':
      return `Webhook: ${action.params.url ?? 'none'}`;
    default:
      return 'Unknown action';
  }
}

// ── 触发器 ──────────────────────────────────────────────────

/**
 * 发射事件，触发匹配的 Hook
 */
export async function emit(
  trigger: TriggerType,
  context: EmitContext = {},
  debug = false
): Promise<HookLog[]> {
  const matchingHooks = [..._hooks.values()].filter(
    (h) => h.enabled && h.trigger === trigger
  );

  const logs: HookLog[] = [];

  for (const hook of matchingHooks) {
    const logId = generateId('log');
    const startTime = Date.now();

    try {
      // 评估条件
      if (!evaluateConditions(hook.conditions, context)) {
        const log: HookLog = {
          id: logId,
          hookId: hook.id,
          hookName: hook.name,
          trigger,
          timestamp: Date.now(),
          status: 'skipped',
          durationMs: 0,
          details: debug ? '条件不满足' : undefined,
        };
        logs.push(log);
        addLog(log);
        continue;
      }

      // 执行动作
      const actionResults: string[] = [];
      for (const action of hook.actions) {
        const result = await executeAction(action, context);
        actionResults.push(result);
      }

      hook.executionCount++;
      hook.lastExecutedAt = Date.now();

      const log: HookLog = {
        id: logId,
        hookId: hook.id,
        hookName: hook.name,
        trigger,
        timestamp: Date.now(),
        status: 'success',
        durationMs: Date.now() - startTime,
        details: debug ? actionResults.join('; ') : undefined,
      };
      logs.push(log);
      addLog(log);
    } catch (err) {
      const log: HookLog = {
        id: logId,
        hookId: hook.id,
        hookName: hook.name,
        trigger,
        timestamp: Date.now(),
        status: 'failed',
        durationMs: Date.now() - startTime,
        error: err instanceof Error ? err.message : String(err),
      };
      logs.push(log);
      addLog(log);
    }
  }

  return logs;
}

// ── 日志 ────────────────────────────────────────────────────

function addLog(log: HookLog): void {
  _logs.push(log);
  if (_logs.length > MAX_LOGS) {
    _logs.splice(0, _logs.length - MAX_LOGS);
  }
}

/**
 * 获取执行日志
 */
export function getLogs(options?: {
  hookId?: string;
  trigger?: TriggerType;
  status?: HookLog['status'];
  limit?: number;
}): HookLog[] {
  let results = [..._logs];

  if (options?.hookId) {
    results = results.filter((l) => l.hookId === options.hookId);
  }
  if (options?.trigger) {
    results = results.filter((l) => l.trigger === options.trigger);
  }
  if (options?.status) {
    results = results.filter((l) => l.status === options.status);
  }

  results.sort((a, b) => b.timestamp - a.timestamp);

  if (options?.limit) {
    results = results.slice(0, options.limit);
  }

  return results;
}

// ── 重置（测试用）───────────────────────────────────────────

export function resetHookEngine(): void {
  _hooks.clear();
  _logs.length = 0;
}
