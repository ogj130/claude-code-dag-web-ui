/**
 * FlowExecutionView — 流程执行可视化
 *
 * 展示流程运行时的节点执行状态、动画进度、每节点结果。
 * 使用自动播放或手动步进模拟执行流程。
 * 所有样式使用内联 style + CSS 变量（本项目未安装 Tailwind CSS）。
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  NODE_WIDTH,
  NODE_HEIGHT,
  NODE_RADIUS,
  NODE_COLORS,
  CANVAS_PAD,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  GRID_SIZE,
  SVG_SHADOW_ID,
  computeEdgePath,
  STEP_COLORS,
  NODE_TYPE_LABELS,
  type Flow,
  type FlowNode,
  type NodeStatus,
  type NodeType,
} from './FlowTypes';
import { BUILTIN_TEMPLATES } from './FlowTemplates';
import { ExecutionProgressBar } from './ExecutionProgressBar';
import { ExecutionResultCard } from './ExecutionResultCard';
import { ExecutionPlaybackControls } from './ExecutionPlaybackControls';

// ── 工具函数 ────────────────────────────────────────────────


function simulateResult(node: FlowNode): string {
  const descriptions: Record<NodeType, string[]> = {
    input: ['接收用户输入', '解析输入参数', '验证输入格式'],
    task: ['执行分析任务', '生成代码片段', '优化性能指标', '运行测试套件'],
    decision: ['条件检查通过', '分支判断完成'],
    template: ['模板实例化完成', '子流程执行成功'],
    output: ['输出结果已生成', '报告已写入文件'],
    agent: ['Agent 执行完成', '子任务已派发'],
  };
  const options = descriptions[node.type] ?? ['任务完成'];
  return options[Math.floor(Math.random() * options.length)];
}


// ── 执行顺序计算 ────────────────────────────────────────────

/** BFS 拓扑排序，支持决策分支取 true 路径 */
function computeExecutionOrder(flow: Flow): string[] {
  const adj = new Map<string, string[]>();
  for (const n of flow.nodes) adj.set(n.id, []);
  for (const e of flow.edges) {
    const list = adj.get(e.source);
    if (list) list.push(e.target);
  }

  const order: string[] = [];
  const visited = new Set<string>();
  const queue = flow.nodes.filter((n) => n.type === 'input').map((n) => n.id);

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);
    order.push(nodeId);

    const neighbors = adj.get(nodeId) ?? [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) queue.push(neighbor);
    }
  }

  return order;
}

// ── 节点形状（执行视图专用）─────────────────────────────────

function ExecNodeShape({ node, strokeColor, fillColor }: { node: FlowNode; strokeColor: string; fillColor: string }) {
  const w = NODE_WIDTH[node.type];
  const h = NODE_HEIGHT[node.type];
  const r = NODE_RADIUS[node.type];

  if (node.type === 'decision') {
    const cx = node.x + w / 2;
    const cy = node.y + h / 2;
    const d = `M${cx},${node.y} L${node.x + w},${cy} L${cx},${node.y + h} L${node.x},${cy} Z`;
    return <path d={d} fill={fillColor} stroke={strokeColor} strokeWidth={2} />;
  }

  if (node.type === 'input' || node.type === 'output') {
    return (
      <rect x={node.x} y={node.y} width={w} height={h} rx={r} fill={fillColor} stroke={strokeColor} strokeWidth={2} />
    );
  }

  // task / template
  return (
    <rect
      x={node.x}
      y={node.y}
      width={w}
      height={h}
      rx={r}
      fill={fillColor}
      stroke={strokeColor}
      strokeWidth={2}
      strokeDasharray={node.type === 'template' ? '6 3' : undefined}
    />
  );
}

// ── 进度条组件 ──────────────────────────────────────────────


// ── 节点结果卡片 ────────────────────────────────────────────


// ── 主组件 ──────────────────────────────────────────────────

export interface FlowExecutionViewProps {
  initialFlow?: Flow;
  className?: string;
}

