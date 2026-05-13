/**
 * FlowPropertiesPanel — 选中节点的属性编辑面板
 * Extracted from VisualFlowBuilder.tsx
 */

import { useState } from 'react';
import { NODE_COLORS, STEP_COLORS, NODE_TYPE_LABELS, type FlowNode } from './FlowTypes';

export interface FlowPropertiesPanelProps {
  node: FlowNode;
  onLabelChange: (label: string) => void;
  onClose: () => void;
}

export function FlowPropertiesPanel({
  node,
  onLabelChange,
  onClose,
}: FlowPropertiesPanelProps) {
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
