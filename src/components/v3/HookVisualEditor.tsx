/**
 * HookVisualEditor — Hook 可视化编辑器
 *
 * 模板 + 代码编辑器双模式。
 * 所有样式使用内联 style + CSS 变量（本项目未安装 Tailwind CSS）。
 */

import { useState } from 'react';
import type { Hook, TriggerType, HookCondition, HookAction } from '../../services/hookEngine';

// ── 模板 ────────────────────────────────────────────────────

interface HookTemplate {
  name: string;
  description: string;
  trigger: TriggerType;
  conditions: HookCondition[];
  actions: HookAction[];
}

const TEMPLATES: HookTemplate[] = [
  {
    name: '任务完成记录',
    description: '任务完成时自动记录情景记忆',
    trigger: 'task_complete',
    conditions: [],
    actions: [{ type: 'record_episode', params: { content: 'auto' } }],
  },
  {
    name: '错误检测通知',
    description: '检测到错误时发送通知',
    trigger: 'error_detected',
    conditions: [{ field: 'severity', operator: 'in', value: ['error', 'fatal'] }],
    actions: [{ type: 'notify', params: { message: '检测到严重错误' } }],
  },
  {
    name: '文件变更同步',
    description: '关键文件变更时触发检查',
    trigger: 'file_change',
    conditions: [{ field: 'filePath', operator: 'contains', value: 'src/' }],
    actions: [{ type: 'run_command', params: { command: 'npx tsc --noEmit' } }],
  },
];

const TRIGGER_LABELS: Record<TriggerType, string> = {
  task_complete: '任务完成',
  task_fail: '任务失败',
  file_change: '文件变更',
  model_switch: '模型切换',
  session_start: '会话开始',
  session_end: '会话结束',
  error_detected: '错误检测',
  user_feedback: '用户反馈',
  manual: '手动触发',
};

const ACTION_TYPE_LABELS: Record<HookAction['type'], string> = {
  notify: '通知',
  record_episode: '记录情景记忆',
  run_command: '运行命令',
  trigger_skill: '触发 Skill',
  webhook: 'Webhook',
};

// ── 模板选择 ────────────────────────────────────────────────

function TemplateSelector({ onSelect }: { onSelect: (t: HookTemplate) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h4 style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 500, color: '#CBD5E1' }}>选择模板</h4>
      {TEMPLATES.map((t, i) => (
        <button
          key={i}
          onClick={() => onSelect(t)}
          style={{
            width: '100%',
            padding: 10,
            borderRadius: 8,
            border: '1px solid rgba(148, 163, 184, 0.12)',
            background: 'rgba(30, 41, 59, 0.3)',
            textAlign: 'left',
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'all 0.15s ease-out',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.25)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(148, 163, 184, 0.12)'; }}
        >
          <div style={{ fontSize: 12, fontWeight: 500, color: '#CBD5E1' }}>{t.name}</div>
          <div style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>{t.description}</div>
          <div style={{ fontSize: 10, color: '#60A5FA', marginTop: 4 }}>
            触发：{TRIGGER_LABELS[t.trigger]}
          </div>
        </button>
      ))}
    </div>
  );
}

// ── 条件行 ──────────────────────────────────────────────────

function ConditionRow({ condition }: { condition: HookCondition }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      fontSize: 10,
      padding: 8,
      borderRadius: 6,
      background: 'rgba(30, 41, 59, 0.3)',
    }}>
      <span style={{ color: '#94A3B8', fontFamily: '"JetBrains Mono", monospace' }}>{condition.field}</span>
      <span style={{ color: '#60A5FA' }}>{condition.operator}</span>
      <span style={{ color: '#34D399', fontFamily: '"JetBrains Mono", monospace' }}>{JSON.stringify(condition.value)}</span>
    </div>
  );
}

// ── 动作行 ──────────────────────────────────────────────────

function ActionRow({ action }: { action: HookAction }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      fontSize: 10,
      padding: 8,
      borderRadius: 6,
      background: 'rgba(30, 41, 59, 0.3)',
    }}>
      <span style={{ color: '#A78BFA' }}>{ACTION_TYPE_LABELS[action.type]}</span>
      <span style={{
        color: '#64748B',
        fontFamily: '"JetBrains Mono", monospace',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {JSON.stringify(action.params).slice(0, 80)}
      </span>
    </div>
  );
}

