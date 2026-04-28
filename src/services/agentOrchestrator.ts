/**
 * agentOrchestrator — Agent 编排引擎
 *
 * 支持 5 种协作模式：
 * - parallel:    并行执行，互不依赖
 * - sequential:  顺序执行，前一个完成才启动下一个
 * - pipeline:    流水线，前一个的输出作为后一个的输入
 * - coordinator: 协调者模式，coordinator 分配任务给 workers
 * - reviewer:    审查模式，worker 执行 → reviewer 审查
 *
 * 使用方式：
 *   import { orchestrator } from '@/services/agentOrchestrator';
 *   const result = await orchestrator.execute(task);
 */

// ── 类型定义 ────────────────────────────────────────────────

export type CollaborationMode =
  | 'parallel'
  | 'sequential'
  | 'pipeline'
  | 'coordinator'
  | 'reviewer';

export type AgentRole = 'coordinator' | 'worker' | 'reviewer' | 'specialist';

export type AgentStatus =
  | 'idle'
  | 'running'
  | 'waiting'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface AgentNode {
  id: string;
  name: string;
  role: AgentRole;
  status: AgentStatus;
  taskDescription: string;
  tokenCount: number;
  durationMs: number;
  result?: string;
  error?: string;
  dependencies: string[]; // agent IDs this depends on
  assignedAt?: number;
  startedAt?: number;
  completedAt?: number;
}

export interface OrchestrationTask {
  id: string;
  name: string;
  mode: CollaborationMode;
  agents: AgentNode[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: number;
  completedAt?: number;
  totalTokens: number;
}

export interface OrchestrationResult {
  taskId: string;
  status: 'completed' | 'failed';
  agents: AgentNode[];
  totalTokens: number;
  totalDurationMs: number;
}

// ── ID 生成 ─────────────────────────────────────────────────

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── 文件锁管理 ──────────────────────────────────────────────

const _fileLocks: Map<string, string> = new Map(); // filePath → agentId
const _laneQueues: Map<string, string[]> = new Map(); // lane → agentIds queue

/**
 * 尝试获取文件锁
 *
 * @returns true if acquired, false if already locked
 */
export function acquireFileLock(filePath: string, agentId: string): boolean {
  const existing = _fileLocks.get(filePath);
  if (existing && existing !== agentId) {
    return false;
  }
  _fileLocks.set(filePath, agentId);
  return true;
}

/**
 * 释放文件锁
 */
export function releaseFileLock(filePath: string, agentId: string): void {
  if (_fileLocks.get(filePath) === agentId) {
    _fileLocks.delete(filePath);
  }
}

/**
 * 获取文件锁状态
 */
export function getFileLockStatus(): Array<{ filePath: string; agentId: string }> {
  return [..._fileLocks.entries()].map(([filePath, agentId]) => ({ filePath, agentId }));
}

/**
 * Lane Queue 入队（用于串行化同一文件的写操作）
 */
export function enqueueLane(lane: string, agentId: string): number {
  const queue = _laneQueues.get(lane) ?? [];
  queue.push(agentId);
  _laneQueues.set(lane, queue);
  return queue.length;
}

/**
 * Lane Queue 出队
 */
export function dequeueLane(lane: string): string | null {
  const queue = _laneQueues.get(lane);
  if (!queue || queue.length === 0) return null;
  const agentId = queue.shift()!;
  if (queue.length === 0) _laneQueues.delete(lane);
  return agentId;
}

// ── 重试机制 ────────────────────────────────────────────────

const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
};

/**
 * 带指数退避的重试
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = RETRY_CONFIG.maxRetries
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt < maxRetries) {
        const delay = Math.min(
          RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt),
          RETRY_CONFIG.maxDelayMs
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

// ── 状态管理 ────────────────────────────────────────────────

const _tasks: Map<string, OrchestrationTask> = new Map();
const _listeners: Array<(task: OrchestrationTask) => void> = [];

function notifyListeners(task: OrchestrationTask): void {
  for (const listener of _listeners) {
    listener({ ...task, agents: [...task.agents] });
  }
}

/**
 * 监听任务状态变化
 */
export function onTaskUpdate(listener: (task: OrchestrationTask) => void): () => void {
  _listeners.push(listener);
  return () => {
    const idx = _listeners.indexOf(listener);
    if (idx >= 0) _listeners.splice(idx, 1);
  };
}

// ── Agent 执行器（占位，实际走 IPC）─────────────────────────

async function executeAgent(agent: AgentNode, input?: string): Promise<string> {
  // 模拟执行
  await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 200));

  agent.status = 'completed';
  agent.result = `Result from ${agent.name}${input ? ` (input: ${input.slice(0, 50)})` : ''}`;
  agent.tokenCount = Math.floor(500 + Math.random() * 2000);
  agent.durationMs = Date.now() - (agent.startedAt ?? Date.now());
  agent.completedAt = Date.now();

  return agent.result;
}

// ── 协作模式执行 ────────────────────────────────────────────

