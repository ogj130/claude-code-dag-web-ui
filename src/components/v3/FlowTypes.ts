/**
 * FlowTypes — 可视化流程构建器共享类型
 *
 * 定义流程节点、边、模板和执行状态的类型系统。
 */

// ── 节点类型 ────────────────────────────────────────────────

export type NodeType = 'task' | 'decision' | 'input' | 'output' | 'template' | 'agent';
export type NodeStatus = 'idle' | 'running' | 'completed' | 'failed' | 'pending' | 'skipped';

export interface FlowNode {
  id: string;
  type: NodeType;
  label: string;
  x: number;
  y: number;
  config?: {
    command?: string;
    condition?: string;
    template?: string;
    description?: string;
  };
  status?: NodeStatus;
  // V3 CEO Agent 扩展:
  agentType?: string;
  agentDescription?: string;
  verificationCriteria?: string[];
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: 'true' | 'false';
  label?: string;
}

export interface Flow {
  nodes: FlowNode[];
  edges: FlowEdge[];
  name: string;
  description?: string;
  created: number;
}

export interface StepExecution {
  nodeId: string;
  status: NodeStatus;
  result?: string;
  error?: string;
  startedAt?: number;
  endedAt?: number;
}

export interface ExecutionState {
  steps: StepExecution[];
  currentNodeId: string | null;
  isComplete: boolean;
  startedAt: number;
}

export interface ExecutionEvent {
  type: 'start' | 'node_start' | 'node_complete' | 'node_error' | 'complete' | 'reset';
  nodeId?: string;
  result?: string;
  error?: string;
  timestamp: number;
}

export interface FlowTemplate {
  id: string;
  name: string;
  description: string;
  flow: Flow;
}

// ── 节点视觉常量 ────────────────────────────────────────────

export const NODE_WIDTH: Record<NodeType, number> = {
  task: 160,
  decision: 80,
  input: 120,
  output: 120,
  template: 160,
  agent: 180,
};

export const NODE_HEIGHT: Record<NodeType, number> = {
  task: 60,
  decision: 80,
  input: 44,
  output: 44,
  template: 60,
  agent: 64,
};

export const NODE_RADIUS: Record<NodeType, number> = {
  task: 8,
  decision: 0,
  input: 22,
  output: 22,
  template: 8,
  agent: 10,
};

export function getNodePorts(node: FlowNode): { input: [number, number]; output: [number, number]; false?: [number, number]; true?: [number, number] } {
  const w = NODE_WIDTH[node.type];
  const h = NODE_HEIGHT[node.type];

  if (node.type === 'input') {
    return {
      input: [node.x + w, node.y + h / 2],
      output: [node.x + w, node.y + h / 2],
    };
  }

  if (node.type === 'output') {
    return {
      input: [node.x, node.y + h / 2],
      output: [node.x, node.y + h / 2],
    };
  }

  if (node.type === 'decision') {
    const cx = node.x + w / 2;
    return {
      input: [cx, node.y],
      output: [node.x + w, node.y + h / 2],
      true: [node.x + w, node.y + h / 2],
      false: [cx, node.y + h],
    };
  }

  return {
    input: [node.x, node.y + h / 2],
    output: [node.x + w, node.y + h / 2],
  };
}

// ── 节点类型标签 ────────────────────────────────────────────

export const NODE_TYPE_LABELS: Record<NodeType, string> = {
  task: '任务',
  decision: '决策',
  input: '输入',
  output: '输出',
  template: '模板',
  agent: 'Agent',
};

// ── 节点配色 ────────────────────────────────────────────────

export const NODE_COLORS: Record<NodeType, { border: string; bg: string; text: string; glow: string }> = {
  task: { border: '#3b82f6', bg: 'rgba(59,130,246,0.08)', text: '#93c5fd', glow: 'rgba(59,130,246,0.4)' },
  decision: { border: '#f59e0b', bg: 'rgba(245,158,11,0.08)', text: '#fcd34d', glow: 'rgba(245,158,11,0.4)' },
  input: { border: '#10b981', bg: 'rgba(16,185,129,0.08)', text: '#6ee7b7', glow: 'rgba(16,185,129,0.4)' },
  output: { border: '#8b5cf6', bg: 'rgba(139,92,246,0.08)', text: '#c4b5fd', glow: 'rgba(139,92,246,0.4)' },
  template: { border: '#64748b', bg: 'rgba(100,116,139,0.08)', text: '#94a3b8', glow: 'rgba(100,116,139,0.4)' },
  agent: { border: '#8b5cf6', bg: 'rgba(139,92,246,0.08)', text: '#c4b5fd', glow: 'rgba(139,92,246,0.4)' },
};

