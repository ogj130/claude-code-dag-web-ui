/**
 * VisualFlowBuilder — 可视化流程构建器 (V3)
 *
 * 自定义 SVG 画布实现，支持 5 种节点类型的拖拽式流程设计。
 * 包含 3 个内置模板、实时执行可视化、条件分支展示。
 * 所有样式使用内联 style + CSS 变量（本项目未安装 Tailwind CSS）。
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  NODE_WIDTH,
  NODE_HEIGHT,
  NODE_RADIUS,
  NODE_COLORS,
  getNodePorts,
  CANVAS_PAD,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  GRID_SIZE,
  SVG_SHADOW_ID,
  computeEdgePath,
  computeEdgeLabelPosition,
  STEP_COLORS,
  type NodeType,
  type FlowNode,
  type FlowEdge,
  type Flow,
} from './FlowTypes';
import { getAllTasks, createTask } from '../../services/agentOrchestrator';

// ── 工具函数 ────────────────────────────────────────────────

let _idCounter = 0;
function uid(prefix: string): string {
  return `${prefix}_${Date.now()}_${++_idCounter}`;
}

const NODE_TYPE_LABELS: Record<NodeType, string> = {
  task: '任务',
  decision: '决策',
  input: '输入',
  output: '输出',
  template: '模板',
};

// ── 节点形状渲染 ────────────────────────────────────────────

function NodeShape({
  node,
  colors,
  selected,
}: {
  node: FlowNode;
  colors: typeof NODE_COLORS[NodeType];
  selected: boolean;
}) {
  const w = NODE_WIDTH[node.type];
  const h = NODE_HEIGHT[node.type];
  const r = NODE_RADIUS[node.type];
  const statusStyle = node.status && node.status !== 'idle' ? STEP_COLORS[node.status] : null;

  const baseStroke = statusStyle ? statusStyle.stroke : selected ? '#fff' : colors.border;
  const baseBg = statusStyle ? statusStyle.fill : colors.bg;

  if (node.type === 'decision') {
    const cx = node.x + w / 2;
    const cy = node.y + h / 2;
    const d = `M${cx},${node.y} L${node.x + w},${cy} L${cx},${node.y + h} L${node.x},${cy} Z`;
    return (
      <path
        d={d}
        fill={baseBg}
        stroke={baseStroke}
        strokeWidth={selected ? 2 : 1.5}
        filter={selected ? `url(#${SVG_SHADOW_ID})` : undefined}
      />
    );
  }

  if (node.type === 'input' || node.type === 'output') {
    return (
      <rect
        x={node.x}
        y={node.y}
        width={w}
        height={h}
        rx={r}
        fill={baseBg}
        stroke={baseStroke}
        strokeWidth={selected ? 2 : 1.5}
        filter={selected ? `url(#${SVG_SHADOW_ID})` : undefined}
      />
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
      fill={baseBg}
      stroke={baseStroke}
      strokeWidth={selected ? 2 : 1.5}
      strokeDasharray={node.type === 'template' ? '6 3' : undefined}
      filter={selected ? `url(#${SVG_SHADOW_ID})` : undefined}
    />
  );
}

// ── 节点端口渲染 ────────────────────────────────────────────

function NodePorts({
  node,
  colors,
}: {
  node: FlowNode;
  colors: typeof NODE_COLORS[NodeType];
}) {
  const ports = getNodePorts(node);
  const portR = 5;

  const elements: JSX.Element[] = [];

  // 输入端口（非 input 类型）
  if (node.type !== 'input') {
    const [px, py] = ports.input;
    elements.push(
      <circle
        key="in"
        cx={px}
        cy={py}
        r={portR}
        fill={colors.border}
        stroke="#1f2937"
        strokeWidth={1.5}
        style={{ cursor: 'crosshair' }}
      />,
    );
  }

  // 输出端口（非 output 类型）
  if (node.type !== 'output') {
    const [px, py] = ports.output;
    elements.push(
      <circle
        key="out"
        cx={px}
        cy={py}
        r={portR}
        fill={colors.border}
        stroke="#1f2937"
        strokeWidth={1.5}
        style={{ cursor: 'crosshair' }}
      />,
    );
  }

  // 决策 false 端口
  if (node.type === 'decision' && ports.false) {
    const [px, py] = ports.false;
    elements.push(
      <circle
        key="false"
        cx={px}
        cy={py}
        r={portR}
        fill="#ef4444"
        stroke="#1f2937"
        strokeWidth={1.5}
        style={{ cursor: 'crosshair' }}
      />,
    );
  }

  return <g>{elements}</g>;
}

// ── 节点标签渲染 ────────────────────────────────────────────

function NodeLabel({
  node,
  colors,
  editingId,
  onDoubleClick,
  onEditSubmit,
}: {
  node: FlowNode;
  colors: typeof NODE_COLORS[NodeType];
  editingId: string | null;
  onDoubleClick: () => void;
  onEditSubmit: (value: string) => void;
}) {
  const w = NODE_WIDTH[node.type];
  const h = NODE_HEIGHT[node.type];
  const cx = node.x + w / 2;
  const cy = node.y + h / 2;

  if (editingId === node.id) {
    return (
      <foreignObject x={node.x} y={node.y} width={w} height={h} style={{ pointerEvents: 'auto' }}>
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '4px',
          }}
        >
          <textarea
            defaultValue={node.label}
            autoFocus
            style={{
              width: '100%',
              background: '#1e293b',
              color: '#e2e8f0',
              border: `1px solid ${colors.border}`,
              borderRadius: '4px',
              fontSize: '11px',
              textAlign: 'center',
              resize: 'none',
              padding: '2px 4px',
              outline: 'none',
              fontFamily: 'inherit',
            }}
            onBlur={(e) => onEditSubmit(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onEditSubmit(e.currentTarget.value);
              }
              if (e.key === 'Escape') onEditSubmit(node.label);
            }}
          />
        </div>
      </foreignObject>
    );
  }

  return (
    <g onDoubleClick={onDoubleClick} style={{ cursor: 'text' }}>
      <text
        x={cx}
        y={cy - 3}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={colors.text}
        fontSize="12"
        fontWeight="500"
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {node.label.length > 14 ? node.label.slice(0, 14) + '…' : node.label}
      </text>
      <text
        x={cx}
        y={cy + 11}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#6b7280"
        fontSize="9"
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {NODE_TYPE_LABELS[node.type]}
      </text>
    </g>
  );
}

// ── 连接线渲染 ──────────────────────────────────────────────

function EdgePath({
  edge,
  sourceNode,
  targetNode,
  selected,
  onClick,
}: {
  edge: FlowEdge;
  sourceNode: FlowNode;
  targetNode: FlowNode;
  selected: boolean;
  onClick: () => void;
}) {
  const path = computeEdgePath(sourceNode, targetNode, edge.sourceHandle);
  const labelPos = computeEdgeLabelPosition(sourceNode, targetNode, edge.sourceHandle);

  return (
    <g onClick={onClick} style={{ cursor: 'pointer' }}>
      {/* 隐形宽路径用于点击检测 */}
      <path d={path} fill="none" stroke="transparent" strokeWidth={12} />

      {/* 可见路径 */}
      <path
        d={path}
        fill="none"
        stroke={selected ? '#60a5fa' : edge.sourceHandle === 'false' ? '#ef4444' : '#6b7280'}
        strokeWidth={selected ? 2 : 1.5}
        markerEnd="url(#arrowhead)"
        style={selected ? undefined : { transition: 'color 0.15s ease-out' }}
      />

      {/* 条件标签 */}
      {edge.sourceHandle && edge.label && (
        <>
          <rect
            x={labelPos.x - 16}
            y={labelPos.y - 9}
            width={32}
            height={18}
            rx={4}
            fill={edge.sourceHandle === 'true' ? '#10b981' : '#ef4444'}
            opacity={0.15}
          />
          <text
            x={labelPos.x}
            y={labelPos.y + 1}
            textAnchor="middle"
            dominantBaseline="middle"
            fill={edge.sourceHandle === 'true' ? '#34d399' : '#f87171'}
            fontSize="10"
            fontWeight="600"
          >
            {edge.label}
          </text>
        </>
      )}
    </g>
  );
}