async function executeParallel(task: OrchestrationTask): Promise<void> {
  const promises = task.agents.map(async (agent) => {
    agent.status = 'running';
    agent.startedAt = Date.now();
    notifyListeners(task);
    await executeAgent(agent);
    notifyListeners(task);
  });
  await Promise.all(promises);
}

async function executeSequential(task: OrchestrationTask): Promise<void> {
  for (const agent of task.agents) {
    agent.status = 'running';
    agent.startedAt = Date.now();
    notifyListeners(task);
    await executeAgent(agent);
    notifyListeners(task);
  }
}

async function executePipeline(task: OrchestrationTask): Promise<void> {
  let prevResult: string | undefined;

  for (const agent of task.agents) {
    agent.status = 'running';
    agent.startedAt = Date.now();
    notifyListeners(task);
    prevResult = await executeAgent(agent, prevResult);
    notifyListeners(task);
  }
}

async function executeCoordinator(task: OrchestrationTask): Promise<void> {
  const coordinator = task.agents.find((a) => a.role === 'coordinator');
  const workers = task.agents.filter((a) => a.role === 'worker');

  if (!coordinator || workers.length === 0) {
    // 降级为顺序执行
    await executeSequential(task);
    return;
  }

  // Coordinator 先执行
  coordinator.status = 'running';
  coordinator.startedAt = Date.now();
  notifyListeners(task);
  await executeAgent(coordinator);
  notifyListeners(task);

  // Workers 并行执行
  const promises = workers.map(async (worker) => {
    worker.status = 'running';
    worker.startedAt = Date.now();
    notifyListeners(task);
    await executeAgent(worker);
    notifyListeners(task);
  });
  await Promise.all(promises);
}

async function executeReviewer(task: OrchestrationTask): Promise<void> {
  const worker = task.agents.find((a) => a.role === 'worker');
  const reviewer = task.agents.find((a) => a.role === 'reviewer');

  if (!worker || !reviewer) {
    await executeSequential(task);
    return;
  }

  // Worker 先执行
  worker.status = 'running';
  worker.startedAt = Date.now();
  notifyListeners(task);
  const workerResult = await executeAgent(worker);
  notifyListeners(task);

  // Reviewer 审查
  reviewer.status = 'running';
  reviewer.startedAt = Date.now();
  notifyListeners(task);
  await executeAgent(reviewer, workerResult);
  notifyListeners(task);
}

// ── 主编排接口 ──────────────────────────────────────────────

const MODE_EXECUTORS: Record<CollaborationMode, (task: OrchestrationTask) => Promise<void>> = {
  parallel: executeParallel,
  sequential: executeSequential,
  pipeline: executePipeline,
  coordinator: executeCoordinator,
  reviewer: executeReviewer,
};

/**
 * 创建编排任务
 */
export function createTask(
  name: string,
  mode: CollaborationMode,
  agentDescriptions: Array<{ name: string; role: AgentRole; taskDescription: string; dependencies?: string[] }>
): OrchestrationTask {
  const agents: AgentNode[] = agentDescriptions.map((desc) => ({
    id: generateId('agent'),
    name: desc.name,
    role: desc.role,
    status: 'idle',
    taskDescription: desc.taskDescription,
    tokenCount: 0,
    durationMs: 0,
    dependencies: desc.dependencies ?? [],
  }));

  const task: OrchestrationTask = {
    id: generateId('task'),
    name,
    mode,
    agents,
    status: 'pending',
    createdAt: Date.now(),
    totalTokens: 0,
  };

  _tasks.set(task.id, task);
  return task;
}

/**
 * 执行编排任务
 */
export async function executeTask(taskId: string): Promise<OrchestrationResult> {
  const task = _tasks.get(taskId);
  if (!task) throw new Error(`Task ${taskId} not found`);

  task.status = 'running';
  notifyListeners(task);

  try {
    const executor = MODE_EXECUTORS[task.mode];
    await executor(task);

    task.status = 'completed';
    task.completedAt = Date.now();
    task.totalTokens = task.agents.reduce((sum, a) => sum + a.tokenCount, 0);
    notifyListeners(task);

    return {
      taskId: task.id,
      status: 'completed',
      agents: task.agents,
      totalTokens: task.totalTokens,
      totalDurationMs: (task.completedAt ?? Date.now()) - task.createdAt,
    };
  } catch (err) {
    task.status = 'failed';
    task.completedAt = Date.now();
    notifyListeners(task);

    return {
      taskId: task.id,
      status: 'failed',
      agents: task.agents,
      totalTokens: task.agents.reduce((sum, a) => sum + a.tokenCount, 0),
      totalDurationMs: (task.completedAt ?? Date.now()) - task.createdAt,
    };
  }
}

/**
 * 获取任务状态
 */
export function getTask(taskId: string): OrchestrationTask | null {
  return _tasks.get(taskId) ?? null;
}

/**
 * 获取所有任务
 */
export function getAllTasks(): OrchestrationTask[] {
  return [..._tasks.values()];
}

/**
 * 重置状态（测试用）
 */
export function resetOrchestrator(): void {
  _tasks.clear();
  _fileLocks.clear();
  _laneQueues.clear();
  _listeners.length = 0;
}