export default function FlowExecutionView({ initialFlow }: FlowExecutionViewProps) {
  // ── 状态 ──
  const [templateId, setTemplateId] = useState('tpl_linear');
  const [baseFlow] = useState<Flow>(() => initialFlow ?? BUILTIN_TEMPLATES[0].flow);
  const [flow, setFlow] = useState<Flow>(() => initialFlow ?? BUILTIN_TEMPLATES[0].flow);
  const [executionOrder, setExecutionOrder] = useState<string[]>(() => computeExecutionOrder(initialFlow ?? BUILTIN_TEMPLATES[0].flow));
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [results, setResults] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1000);
  const [isComplete, setIsComplete] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── 模板切换 ──
  const switchTemplate = useCallback((id: string) => {
    const tpl = BUILTIN_TEMPLATES.find((t) => t.id === id);
    if (!tpl) return;
    setTemplateId(id);
    setFlow({ ...tpl.flow, created: Date.now() });
    setExecutionOrder(computeExecutionOrder(tpl.flow));
    setCurrentIndex(-1);
    setResults({});
    setErrors({});
    setIsPlaying(false);
    setIsComplete(false);
  }, []);

  // ── 重置 ──
  const reset = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setFlow({ ...baseFlow, created: Date.now() });
    setExecutionOrder(computeExecutionOrder(baseFlow));
    setCurrentIndex(-1);
    setResults({});
    setErrors({});
    setIsPlaying(false);
    setIsComplete(false);
  }, [baseFlow]);

  // ── 执行步骤 ──
  const stepForward = useCallback(() => {
    if (isComplete) return;

    const nextIndex = currentIndex + 1;
    if (nextIndex >= executionOrder.length) {
      setIsComplete(true);
      setIsPlaying(false);
      return;
    }

    const nodeId = executionOrder[nextIndex];
    const node = flow.nodes.find((n) => n.id === nodeId);
    if (!node) return;

    // 更新节点状态为 running
    setFlow((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) => (n.id === nodeId ? { ...n, status: 'running' } : n)),
    }));

    // 模拟延迟后完成
    setTimeout(() => {
      // 10% 概率失败
      const failed = node.type !== 'input' && node.type !== 'output' && Math.random() < 0.1;
      const status: NodeStatus = failed ? 'failed' : 'completed';

      setFlow((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) => (n.id === nodeId ? { ...n, status } : n)),
      }));

      if (failed) {
        setErrors((prev) => ({ ...prev, [nodeId]: `${node.label} 执行失败` }));
        setIsPlaying(false);
        setIsComplete(true);
      } else {
        setResults((prev) => ({ ...prev, [nodeId]: simulateResult(node) }));
      }

      setCurrentIndex(nextIndex);

      if (nextIndex === executionOrder.length - 1 && !failed) {
        setIsComplete(true);
        setIsPlaying(false);
      }
    }, 300);
  }, [currentIndex, executionOrder, flow, isComplete]);

  // ── 自动播放 ──
  useEffect(() => {
    if (!isPlaying || isComplete) return;

    timerRef.current = setTimeout(stepForward, speed);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPlaying, isComplete, stepForward, speed]);

  // ── 当前执行节点 ──
  const currentNodeId = currentIndex >= 0 ? executionOrder[currentIndex] : null;
  const currentNode = currentNodeId ? flow.nodes.find((n) => n.id === currentNodeId) : undefined;

  // ── 统计 ──
  const completedCount = flow.nodes.filter((n) => n.status === 'completed').length;
  const failedCount = flow.nodes.filter((n) => n.status === 'failed').length;
  const hasFailed = failedCount > 0;

  // ── 画布变换 ──
  const scale = 0.85;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#111827' }}>
      {/* 顶部工具栏 */}
      <ExecutionPlaybackControls
        templateId={templateId}
        onTemplateChange={switchTemplate}
        speed={speed}
        onSpeedChange={setSpeed}
        isPlaying={isPlaying}
        isComplete={isComplete}
        hasFailed={hasFailed}
        onPlayPause={() => setIsPlaying(!isPlaying)}
        onStepForward={stepForward}
        onReset={reset}
      />

      {/* 主体区域 */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* SVG 画布 */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <svg width="100%" height="100%" style={{ background: '#030712' }}>
            <defs>
              <marker id="exec-arrow" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#6b7280" />
              </marker>
              <marker id="exec-arrow-active" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#3b82f6" />
              </marker>
              <filter id="exec-glow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id={SVG_SHADOW_ID} x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="4" floodOpacity="0.3" />
              </filter>
              <pattern id="exec-grid" width={GRID_SIZE} height={GRID_SIZE} patternUnits="userSpaceOnUse">
                <path d={`M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}`} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
              </pattern>

              {/* 脉冲动画 */}
              <style>{`
                @keyframes exec-pulse {
                  0%, 100% { opacity: 0.6; transform: scale(1); }
                  50% { opacity: 1; transform: scale(1.05); }
                }
                .exec-running { animation: exec-pulse 1.5s ease-in-out infinite; }
              `}</style>
            </defs>

            {/* 网格背景 */}
            <rect width="100%" height="100%" fill="url(#exec-grid)" />

            {/* 可缩放内容 */}
            <g style={{ transform: `scale(${scale})`, transformOrigin: '0 0' }}>
              {/* 透明背景层 */}
              <rect
                x={-CANVAS_PAD}
                y={-CANVAS_PAD}
                width={CANVAS_WIDTH + CANVAS_PAD * 2}
                height={CANVAS_HEIGHT + CANVAS_PAD * 2}
                fill="transparent"
              />

              {/* ── 边层 ── */}
              <g>
                {flow.edges.map((edge) => {
                  const src = flow.nodes.find((n) => n.id === edge.source);
                  const tgt = flow.nodes.find((n) => n.id === edge.target);
                  if (!src || !tgt) return null;

                  const path = computeEdgePath(src, tgt, edge.sourceHandle);

                  // 判断是否激活（源和目标都已执行或正在执行）
                  const srcDone = src.status === 'completed' || src.status === 'running' || src.status === 'failed';
                  const isActive = srcDone;

                  return (
                    <path
                      key={edge.id}
                      d={path}
                      fill="none"
                      stroke={isActive ? '#3b82f6' : '#374151'}
                      strokeWidth={isActive ? 2 : 1}
                      markerEnd={isActive ? 'url(#exec-arrow-active)' : 'url(#exec-arrow)'}
                      style={isActive ? { transition: 'all 0.3s ease-out' } : undefined}
                    />
                  );
                })}
              </g>

              {/* ── 节点层 ── */}
              <g>
                {flow.nodes.map((node) => {
                  const colors = NODE_COLORS[node.type];
                  const status = node.status ?? 'idle';
                  const sc = STEP_COLORS[status];
                  const isActive = status === 'running';
                  const isCurrent = node.id === currentNodeId;

                  return (
                    <g
                      key={node.id}
                      className={isActive ? 'exec-running' : ''}
                      filter={isCurrent ? `url(#exec-glow)` : undefined}
                    >
                      {/* 执行状态高亮 */}
                      {isCurrent && (
                        <rect
                          x={node.x - 4}
                          y={node.y - 4}
                          width={NODE_WIDTH[node.type] + 8}
                          height={NODE_HEIGHT[node.type] + 8}
                          rx={NODE_RADIUS[node.type] + 3}
                          fill="none"
                          stroke={sc.stroke}
                          strokeWidth={1}
                          strokeDasharray="4 2"
                          opacity={0.6}
                        />
                      )}

                      {/* 节点形状 */}
                      <ExecNodeShape
                        node={node}
                        strokeColor={status === 'idle' ? colors.border : sc.stroke}
                        fillColor={status === 'idle' ? colors.bg : sc.fill}
                      />

                      {/* 节点标签 */}
                      <text
                        x={node.x + NODE_WIDTH[node.type] / 2}
                        y={node.y + NODE_HEIGHT[node.type] / 2 - 4}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill={status === 'idle' ? colors.text : sc.stroke}
                        fontSize="11"
                        fontWeight="500"
                      >
                        {node.label.length > 12 ? node.label.slice(0, 12) + '…' : node.label}
                      </text>

                      {/* 状态标签 */}
                      <text
                        x={node.x + NODE_WIDTH[node.type] / 2}
                        y={node.y + NODE_HEIGHT[node.type] / 2 + 10}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="#6b7280"
                        fontSize="9"
                      >
                        {sc.icon} {status === 'idle' ? NODE_TYPE_LABELS[node.type] : status}
                      </text>

                      {/* 结果气泡 */}
                      {(results[node.id] || errors[node.id]) && (
                        <g>
                          <rect
                            x={node.x + NODE_WIDTH[node.type] / 2 - 50}
                            y={node.y + NODE_HEIGHT[node.type] + 6}
                            width={100}
                            height={20}
                            rx={4}
                            fill={errors[node.id] ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)'}
                            stroke={errors[node.id] ? '#ef4444' : '#10b981'}
                            strokeWidth={0.5}
                          />
                          <text
                            x={node.x + NODE_WIDTH[node.type] / 2}
                            y={node.y + NODE_HEIGHT[node.type] + 19}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fill={errors[node.id] ? '#f87171' : '#6ee7b7'}
                            fontSize="9"
                          >
                            {(errors[node.id] ?? results[node.id] ?? '').slice(0, 16)}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}
              </g>
            </g>
          </svg>
        </div>

        {/* 右侧结果面板 */}
        <div style={{
          width: 256,
          flexShrink: 0,
          borderLeft: '1px solid rgba(255,255,255,0.1)',
          background: 'rgba(17,24,39,0.5)',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* 执行状态 */}
          <div style={{ padding: 12, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: isComplete
                    ? hasFailed ? '#EF4444' : '#22C55E'
                    : isPlaying ? '#3B82F6' : '#6B7280',
                }}
              />
              <span style={{ fontSize: 12, fontWeight: 500, color: '#CBD5E1' }}>
                {isComplete ? (hasFailed ? '执行失败' : '执行完成') : isPlaying ? '执行中' : '就绪'}
              </span>
            </div>
            <ExecutionProgressBar
              current={completedCount + failedCount}
              total={flow.nodes.length}
              statusLabel={isComplete ? (hasFailed ? 'failed' : 'completed') : isPlaying ? 'running' : 'pending'}
            />
          </div>

          {/* 当前节点信息 */}
          {currentNode && (
            <div style={{ padding: 12, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ fontSize: 10, color: '#6B7280', marginBottom: 4 }}>当前节点</div>
              <div style={{ fontSize: 12, color: '#CBD5E1', fontWeight: 500, marginBottom: 2 }}>{currentNode.label}</div>
              <div style={{ fontSize: 10, color: '#9CA3AF' }}>{NODE_TYPE_LABELS[currentNode.type]}</div>
              {currentNode.config && (
                <div style={{
                  marginTop: 8,
                  padding: 8,
                  borderRadius: 4,
                  background: 'rgba(30,41,59,0.5)',
                  border: '1px solid rgba(255,255,255,0.05)',
                }}>
                  {Object.entries(currentNode.config).map(([k, v]) => (
                    <div key={k} style={{ fontSize: 10 }}>
                      <span style={{ color: '#6B7280' }}>{k}: </span>
                      <span style={{ color: '#CBD5E1' }}>{v}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 执行结果列表 */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
            <div style={{ fontSize: 10, color: '#6B7280', marginBottom: 8 }}>执行结果</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {executionOrder.map((nodeId) => {
                const node = flow.nodes.find((n) => n.id === nodeId);
                if (!node) return null;
                if (node.status === 'idle' || node.status === 'pending') return null;

                return (
                  <ExecutionResultCard
                    key={nodeId}
                    node={node}
                    result={results[nodeId]}
                    error={errors[nodeId]}
                  />
                );
              })}
              {executionOrder.every((id) => {
                const n = flow.nodes.find((nd) => nd.id === id);
                return !n || n.status === 'idle' || n.status === 'pending';
              }) && (
                <div style={{ fontSize: 10, color: '#6B7280', textAlign: 'center', padding: '16px 0' }}>
                  点击播放或步进开始执行
                </div>
              )}
            </div>
          </div>

          {/* 图例 */}
          <div style={{ padding: 12, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ fontSize: 10, color: '#6B7280', marginBottom: 6 }}>图例</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
              {(['running', 'completed', 'failed', 'idle'] as const).map((status) => {
                const sc = STEP_COLORS[status];
                return (
                  <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: sc.stroke }} />
                    <span style={{ color: '#9CA3AF' }}>{status}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 底部状态栏 */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 16px',
        background: 'rgba(17,24,39,0.9)',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        fontSize: 10,
        color: '#6B7280',
        flexShrink: 0,
      }}>
        <span>{flow.name} · {flow.nodes.length} 节点 · {flow.edges.length} 连接</span>
        <span>
          完成 {completedCount} · 失败 {failedCount} · 待执行 {flow.nodes.length - completedCount - failedCount}
        </span>
      </div>
    </div>
  );
}