// ── 内置模板 ────────────────────────────────────────────────

const BUILTIN_TEMPLATES: { id: string; name: string; description: string; flow: Flow }[] = [
  {
    id: 'tpl_linear',
    name: '线性任务流',
    description: '简单的输入 → 分析 → 生成 → 输出流水线',
    flow: {
      name: '线性任务流',
      description: '经典的四步线性流程',
      created: Date.now(),
      nodes: [
        { id: 'n1', type: 'input', label: '用户输入', x: 60, y: 180, status: 'idle' },
        { id: 'n2', type: 'task', label: '代码分析', x: 260, y: 170, status: 'idle', config: { command: 'analyze' } },
        { id: 'n3', type: 'task', label: '代码生成', x: 500, y: 170, status: 'idle', config: { command: 'generate' } },
        { id: 'n4', type: 'output', label: '最终输出', x: 740, y: 180, status: 'idle' },
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2' },
        { id: 'e2', source: 'n2', target: 'n3' },
        { id: 'e3', source: 'n3', target: 'n4' },
      ],
    },
  },
  {
    id: 'tpl_decision',
    name: '条件分支流',
    description: '包含决策节点的条件分支流程',
    flow: {
      name: '条件分支流',
      description: '支持条件判断的分支流程，包含成功和错误处理路径',
      created: Date.now(),
      nodes: [
        { id: 'n1', type: 'input', label: '任务输入', x: 40, y: 140, status: 'idle' },
        { id: 'n2', type: 'task', label: '预处理', x: 220, y: 130, status: 'idle', config: { command: 'preprocess' } },
        {
          id: 'n3',
          type: 'decision',
          label: '质量检查',
          x: 430,
          y: 110,
          status: 'idle',
          config: { condition: 'quality > 0.8' },
        },
        { id: 'n4', type: 'task', label: '优化处理', x: 600, y: 60, status: 'idle', config: { command: 'optimize' } },
        { id: 'n5', type: 'task', label: '错误处理', x: 600, y: 240, status: 'idle', config: { command: 'error_handle' } },
        { id: 'n6', type: 'output', label: '成功输出', x: 820, y: 70, status: 'idle' },
        { id: 'n7', type: 'output', label: '错误报告', x: 820, y: 250, status: 'idle' },
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2' },
        { id: 'e2', source: 'n2', target: 'n3' },
        { id: 'e3', source: 'n3', target: 'n4', sourceHandle: 'true', label: 'true' },
        { id: 'e4', source: 'n3', target: 'n5', sourceHandle: 'false', label: 'false' },
        { id: 'e5', source: 'n4', target: 'n6' },
        { id: 'e6', source: 'n5', target: 'n7' },
      ],
    },
  },
  {
    id: 'tpl_pipeline',
    name: '数据流水线',
    description: '多阶段数据处理流水线',
    flow: {
      name: '数据流水线',
      description: '采集 → 清洗 → 分析 → 汇报的四阶段数据处理流水线',
      created: Date.now(),
      nodes: [
        { id: 'n1', type: 'input', label: '数据源', x: 40, y: 180, status: 'idle' },
        { id: 'n2', type: 'template', label: '数据采集', x: 220, y: 170, status: 'idle', config: { template: 'collector' } },
        { id: 'n3', type: 'template', label: '数据清洗', x: 440, y: 170, status: 'idle', config: { template: 'cleaner' } },
        { id: 'n4', type: 'task', label: '统计分析', x: 660, y: 170, status: 'idle', config: { command: 'analyze_stats' } },
        { id: 'n5', type: 'output', label: '分析报告', x: 880, y: 180, status: 'idle' },
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2' },
        { id: 'e2', source: 'n2', target: 'n3' },
        { id: 'e3', source: 'n3', target: 'n4' },
        { id: 'e4', source: 'n4', target: 'n5' },
      ],
    },
  },
];