// ── 主组件 ──────────────────────────────────────────────────

export interface HookVisualEditorProps {
  hook?: Hook;
  onSave?: (hook: Partial<Hook>) => void;
  className?: string;
}

export default function HookVisualEditor({
  hook,
  onSave,
}: HookVisualEditorProps) {
  const [mode, setMode] = useState<'template' | 'code'>('template');
  const [selectedTemplate, setSelectedTemplate] = useState<HookTemplate | null>(null);

  const current = selectedTemplate ?? hook;

  const modeBtnStyle = (isActive: boolean): React.CSSProperties => ({
    fontSize: 12,
    padding: '6px 12px',
    borderRadius: 6,
    cursor: 'pointer',
    fontFamily: 'inherit',
    border: isActive ? '1px solid rgba(59, 130, 246, 0.25)' : 'none',
    background: isActive ? 'rgba(59, 130, 246, 0.15)' : 'rgba(148, 163, 184, 0.07)',
    color: isActive ? '#60A5FA' : '#94A3B8',
    transition: 'all 0.15s ease-out',
  });

  return (
    <div style={{ padding: 16 }}>
      {/* 模式切换 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <button
          onClick={() => setMode('template')}
          style={modeBtnStyle(mode === 'template')}
          onMouseEnter={e => {
            if (mode !== 'template') e.currentTarget.style.background = 'rgba(148,163,184,0.15)';
          }}
          onMouseLeave={e => {
            if (mode !== 'template') e.currentTarget.style.background = 'rgba(148,163,184,0.07)';
          }}
        >
          模板
        </button>
        <button
          onClick={() => setMode('code')}
          style={modeBtnStyle(mode === 'code')}
          onMouseEnter={e => {
            if (mode !== 'code') e.currentTarget.style.background = 'rgba(148,163,184,0.15)';
          }}
          onMouseLeave={e => {
            if (mode !== 'code') e.currentTarget.style.background = 'rgba(148,163,184,0.07)';
          }}
        >
          代码
        </button>
      </div>

      {mode === 'template' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!current ? (
            <TemplateSelector onSelect={setSelectedTemplate} />
          ) : (
            <>
              <div>
                <h4 style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 500, color: '#CBD5E1' }}>触发器</h4>
                <div style={{ fontSize: 12, color: '#60A5FA' }}>
                  {TRIGGER_LABELS[(current as HookTemplate).trigger as TriggerType] ?? (current as Hook).trigger}
                </div>
              </div>

              {(current.conditions ?? []).length > 0 && (
                <div>
                  <h4 style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 500, color: '#CBD5E1' }}>条件</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {(current.conditions ?? []).map((c, i) => (
                      <ConditionRow key={i} condition={c} />
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h4 style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 500, color: '#CBD5E1' }}>动作</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {(current.actions ?? []).map((a, i) => (
                    <ActionRow key={i} action={a as HookAction} />
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {onSave && (
                  <button
                    onClick={() => onSave(current as Partial<Hook>)}
                    style={{
                      fontSize: 12,
                      padding: '6px 12px',
                      borderRadius: 6,
                      background: 'rgba(59, 130, 246, 0.15)',
                      color: '#60A5FA',
                      border: '1px solid rgba(59, 130, 246, 0.25)',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      transition: 'all 0.15s ease-out',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59, 130, 246, 0.25)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)'; }}
                  >
                    保存
                  </button>
                )}
                <button
                  onClick={() => setSelectedTemplate(null)}
                  style={{
                    fontSize: 12,
                    padding: '6px 12px',
                    borderRadius: 6,
                    background: 'rgba(148, 163, 184, 0.07)',
                    color: '#94A3B8',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'all 0.15s ease-out',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(148, 163, 184, 0.15)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(148, 163, 184, 0.07)'; }}
                >
                  返回模板列表
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div>
          <div style={{
            padding: 12,
            borderRadius: 8,
            background: '#0F172A',
            border: '1px solid rgba(148, 163, 184, 0.12)',
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 12,
            color: '#CBD5E1',
          }}>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
              {JSON.stringify(current ?? hook ?? {}, null, 2)}
            </pre>
          </div>
          <p style={{ fontSize: 10, color: '#64748B', marginTop: 8 }}>
            JSON 编辑模式（高级用户）
          </p>
        </div>
      )}
    </div>
  );
}
