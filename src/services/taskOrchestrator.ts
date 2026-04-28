/**
 * taskOrchestrator — 任务编排引擎 V3
 *
 * 基于 DAG（有向无环图）的任务编排引擎，支持：
 * - 任务依赖管理与拓扑排序
 * - 循环依赖检测
 * - Checkpoint 创建与恢复（任务快照 + Agent 上下文）
 * - 进度跟踪与 ETA 估算
 * - 状态持久化（支持重启后恢复）
 *
 * 使用方式：
 *   import { createDag, topologicalSort, runDag, createCheckpoint } from '@/services/taskOrchestrator';
 */

// ── 类型定义 ────────────────────────────────────────────────

export type TaskStatus =
  | 'pending'
  | 'ready'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped';

export interface TaskCheckpoint {
  timestamp: number;
  agentContext: Record<string, unknown>;
  outputSnapshot: string;
}

export interface TaskNode {
  id: string;
  name: string;
  dependencies: string[];
  status: TaskStatus;
  checkpoint: TaskCheckpoint | null;
  startedAt?: number;
  completedAt?: number;
  output?: string;
  error?: string;
  progress: number; // 0-100
}

export interface DagGraph {
  id: string;
  name: string;
  nodes: Map<string, TaskNode>;
  createdAt: number;
  status: 'idle' | 'running' | 'completed' | 'failed' | 'paused';
}

export interface DagSerialized {
  id: string;
  name: string;
  nodes: Array<{
    id: string;
    name: string;
    dependencies: string[];
    status: TaskStatus;
    checkpoint: TaskCheckpoint | null;
    startedAt?: number;
    completedAt?: number;
    output?: string;
    error?: string;
    progress: number;
  }>;
  createdAt: number;
  status: 'idle' | 'running' | 'completed' | 'failed' | 'paused';
}

export interface ProgressInfo {
  total: number;
  completed: number;
  failed: number;
  running: number;
  pending: number;
  percentComplete: number;
  estimatedTimeRemainingMs: number | null;
}

// ── ID 生成 ─────────────────────────────────────────────────

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── DAG 状态管理 ─────────────────────────────────────────────

const _dags: Map<string, DagGraph> = new Map();
const _listeners: Array<(dag: DagGraph) => void> = [];

function notifyListeners(dag: DagGraph): void {
  for (const listener of _listeners) {
    listener(dag);
  }
}

/**
 * 监听 DAG 状态变化
 */
export function onDagUpdate(listener: (dag: DagGraph) => void): () => void {
  _listeners.push(listener);
  return () => {
    const idx = _listeners.indexOf(listener);
    if (idx >= 0) _listeners.splice(idx, 1);
  };
}

// ── DAG 创建 ────────────────────────────────────────────────

/**
 * 创建一个空的 DAG 图
 */
export function createDag(name: string): DagGraph {
  const dag: DagGraph = {
    id: generateId('dag'),
    name,
    nodes: new Map(),
    createdAt: Date.now(),
    status: 'idle',
  };
  _dags.set(dag.id, dag);
  return dag;
}

/**
 * 向 DAG 中添加任务节点
 */
export function addTask(
  dag: DagGraph,
  task: { id: string; name: string; dependencies?: string[] }
): TaskNode {
  const node: TaskNode = {
    id: task.id,
    name: task.name,
    dependencies: task.dependencies ?? [],
    status: 'pending',
    checkpoint: null,
    progress: 0,
  };
  dag.nodes.set(task.id, node);
  return node;
}

/**
 * 获取 DAG 中的任务节点
 */
export function getTaskNode(dag: DagGraph, taskId: string): TaskNode | null {
  return dag.nodes.get(taskId) ?? null;
}

/**
 * 获取 DAG 实例
 */
export function getDag(dagId: string): DagGraph | null {
  return _dags.get(dagId) ?? null;
}

/**
 * 获取所有 DAG
 */
export function getAllDags(): DagGraph[] {
  return [..._dags.values()];
}

// ── 拓扑排序（Kahn 算法）────────────────────────────────────

export interface TopologicalSortResult {
  sorted: string[];
  hasCycle: boolean;
  cycleNodes?: string[];
}

/**
 * 对 DAG 进行拓扑排序
 *
 * 使用 Kahn 算法（BFS），同时检测循环依赖。
 * 如果检测到循环，返回 hasCycle=true 及参与循环的节点列表。
 */
export function topologicalSort(dag: DagGraph): TopologicalSortResult {
  const nodes = dag.nodes;
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  // 初始化
  for (const [id] of nodes) {
    inDegree.set(id, 0);
    adjacency.set(id, []);
  }

  // 构建邻接表和入度表
  for (const [id, node] of nodes) {
    for (const dep of node.dependencies) {
      if (!nodes.has(dep)) {
        throw new Error(`Task "${id}" depends on non-existent task "${dep}"`);
      }
      adjacency.get(dep)!.push(id);
      inDegree.set(id, (inDegree.get(id) ?? 0) + 1);
    }
  }

  // Kahn 算法
  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const sorted: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);

    for (const neighbor of adjacency.get(current) ?? []) {
      const newDeg = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) {
        queue.push(neighbor);
      }
    }
  }

  // 检测循环
  if (sorted.length !== nodes.size) {
    const cycleNodes: string[] = [];
    for (const [id, deg] of inDegree) {
      if (deg > 0) cycleNodes.push(id);
    }
    return { sorted, hasCycle: true, cycleNodes };
  }

  return { sorted, hasCycle: false };
}