// ── 空画布 ─────────────────────────────────────────────────────

const EMPTY_FLOW: Flow = {
  name: '新建流程',
  description: '',
  created: Date.now(),
  nodes: [],
  edges: [],
};

// ── 工具栏组件 ──────────────────────────────────────────────

function Toolbar({
  templateId,
  onTemplateChange,
  onDelete,
  onReset,
  onSave,
}: {
  templateId: string;
  onTemplateChange: (id: string) => void;
  onDelete: () => void;
  onReset: () => void;
  onSave: () => void;
}) {
  const [hoverDelete, setHoverDelete] = useState(false);
  const [hoverReset, setHoverReset] = useState(false);
  const [hoverSave, setHoverSave] = useState(false);

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 20,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 16px',
      background: 'rgba(17,24,39,0.9)',
      borderBottom: '1px solid rgba(255,255,255,0.1)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <h3 style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#fff' }}>流程构建器</h3>
        <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)' }} />
        <label style={{ fontSize: 10, color: '#6B7280' }}>模板</label>
        <select
          value={templateId}
          onChange={(e) => onTemplateChange(e.target.value)}
          style={{
            background: '#1E293B',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 4,
            padding: '4px 8px',
            fontSize: 10,
            color: '#CBD5E1',
            outline: 'none',
            fontFamily: 'inherit',
          }}
        >
          <option value="">空白画布</option>
          {BUILTIN_TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={onSave}
          style={{
            padding: '4px 10px',
            fontSize: 10,
            color: hoverSave ? '#34D399' : 'rgba(52,211,153,0.6)',
            background: hoverSave ? 'rgba(52,211,153,0.1)' : 'rgba(255,255,255,0.05)',
            borderRadius: 4,
            cursor: 'pointer',
            fontFamily: 'inherit',
            border: '1px solid rgba(52,211,153,0.2)',
            transition: 'all 0.15s ease-out',
          }}
          onMouseEnter={() => setHoverSave(true)}
          onMouseLeave={() => setHoverSave(false)}
        >
          保存流程
        </button>
        <button
          onClick={onDelete}
          style={{
            padding: '4px 8px',
            fontSize: 10,
            color: hoverDelete ? '#F87171' : 'rgba(248,113,113,0.6)',
            background: hoverDelete ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)',
            borderRadius: 4,
            cursor: 'pointer',
            fontFamily: 'inherit',
            border: 'none',
            transition: 'all 0.15s ease-out',
          }}
          onMouseEnter={() => setHoverDelete(true)}
          onMouseLeave={() => setHoverDelete(false)}
        >
          删除选中
        </button>
        <button
          onClick={onReset}
          style={{
            padding: '4px 8px',
            fontSize: 10,
            color: hoverReset ? '#CBD5E1' : '#9CA3AF',
            background: hoverReset ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)',
            borderRadius: 4,
            cursor: 'pointer',
            fontFamily: 'inherit',
            border: 'none',
            transition: 'all 0.15s ease-out',
          }}
          onMouseEnter={() => setHoverReset(true)}
          onMouseLeave={() => setHoverReset(false)}
        >
          重置
        </button>
      </div>
    </div>
  );
}