// ── 画布常量 ────────────────────────────────────────────────

export const CANVAS_PAD = 60;
export const CANVAS_WIDTH = 1200;
export const CANVAS_HEIGHT = 800;
export const GRID_SIZE = 30;

// ── SVG 阴影 ────────────────────────────────────────────────

export const SVG_SHADOW_ID = 'flow-node-shadow';
export const SVG_SHADOW_DEF = `<filter id="${SVG_SHADOW_ID}" x="-20%" y="-20%" width="140%" height="140%">
  <feDropShadow dx="0" dy="2" stdDeviation="4" flood-opacity="0.3" />
</filter>`;

// ── 边路径计算 ──────────────────────────────────────────────

export function computeEdgePath(
  sourceNode: FlowNode,
  targetNode: FlowNode,
  sourceHandle?: 'true' | 'false',
): string {
  const sp = getNodePorts(sourceNode);
  const tp = getNodePorts(targetNode);

  let sx: number, sy: number;
  if (sourceNode.type === 'decision' && sourceHandle === 'false' && sp.false) {
    [sx, sy] = sp.false;
  } else if (sourceNode.type === 'decision' && sourceHandle === 'true' && sp.true) {
    [sx, sy] = sp.true;
  } else {
    [sx, sy] = sp.output;
  }
  const [tx, ty] = tp.input;

  const dx = tx - sx;
  const dy = ty - sy;

  // 相同高度：水平贝塞尔
  if (Math.abs(dy) < 20) {
    const cx = Math.max(60, Math.abs(dx) * 0.4);
    return `M${sx},${sy} C${sx + cx},${sy} ${tx - cx},${ty} ${tx},${ty}`;
  }

  // 水平距离太小：垂直贝塞尔
  if (Math.abs(dx) < 20) {
    const cy = Math.max(40, Math.abs(dy) * 0.4);
    return `M${sx},${sy} C${sx},${sy + cy} ${tx},${ty - cy} ${tx},${ty}`;
  }

  // 对角线：带拐弯的路径
  const offset = Math.min(80, Math.abs(dx) * 0.5);
  const mx = dx > 0 ? sx + offset : sx - offset * 0.3;

  return `M${sx},${sy} C${mx},${sy} ${tx - offset},${ty} ${tx},${ty}`;
}

export function computeEdgeLabelPosition(
  sourceNode: FlowNode,
  targetNode: FlowNode,
  sourceHandle?: 'true' | 'false',
): { x: number; y: number } {
  const sp = getNodePorts(sourceNode);
  const tp = getNodePorts(targetNode);

  let sx: number, sy: number;
  if (sourceNode.type === 'decision' && sourceHandle === 'false' && sp.false) {
    [sx, sy] = sp.false;
  } else if (sourceNode.type === 'decision' && sourceHandle === 'true' && sp.true) {
    [sx, sy] = sp.true;
  } else {
    [sx, sy] = sp.output;
  }
  const [tx, ty] = tp.input;

  return { x: (sx + tx) / 2, y: (sy + ty) / 2 };
}

// ── 执行状态配色 ────────────────────────────────────────────

export const STEP_COLORS: Record<NodeStatus, { stroke: string; fill: string; icon: string }> = {
  running: { stroke: '#3b82f6', fill: 'rgba(59,130,246,0.15)', icon: '▶' },
  completed: { stroke: '#10b981', fill: 'rgba(16,185,129,0.15)', icon: '✓' },
  failed: { stroke: '#ef4444', fill: 'rgba(239,68,68,0.15)', icon: '✗' },
  pending: { stroke: '#4b5563', fill: 'rgba(75,85,99,0.10)', icon: '○' },
  idle: { stroke: '#4b5563', fill: 'rgba(75,85,99,0.08)', icon: '○' },
  skipped: { stroke: '#4b5563', fill: 'rgba(75,85,99,0.05)', icon: '⊘' },
};