/**
 * 检测 DAG 是否存在循环依赖
 */
export function hasCycle(dag: DagGraph): boolean {
  return topologicalSort(dag).hasCycle;
}

// ── Checkpoint 管理 ─────────────────────────────────────────

/**
 * 为指定任务创建 Checkpoint
 */
export function createCheckpoint(
  dag: DagGraph,
  taskId: string,
  agentContext: Record<string, unknown>,
  outputSnapshot: string
): TaskCheckpoint {
  const node = dag.nodes.get(taskId);
  if (!node) throw new Error(`Task "${taskId}" not found in DAG`);

  const checkpoint: TaskCheckpoint = {
    timestamp: Date.now(),
    agentContext,
    outputSnapshot,
  };

  node.checkpoint = checkpoint;
  notifyListeners(dag);
  return checkpoint;
}

/**
 * 从 Checkpoint 恢复任务状态
 * 返回恢复时的 agent 上下文，如果无 checkpoint 则返回 null
 */
export function restoreCheckpoint(
  dag: DagGraph,
  taskId: string
): Record<string, unknown> | null {
  const node = dag.nodes.get(taskId);
  if (!node) throw new Error(`Task "${taskId}" not found in DAG`);
  if (!node.checkpoint) return null;

  // 恢复为 ready 状态，准备重新执行
  node.status = 'ready';
  node.error = undefined;
  notifyListeners(dag);

  return node.checkpoint.agentContext;
}

/**
 * 获取任务的 Checkpoint
 */
export function getCheckpoint(
  dag: DagGraph,
  taskId: string
): TaskCheckpoint | null {
  const node = dag.nodes.get(taskId);
  if (!node) throw new Error(`Task "${taskId}" not found in DAG`);
  return node.checkpoint;
}

/**
 * 清除指定任务的 Checkpoint
 */
export function clearCheckpoint(dag: DagGraph, taskId: string): void {
  const node = dag.nodes.get(taskId);
  if (!node) throw new Error(`Task "${taskId}" not found in DAG`);
  node.checkpoint = null;
  notifyListeners(dag);
}

// ── 进度跟踪 ───────────────────────────────────────────────

/**
 * 更新任务进度
 */
export function updateProgress(
  dag: DagGraph,
  taskId: string,
  progress: number
): void {
  const node = dag.nodes.get(taskId);
  if (!node) throw new Error(`Task "${taskId}" not found in DAG`);

  node.progress = Math.max(0, Math.min(100, progress));
  notifyListeners(dag);
}

/**
 * 获取 DAG 整体进度信息
 */
export function getProgress(dag: DagGraph): ProgressInfo {
  const nodes = [...dag.nodes.values()];
  const total = nodes.length;

  if (total === 0) {
    return {
      total: 0,
      completed: 0,
      failed: 0,
      running: 0,
      pending: 0,
      percentComplete: 0,
      estimatedTimeRemainingMs: null,
    };
  }

  const completed = nodes.filter((n) => n.status === 'completed').length;
  const failed = nodes.filter((n) => n.status === 'failed').length;
  const running = nodes.filter((n) => n.status === 'running').length;
  const pending = nodes.filter(
    (n) => n.status === 'pending' || n.status === 'ready'
  ).length;

  const percentComplete = Math.round((completed / total) * 100);

  // ETA 估算：基于已完成任务的平均耗时
  let estimatedTimeRemainingMs: number | null = null;
  const completedNodes = nodes.filter(
    (n) => n.status === 'completed' && n.startedAt && n.completedAt
  );

  if (completedNodes.length > 0) {
    const avgDuration =
      completedNodes.reduce(
        (sum, n) => sum + ((n.completedAt ?? 0) - (n.startedAt ?? 0)),
        0
      ) / completedNodes.length;

    // 将平均耗时按子任务加权（考虑 running 任务的当前进度）
    let remainingWork = 0;
    for (const n of nodes) {
      if (n.status === 'pending' || n.status === 'ready') {
        remainingWork += 1;
      } else if (n.status === 'running') {
        remainingWork += (100 - n.progress) / 100;
      }
    }

    estimatedTimeRemainingMs = Math.round(avgDuration * remainingWork);
  }

  return {
    total,
    completed,
    failed,
    running,
    pending,
    percentComplete,
    estimatedTimeRemainingMs,
  };
}

// ── DAG 执行引擎 ───────────────────────────────────────────

type TaskExecutor = (
  node: TaskNode,
  dependenciesOutputs: Map<string, string>
) => Promise<string>;

/**
 * 标记 DAG 中就绪的节点为 ready
 * 就绪条件：所有依赖都已 completed
 */