// ── 节点面板组件 ────────────────────────────────────────────

const PALETTE_ITEMS: { type: NodeType; label: string; desc: string }[] = [
  { type: 'input', label: '输入', desc: '流程入口节点' },
  { type: 'task', label: '任务', desc: '执行具体操作' },
  { type: 'decision', label: '决策', desc: '条件分支判断' },
  { type: 'template', label: '模板', desc: '引用流程模板' },
  { type: 'output', label: '输出', desc: '流程出口节点' },
];

function PaletteItem({ item }: { item: typeof PALETTE_ITEMS[number] }) {
  const colors = NODE_COLORS[item.type];
  const [isHover, setIsHover] = useState(false);

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/flow-node-type', item.type);
        e.dataTransfer.effectAllowed = 'copy';
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        borderRadius: 8,
        border: `1px solid ${colors.border}40`,
        background: isHover ? 'rgba(255,255,255,0.05)' : colors.bg,
        cursor: 'grab',
        transition: 'all 0.15s ease-out',
      }}
      onMouseEnter={() => setIsHover(true)}
      onMouseLeave={() => setIsHover(false)}
    >
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: colors.border }} />
      <div>
        <div style={{ fontSize: 11, fontWeight: 500, color: colors.text }}>
          {item.label}
        </div>
        <div style={{ fontSize: 9, color: '#6B7280' }}>{item.desc}</div>
      </div>
    </div>
  );
}

function NodePalette() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h4 style={{
        fontSize: 10,
        color: '#6B7280',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        margin: 0,
      }}>
        节点类型
      </h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {PALETTE_ITEMS.map((item) => (
          <PaletteItem key={item.type} item={item} />
        ))}
      </div>
    </div>
  );
}

// ── 属性面板组件 ────────────────────────────────────────────

