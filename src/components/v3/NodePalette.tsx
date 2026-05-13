/**
 * NodePalette — 流程节点拖拽面板
 * Extracted from VisualFlowBuilder.tsx
 */

import { useState } from 'react';
import { NODE_COLORS, type NodeType } from './FlowTypes';

export const PALETTE_ITEMS: { type: NodeType; label: string; desc: string }[] = [
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

export function NodePalette() {
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
