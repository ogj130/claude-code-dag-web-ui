/**
 * FlowBuilderToolbar — 流程构建器顶部工具栏
 * Extracted from VisualFlowBuilder.tsx
 */

import { useState } from 'react';
import { BUILTIN_TEMPLATES } from './FlowTemplates';

export interface FlowBuilderToolbarProps {
  templateId: string;
  onTemplateChange: (id: string) => void;
  onDelete: () => void;
  onReset: () => void;
  onSave: () => void;
  onClearConfig?: () => void;
  onSendToTerminal?: () => void;
  hasSavedOrchestration?: boolean;
}

export function FlowBuilderToolbar({
  templateId,
  onTemplateChange,
  onDelete,
  onReset,
  onSave,
  onClearConfig,
  onSendToTerminal,
  hasSavedOrchestration,
}: FlowBuilderToolbarProps) {
  const [hoverDelete, setHoverDelete] = useState(false);
  const [hoverReset, setHoverReset] = useState(false);
  const [hoverSave, setHoverSave] = useState(false);
  const [hoverClear, setHoverClear] = useState(false);
  const [hoverSend, setHoverSend] = useState(false);

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
        {onSendToTerminal && (
          <button
            onClick={onSendToTerminal}
            style={{
              padding: '4px 10px',
              fontSize: 10,
              color: hoverSend ? '#60A5FA' : 'rgba(96,165,250,0.7)',
              background: hoverSend ? 'rgba(96,165,250,0.1)' : 'rgba(255,255,255,0.05)',
              borderRadius: 4,
              cursor: 'pointer',
              fontFamily: 'inherit',
              border: '1px solid rgba(96,165,250,0.2)',
              transition: 'all 0.15s ease-out',
            }}
            onMouseEnter={() => setHoverSend(true)}
            onMouseLeave={() => setHoverSend(false)}
          >
            发送到终端
          </button>
        )}
        {onClearConfig && hasSavedOrchestration && (
          <button
            onClick={onClearConfig}
            style={{
              padding: '4px 10px',
              fontSize: 10,
              color: hoverClear ? '#F87171' : 'rgba(248,113,113,0.6)',
              background: hoverClear ? 'rgba(248,113,113,0.1)' : 'rgba(255,255,255,0.05)',
              borderRadius: 4,
              cursor: 'pointer',
              fontFamily: 'inherit',
              border: '1px solid rgba(248,113,113,0.2)',
              transition: 'all 0.15s ease-out',
            }}
            onMouseEnter={() => setHoverClear(true)}
            onMouseLeave={() => setHoverClear(false)}
          >
            清空配置
          </button>
        )}
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