function PropertiesPanel({
  node,
  onLabelChange,
  onClose,
}: {
  node: FlowNode;
  onLabelChange: (label: string) => void;
  onClose: () => void;
}) {
  const colors = NODE_COLORS[node.type];
  const [inputHover] = useState(false);

  return (
    <div
      style={{
        position: 'absolute',
        top: 48,
        right: 0,
        bottom: 0,
        width: 224,
        zIndex: 20,
        padding: 16,
        background: 'rgba(17,24,39,0.95)',
        borderLeft: '1px solid rgba(255,255,255,0.1)',
        overflowY: 'auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h4 style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#fff' }}>节点属性</h4>
        <button
          onClick={onClose}
          style={{
            color: '#6B7280',
            fontSize: 12,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'inherit',
            padding: 0,
            lineHeight: 1,
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#CBD5E1'; }}
          onMouseLeave={e => { e.currentTarget.style.color = '#6B7280'; }}
        >
          ✕
        </button>
      </div>

      {/* 类型标签 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: colors.border }} />
        <span
          style={{
            fontSize: 10,
            padding: '2px 8px',
            borderRadius: 4,
            color: colors.text,
            background: colors.bg,
            border: `1px solid ${colors.border}40`,
          }}
        >
          {NODE_TYPE_LABELS[node.type]}
        </span>
      </div>

      {/* 名称编辑 */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 10, color: '#6B7280', display: 'block', marginBottom: 4 }}>名称</label>
        <input
          type="text"
          value={node.label}
          onChange={(e) => onLabelChange(e.target.value)}
          style={{
            width: '100%',
            background: '#1E293B',
            border: `1px solid ${inputHover ? 'rgba(59,130,246,0.5)' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: 4,
            padding: '6px 8px',
            fontSize: 12,
            color: '#CBD5E1',
            outline: 'none',
            fontFamily: 'inherit',
            boxSizing: 'border-box',
            transition: 'border-color 0.15s ease-out',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)'; }}
          onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
        />
      </div>

      {/* 位置信息 */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 10, color: '#6B7280', display: 'block', marginBottom: 4 }}>位置</label>
        <div style={{ fontSize: 10, color: '#9CA3AF', fontFamily: '"JetBrains Mono", monospace' }}>
          x: {Math.round(node.x)} y: {Math.round(node.y)}
        </div>
      </div>

      {/* 配置信息 */}
      {node.config && (
        <div>
          <label style={{ fontSize: 10, color: '#6B7280', display: 'block', marginBottom: 4 }}>配置</label>
          <div style={{
            padding: 8,
            borderRadius: 4,
            background: 'rgba(30,41,59,0.5)',
            border: '1px solid rgba(255,255,255,0.05)',
          }}>
            {Object.entries(node.config).map(([k, v]) => (
              <div key={k} style={{ fontSize: 10, marginBottom: 4 }}>
                <span style={{ color: '#6B7280' }}>{k}: </span>
                <span style={{ color: '#CBD5E1' }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 状态 */}
      {node.status && node.status !== 'idle' && (
        <div style={{ marginTop: 12 }}>
          <label style={{ fontSize: 10, color: '#6B7280', display: 'block', marginBottom: 4 }}>执行状态</label>
          <span
            style={{
              fontSize: 10,
              padding: '2px 8px',
              borderRadius: 4,
              display: 'inline-block',
              color: STEP_COLORS[node.status].stroke,
              background: STEP_COLORS[node.status].fill,
            }}
          >
            {STEP_COLORS[node.status].icon} {node.status}
          </span>
        </div>
      )}
    </div>
  );
}

// ── 主组件 ──────────────────────────────────────────────────

export interface VisualFlowBuilderProps {
  initialFlow?: Flow;
  className?: string;
}

export default function VisualFlowBuilder({ initialFlow }: VisualFlowBuilderProps) {
  // ── 状态 ──
  const [currentFlow, setCurrentFlow] = useState<Flow>(() => initialFlow ?? { ...EMPTY_FLOW, created: Date.now() });
  const [templateId, setTemplateId] = useState('');
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const [canvasScale, setCanvasScale] = useState(0.9);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [dragNewEdge, setDragNewEdge] = useState<{
    sourceId: string;
    handle: 'output' | 'true' | 'false';
    x: number;
    y: number;
  } | null>(null);

  // ── Refs ──
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<{ nodeId: string; offsetX: number; offsetY: number } | null>(null);
  const panning = useRef<{ startX: number; startY: number; offsetX: number; offsetY: number } | null>(null);

  // ── 查找辅助 ──
  const nodeById = useCallback(
    (id: string) => currentFlow.nodes.find((n) => n.id === id),
    [currentFlow],
  );

  // ── 模板加载 ──
  const loadTemplate = useCallback(
    (id: string) => {
      if (!id) {
        // 空白画布
        setTemplateId('');
        setCurrentFlow({ ...EMPTY_FLOW, created: Date.now() });
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
        return;
      }
      const tpl = BUILTIN_TEMPLATES.find((t) => t.id === id);
      if (!tpl) return;
      setTemplateId(id);
      setCurrentFlow({ ...tpl.flow, created: Date.now() });
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
    },
    [],
  );

  // ── 从 agentOrchestrator 同步任务 ──
  useEffect(() => {
    try {
      const tasks = getAllTasks();
      if (tasks.length > 0) {
        // 有编排任务存在，可作为可选模板提示
        // 当前仅记录，不自动覆盖画布
        console.log('[FlowBuilder] Orchestration tasks available:', tasks.length);
      }
    } catch {
      // 默认使用空白画布
    }
  }, []);

  // ── 保存流程到 agentOrchestrator ──
  const handleSaveFlow = useCallback(() => {
    try {
      if (currentFlow.nodes.length === 0) {
        console.warn('[FlowBuilder] Cannot save empty flow');
        return;
      }
      const task = createTask(currentFlow.name || 'Flow Task', 'pipeline',
        currentFlow.nodes.map((node) => ({
          name: node.label,
          role: (node.type === 'decision' ? 'reviewer' : 'worker') as 'worker' | 'reviewer',
          taskDescription: node.config?.description ?? node.config?.command ?? node.type,
        })),
      );
      console.log('[FlowBuilder] Flow saved as task:', task.id);
      // 简短反馈
      alert(`流程已保存为任务: ${task.name}`);
    } catch (err) {
      console.warn('[FlowBuilder] Failed to save flow:', err);
    }
  }, [currentFlow]);

  // ── 节点操作 ──
  const addNode = useCallback(
    (type: NodeType, x: number, y: number) => {
      const newNode: FlowNode = {
        id: uid('n'),
        type,
        label: NODE_TYPE_LABELS[type],
        x,
        y,
        status: 'idle',
        config: type === 'decision' ? { condition: 'condition' } : type === 'template' ? { template: '' } : undefined,
      };
      setCurrentFlow((prev) => ({ ...prev, nodes: [...prev.nodes, newNode] }));
    },
    [],
  );

  const removeNode = useCallback(
    (id: string) => {
      setCurrentFlow((prev) => ({
        ...prev,
        nodes: prev.nodes.filter((n) => n.id !== id),
        edges: prev.edges.filter((e) => e.source !== id && e.target !== id),
      }));
      if (selectedNodeId === id) setSelectedNodeId(null);
    },
    [selectedNodeId],
  );

  const addEdge = useCallback(
    (sourceId: string, targetId: string, handle?: 'true' | 'false') => {
      const exists = currentFlow.edges.some(
        (e) => e.source === sourceId && e.target === targetId && e.sourceHandle === handle,
      );
      if (exists || sourceId === targetId) return;

      const newEdge: FlowEdge = {
        id: uid('e'),
        source: sourceId,
        target: targetId,
        sourceHandle: handle,
        label: handle === 'true' ? 'true' : handle === 'false' ? 'false' : undefined,
      };
      setCurrentFlow((prev) => ({ ...prev, edges: [...prev.edges, newEdge] }));
    },
    [currentFlow],
  );

  const removeEdge = useCallback(
    (id: string) => {
      setCurrentFlow((prev) => ({ ...prev, edges: prev.edges.filter((e) => e.id !== id) }));
      if (selectedEdgeId === id) setSelectedEdgeId(null);
    },
    [selectedEdgeId],
  );

  const deleteSelected = useCallback(() => {
    if (selectedNodeId) removeNode(selectedNodeId);
    else if (selectedEdgeId) removeEdge(selectedEdgeId);
  }, [selectedNodeId, selectedEdgeId, removeNode, removeEdge]);

  const resetFlow = useCallback(() => {
    loadTemplate(templateId);
  }, [templateId, loadTemplate]);

  // ── 画布交互 ──
  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as SVGElement;
      const targetTag = target.tagName.toLowerCase();
      const isBackground = targetTag === 'svg' || targetTag === 'rect';

      if (isBackground) {
        // 点击背景：取消选择 + 开始平移
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
        panning.current = { startX: e.clientX, startY: e.clientY, offsetX: canvasOffset.x, offsetY: canvasOffset.y };
        e.preventDefault();
      }
    },
    [canvasOffset],
  );

  const handleNodeMouseDown = useCallback(
    (nodeId: string, e: React.MouseEvent) => {
      const node = nodeById(nodeId);
      if (!node) return;

      // 选中并开始拖拽
      setSelectedNodeId(nodeId);
      setSelectedEdgeId(null);
      dragging.current = { nodeId, offsetX: e.clientX - node.x, offsetY: e.clientY - node.y };
      e.stopPropagation();
    },
    [nodeById],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (dragging.current) {
        // 拖拽节点
        const { nodeId, offsetX, offsetY } = dragging.current;
        const newX = (e.clientX - offsetX) / canvasScale - canvasOffset.x / canvasScale;
        const newY = (e.clientY - offsetY) / canvasScale - canvasOffset.y / canvasScale;
        setCurrentFlow((prev) => ({
          ...prev,
          nodes: prev.nodes.map((n) => (n.id === nodeId ? { ...n, x: newX, y: newY } : n)),
        }));
      } else if (panning.current) {
        // 平移画布
        const dx = e.clientX - panning.current.startX;
        const dy = e.clientY - panning.current.startY;
        setCanvasOffset({ x: panning.current.offsetX + dx, y: panning.current.offsetY + dy });
      } else if (dragNewEdge) {
        // 临时边跟随
        setDragNewEdge((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : null));
      }
    },
    [canvasScale, canvasOffset, dragNewEdge],
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (dragNewEdge && canvasRef.current) {
        // 检测目标端口
        const rect = canvasRef.current.getBoundingClientRect();
        const mx = (e.clientX - rect.left - canvasOffset.x) / canvasScale;
        const my = (e.clientY - rect.top - canvasOffset.y) / canvasScale;

        const target = currentFlow.nodes.find((n) => {
          if (n.id === dragNewEdge.sourceId) return false;
          const ports = getNodePorts(n);
          const [px, py] = ports.input;
          const dist = Math.sqrt((mx - px) ** 2 + (my - py) ** 2);
          return dist < 20;
        });

        if (target) {
          const handle = dragNewEdge.handle === 'output' ? undefined : dragNewEdge.handle;
          addEdge(dragNewEdge.sourceId, target.id, handle);
        }
        setDragNewEdge(null);
      }

      dragging.current = null;
      panning.current = null;
    },
    [dragNewEdge, canvasOffset, canvasScale, currentFlow, addEdge],
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      setCanvasScale((prev) => Math.min(2, Math.max(0.2, prev - e.deltaY * 0.001)));
    },
    [],
  );

  // ── 从面板拖入新节点 ──
  const handleCanvasDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleCanvasDrop = useCallback(
    (e: React.DragEvent) => {
      const nodeType = e.dataTransfer.getData('application/flow-node-type') as NodeType;
      if (!nodeType || !canvasRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const nx = (e.clientX - rect.left - canvasOffset.x) / canvasScale;
      const ny = (e.clientY - rect.top - canvasOffset.y) / canvasScale;

      addNode(nodeType, nx - NODE_WIDTH[nodeType] / 2, ny - NODE_HEIGHT[nodeType] / 2);
    },
    [canvasOffset, canvasScale, addNode],
  );

  // ── 节点编辑 ──
  const handleEditSubmit = useCallback(
    (value: string) => {
      if (editingNodeId && value.trim()) {
        setCurrentFlow((prev) => ({
          ...prev,
          nodes: prev.nodes.map((n) => (n.id === editingNodeId ? { ...n, label: value.trim() } : n)),
        }));
      }
      setEditingNodeId(null);
    },
    [editingNodeId],
  );

  const handleNodeLabelChange = useCallback(
    (label: string) => {
      if (selectedNodeId && label.trim()) {
        setCurrentFlow((prev) => ({
          ...prev,
          nodes: prev.nodes.map((n) => (n.id === selectedNodeId ? { ...n, label: label.trim() } : n)),
        }));
      }
    },
    [selectedNodeId],
  );

  // ── 键盘快捷键 ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && !editingNodeId) {
        deleteSelected();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [deleteSelected, editingNodeId]);

  // ── 画布变换 ──
  const canvasTransform = `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${canvasScale})`;

  // ── 节点渲染层 ──
  const nodesLayer = (
    <g>
      {currentFlow.nodes.map((node) => {
        const colors = NODE_COLORS[node.type];
        const isSelected = node.id === selectedNodeId;

        return (
          <g
            key={node.id}
            onMouseDown={(e) => handleNodeMouseDown(node.id, e)}
            style={{ cursor: dragging.current?.nodeId === node.id ? 'grabbing' : 'grab' }}
          >
            {/* 选中高亮 */}
            {isSelected && (
              <rect
                x={node.x - 6}
                y={node.y - 6}
                width={NODE_WIDTH[node.type] + 12}
                height={NODE_HEIGHT[node.type] + 12}
                rx={NODE_RADIUS[node.type] + 4}
                fill="none"
                stroke="#3b82f6"
                strokeWidth={1}
                strokeDasharray="4 2"
                opacity={0.5}
              />
            )}

            {/* 节点形状 */}
            <NodeShape node={node} colors={colors} selected={isSelected} />

            {/* 端口 */}
            <NodePorts node={node} colors={colors} />

            {/* 标签 */}
            <NodeLabel
              node={node}
              colors={colors}
              editingId={editingNodeId}
              onDoubleClick={() => setEditingNodeId(node.id)}
              onEditSubmit={handleEditSubmit}
            />
          </g>
        );
      })}
    </g>
  );

  // ── 边渲染层 ──
  const edgesLayer = (
    <g>
      {currentFlow.edges.map((edge) => {
        const src = nodeById(edge.source);
        const tgt = nodeById(edge.target);
        if (!src || !tgt) return null;

        return (
          <EdgePath
            key={edge.id}
            edge={edge}
            sourceNode={src}
            targetNode={tgt}
            selected={edge.id === selectedEdgeId}
            onClick={() => {
              setSelectedEdgeId(edge.id);
              setSelectedNodeId(null);
            }}
          />
        );
      })}

      {/* 正在创建的临时边 */}
      {dragNewEdge && canvasRef.current && (() => {
        const sourceNode = nodeById(dragNewEdge.sourceId);
        if (!sourceNode) return null;
        const ports = getNodePorts(sourceNode);
        let sx: number, sy: number;
        if (dragNewEdge.handle === 'false' && ports.false) [sx, sy] = ports.false;
        else if (dragNewEdge.handle === 'true' && ports.true) [sx, sy] = ports.true;
        else [sx, sy] = ports.output;

        const rect = canvasRef.current!.getBoundingClientRect();
        const tx = (dragNewEdge.x - rect.left - canvasOffset.x) / canvasScale;
        const ty = (dragNewEdge.y - rect.top - canvasOffset.y) / canvasScale;

        return (
          <line
            x1={sx}
            y1={sy}
            x2={tx}
            y2={ty}
            stroke="#60a5fa"
            strokeWidth={1.5}
            strokeDasharray="6 3"
            opacity={0.6}
            pointerEvents="none"
          />
        );
      })()}
    </g>
  );

  // ── 选中的节点（用于属性面板）──
  const selectedNode = selectedNodeId ? nodeById(selectedNodeId) : undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#111827', position: 'relative' }}>
      {/* 工具栏 */}
      <Toolbar
        templateId={templateId}
        onTemplateChange={loadTemplate}
        onDelete={deleteSelected}
        onReset={resetFlow}
        onSave={handleSaveFlow}
      />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* 左侧面板 */}
        <div style={{
          width: 176,
          flexShrink: 0,
          padding: 12,
          paddingTop: 56,
          borderRight: '1px solid rgba(255,255,255,0.1)',
          background: 'rgba(17,24,39,0.5)',
          overflowY: 'auto',
        }}>
          <NodePalette />
          <div style={{ marginTop: 16 }}>
            <h4 style={{
              fontSize: 10,
              color: '#6B7280',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              margin: '0 0 8px',
            }}>
              模板说明
            </h4>
            <p style={{
              fontSize: 10,
              color: '#9CA3AF',
              lineHeight: 1.6,
              margin: 0,
            }}>
              {BUILTIN_TEMPLATES.find((t) => t.id === templateId)?.description ?? '从上方工具栏选择模板'}
            </p>
          </div>
          <div style={{
            marginTop: 16,
            padding: 8,
            borderRadius: 4,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.05)',
          }}>
            <div style={{ fontSize: 9, color: '#6B7280', marginBottom: 4 }}>快捷键</div>
            <div style={{ fontSize: 9, color: '#9CA3AF', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div>Delete — 删除选中</div>
              <div>双击节点 — 编辑标签</div>
              <div>拖拽端口 — 创建连接</div>
              <div>滚轮 — 缩放画布</div>
            </div>
          </div>
        </div>

        {/* SVG 画布 */}
        <div
          ref={canvasRef}
          style={{
            flex: 1,
            position: 'relative',
            overflow: 'hidden',
          }}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          onDrop={handleCanvasDrop}
          onDragOver={handleCanvasDragOver}
        >
          <svg
            width="100%"
            height="100%"
            style={{ background: '#030712' }}
            onMouseDown={handleCanvasMouseDown}
          >
            <defs>
              {/* 箭头 */}
              <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#6b7280" />
              </marker>
              <marker id="arrowhead-selected" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#60a5fa" />
              </marker>

              {/* 阴影 */}
              <filter id={SVG_SHADOW_ID} x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="4" floodOpacity="0.3" />
              </filter>

              {/* 网格图案 */}
              <pattern id="grid-small" width={GRID_SIZE} height={GRID_SIZE} patternUnits="userSpaceOnUse">
                <path d={`M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}`} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
              </pattern>
              <pattern id="grid-large" width={GRID_SIZE * 5} height={GRID_SIZE * 5} patternUnits="userSpaceOnUse">
                <rect width={GRID_SIZE * 5} height={GRID_SIZE * 5} fill="url(#grid-small)" />
                <path d={`M ${GRID_SIZE * 5} 0 L 0 0 0 ${GRID_SIZE * 5}`} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
              </pattern>
            </defs>

            {/* 背景 + 网格 */}
            <rect width="100%" height="100%" fill="url(#grid-large)" onMouseDown={() => {
              setSelectedNodeId(null);
              setSelectedEdgeId(null);
            }} />

            {/* 可变换内容 */}
            <g style={{ transform: canvasTransform, transformOrigin: '0 0' }}>
              {/* 背景层（平移检测用） */}
              <rect
                x={-CANVAS_PAD}
                y={-CANVAS_PAD}
                width={CANVAS_WIDTH + CANVAS_PAD * 2}
                height={CANVAS_HEIGHT + CANVAS_PAD * 2}
                fill="transparent"
              />

              {edgesLayer}
              {nodesLayer}
            </g>
          </svg>
        </div>

        {/* 属性面板 */}
        {selectedNode && (
          <div style={{ position: 'relative' }}>
            <PropertiesPanel
              node={selectedNode}
              onLabelChange={handleNodeLabelChange}
              onClose={() => setSelectedNodeId(null)}
            />
          </div>
        )}
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
      }}>
        <span>
          {currentFlow.nodes.length} 节点 · {currentFlow.edges.length} 连接
        </span>
        <span>
          {currentFlow.name} · 缩放 {Math.round(canvasScale * 100)}%
        </span>
      </div>
    </div>
  );
}