function markReadyNodes(dag: DagGraph): void {
  for (const [, node] of dag.nodes) {
    if (node.status !== 'pending') continue;

    const allDepsCompleted = node.dependencies.every((depId) => {
      const dep = dag.nodes.get(depId);
      return dep?.status === 'completed';
    });

    if (allDepsCompleted) {
      node.status = 'ready';
    }
  }
}

/**
 * 执行 DAG
 *
 * 按拓扑顺序执行就绪的任务节点，支持并行执行互不依赖的任务。
 * 失败的节点会跳过其下游依赖。
 */
export async function runDag(
  dag: DagGraph,
  executor: TaskExecutor
): Promise<DagGraph> {
  // 先做拓扑排序检测循环
  const sortResult = topologicalSort(dag);
  if (sortResult.hasCycle) {
    throw new Error(
      `DAG contains cycle: ${sortResult.cycleNodes?.join(' → ')}`
    );
  }

  dag.status = 'running';
  notifyListeners(dag);

  // 按拓扑序逐轮执行
  const completedOutputs = new Map<string, string>();

  while (true) {
    markReadyNodes(dag);
    const readyNodes = [...dag.nodes.values()].filter(
      (n) => n.status === 'ready'
    );

    if (readyNodes.length === 0) {
      // 没有更多 ready 节点
      break;
    }

    // 并行执行所有 ready 节点
    const promises = readyNodes.map(async (node) => {
      node.status = 'running';
      node.startedAt = Date.now();
      node.progress = 0;
      notifyListeners(dag);

      // 收集依赖输出
      const depsOutputs = new Map<string, string>();
      for (const depId of node.dependencies) {
        const output = completedOutputs.get(depId);
        if (output !== undefined) {
          depsOutputs.set(depId, output);
        }
      }

      try {
        node.progress = 50;
        notifyListeners(dag);

        const output = await executor(node, depsOutputs);

        node.status = 'completed';
        node.output = output;
        node.progress = 100;
        node.completedAt = Date.now();
        completedOutputs.set(node.id, output);

        // 自动创建 checkpoint
        node.checkpoint = {
          timestamp: Date.now(),
          agentContext: { output },
          outputSnapshot: output,
        };
      } catch (err) {
        node.status = 'failed';
        node.error = err instanceof Error ? err.message : String(err);
        node.completedAt = Date.now();

        // 跳过依赖此节点的下游任务
        skipDownstream(dag, node.id);
      }

      notifyListeners(dag);
    });

    await Promise.all(promises);
  }

  // 判断最终状态
  const allNodes = [...dag.nodes.values()];
  const anyFailed = allNodes.some((n) => n.status === 'failed');
  const anySkipped = allNodes.some((n) => n.status === 'skipped');

  if (anyFailed) {
    dag.status = 'failed';
  } else if (allNodes.every((n) => n.status === 'completed')) {
    dag.status = 'completed';
  } else if (anySkipped) {
    // 部分跳过 → completed（有降级）
    dag.status = 'completed';
  }

  notifyListeners(dag);
  return dag;
}

/**
 * 跳过指定节点的所有下游依赖
 */
function skipDownstream(dag: DagGraph, failedNodeId: string): void {
  const visited = new Set<string>();
  const queue = [failedNodeId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    for (const [, node] of dag.nodes) {
      if (
        node.dependencies.includes(current) &&
        (node.status === 'pending' || node.status === 'ready')
      ) {
        node.status = 'skipped';
        queue.push(node.id);
      }
    }
  }
}

// ── 状态持久化 ─────────────────────────────────────────────

/**
 * 序列化 DAG 为可存储的 JSON 格式
 */
export function serializeDag(dag: DagGraph): DagSerialized {
  return {
    id: dag.id,
    name: dag.name,
    nodes: [...dag.nodes.values()].map((n) => ({ ...n })),
    createdAt: dag.createdAt,
    status: dag.status,
  };
}

/**
 * 从序列化数据恢复 DAG
 */
export function deserializeDag(data: DagSerialized): DagGraph {
  const dag: DagGraph = {
    id: data.id,
    name: data.name,
    nodes: new Map(),
    createdAt: data.createdAt,
    status: data.status,
  };

  for (const nodeData of data.nodes) {
    dag.nodes.set(nodeData.id, { ...nodeData });
  }

  _dags.set(dag.id, dag);
  return dag;
}

/**
 * 保存 DAG 到持久化存储
 */
export function persistDag(dag: DagGraph, storageKey: string): void {
  try {
    const serialized = serializeDag(dag);
    localStorage.setItem(storageKey, JSON.stringify(serialized));
  } catch {
    // localStorage 可能不可用（Node 测试环境等）
  }
}

/**
 * 从持久化存储恢复 DAG
 */
export function restoreDag(storageKey: string): DagGraph | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const data = JSON.parse(raw) as DagSerialized;
    return deserializeDag(data);
  } catch {
    return null;
  }
}

// ── 重置（测试用）────────────────────────────────────────────

/**
 * 重置所有 DAG 状态（测试用）
 */
export function resetTaskOrchestrator(): void {
  _dags.clear();
  _listeners.length = 0;
}
