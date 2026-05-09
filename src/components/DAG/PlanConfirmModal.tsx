import { useState, useCallback } from 'react';
import type { AgentPlanItem, WorkerType } from '@/types/multi-agent/ceo-agent';

export interface PlanConfirmModalProps {
  agents: AgentPlanItem[];
  strategy: string;
  onConfirm: (agents: AgentPlanItem[]) => void;
  onCancel: () => void;
  onSaveAsTemplate?: (agents: AgentPlanItem[]) => void;
  style?: React.CSSProperties;
}

const AGENT_TYPE_COLORS: Record<string, string> = {
  context: '#3b82f6', planning: '#f59e0b', execution: '#10b981', review: '#8b5cf6',
};

const AGENT_TYPE_LABELS: Record<string, string> = {
  context: 'Context', planning: 'Planning', execution: 'Execution', review: 'Review',
};

const AGENT_TYPE_OPTIONS: WorkerType[] = ['context', 'planning', 'execution', 'review'];

export function PlanConfirmModal({
  agents: initialAgents, strategy, onConfirm, onCancel, onSaveAsTemplate, style,
}: PlanConfirmModalProps) {
  const [agents, setAgents] = useState<AgentPlanItem[]>(initialAgents);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newType, setNewType] = useState<WorkerType>('execution');
  const [newDesc, setNewDesc] = useState('');

  const removeAgent = useCallback((id: string) => {
    setAgents(prev => prev.filter(a => a.id !== id));
  }, []);

  const addAgent = useCallback(() => {
    if (!newDesc.trim()) return;
    const newAgent: AgentPlanItem = {
      id: `custom-${Date.now()}`,
      type: newType,
      name: `${AGENT_TYPE_LABELS[newType]}Agent`,
      description: newDesc.trim(),
      dependsOn: agents.length > 0 ? [agents[agents.length - 1].id] : [],
      priority: agents.length + 1,
      verificationCriteria: ['task_completed'],
    };
    setAgents(prev => [...prev, newAgent]);
    setNewDesc('');
    setShowAddForm(false);
  }, [newType, newDesc, agents]);

  const isValid = agents.length > 0 && agents[0].type !== 'execution';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)',
      ...style,
    }}>
      <div style={{
        background: '#161b22', border: '1px solid #30363d', borderRadius: 12,
        width: 460, maxHeight: '80vh', overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* 头部 */}
        <div style={{
          padding: '14px 18px', borderBottom: '1px solid #21262d',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 18 }}>{'\uD83C\uDFF0'}</span>
          <div>
            <div style={{ fontSize: 14, color: '#c9d1d9', fontWeight: 600 }}>CEO Agent 执行计划</div>
            <div style={{ fontSize: 11, color: '#6b7280' }}>
              策略：{strategy === 'pipeline' ? '流水线' : strategy === 'parallel' ? '并行' : '混合'} · {agents.length} Agent
            </div>
          </div>
          <button onClick={onCancel} style={{
            marginLeft: 'auto', background: 'none', border: 'none',
            color: '#6b7280', cursor: 'pointer', fontSize: 16,
          }}>{'\u2715'}</button>
        </div>

        {/* Agent 列表 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {agents.map((agent, i) => (
            <div key={agent.id}>
              {i > 0 && <div style={{ textAlign: 'center', color: '#6b7280', fontSize: 14, padding: '2px 0' }}>{'\u2193'}</div>}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px',
                background: `${AGENT_TYPE_COLORS[agent.type]}0D`,
                border: `1px solid ${AGENT_TYPE_COLORS[agent.type]}30`,
                borderRadius: 8,
              }}>
                <span style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: AGENT_TYPE_COLORS[agent.type],
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 11, fontWeight: 600, flexShrink: 0,
                }}>{i + 1}</span>
                <span style={{
                  background: AGENT_TYPE_COLORS[agent.type], color: '#fff',
                  padding: '1px 6px', borderRadius: 3, fontSize: 9, fontWeight: 600,
                }}>{AGENT_TYPE_LABELS[agent.type]}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: '#c9d1d9' }}>{agent.name}</div>
                  <div style={{ fontSize: 10, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{agent.description}</div>
                </div>
                <button onClick={() => removeAgent(agent.id)} style={{
                  background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 14,
                }} title="删除此 Agent">{'\u2715'}</button>
              </div>
            </div>
          ))}

          {/* 添加自定义 Agent */}
          {showAddForm ? (
            <div style={{ padding: '8px 12px', border: '1px dashed rgba(255,255,255,0.15)', borderRadius: 8 }}>
              <select value={newType} onChange={e => setNewType(e.target.value as WorkerType)} style={{
                background: '#0d1117', color: '#c9d1d9', border: '1px solid #30363d', borderRadius: 4, padding: '4px 8px', fontSize: 11, marginRight: 8,
              }}>
                {AGENT_TYPE_OPTIONS.map(t => <option key={t} value={t}>{AGENT_TYPE_LABELS[t]}Agent</option>)}
              </select>
              <input value={newDesc} onChange={e => setNewDesc(e.target.value)}
                placeholder="Agent 描述..."
                style={{ background: '#0d1117', color: '#c9d1d9', border: '1px solid #30363d', borderRadius: 4, padding: '4px 8px', fontSize: 11, width: 180 }}
              />
              <button onClick={addAgent} style={{ marginLeft: 8, padding: '4px 10px', borderRadius: 4, border: 'none', background: '#238636', color: '#fff', fontSize: 11, cursor: 'pointer' }}>添加</button>
              <button onClick={() => setShowAddForm(false)} style={{ marginLeft: 4, background: 'none', border: 'none', color: '#6b7280', fontSize: 11, cursor: 'pointer' }}>取消</button>
            </div>
          ) : (
            <button onClick={() => setShowAddForm(true)} style={{
              padding: '8px', border: '1px dashed rgba(255,255,255,0.12)', borderRadius: 8,
              background: 'none', color: '#6b7280', fontSize: 11, cursor: 'pointer',
            }}>+ 添加自定义 Agent</button>
          )}

          {!isValid && (
            <div style={{ fontSize: 10, color: '#f87171', padding: '4px 8px', background: 'rgba(239,68,68,0.06)', borderRadius: 4 }}>
              {agents.length === 0 ? '至少需要 1 个 Agent' : 'Execution 类型不能作为第一个 Agent（需要先分析/设计）'}
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div style={{
          padding: '12px 18px', borderTop: '1px solid #21262d',
          display: 'flex', justifyContent: 'flex-end', gap: 8,
        }}>
          <button onClick={onCancel} style={{
            padding: '6px 16px', borderRadius: 5, border: '1px solid rgba(255,255,255,0.1)',
            background: '#374151', color: '#c9d1d9', fontSize: 11, cursor: 'pointer',
          }}>取消</button>
          {onSaveAsTemplate && (
            <button onClick={() => onSaveAsTemplate(agents)} style={{
              padding: '6px 16px', borderRadius: 5, border: '1px solid rgba(139,92,246,0.3)',
              background: 'rgba(139,92,246,0.12)', color: '#c4b5fd', fontSize: 11, cursor: 'pointer',
            }}>保存为模板</button>
          )}
          <button onClick={() => onConfirm(agents)} disabled={!isValid} style={{
            padding: '6px 20px', borderRadius: 5, border: 'none',
            background: isValid ? 'linear-gradient(135deg, #8b5cf6, #3b82f6)' : '#374151',
            color: isValid ? '#fff' : '#6b7280', fontSize: 11, fontWeight: 600,
            cursor: isValid ? 'pointer' : 'not-allowed',
          }}>确认执行 {'\u25B6'}</button>
        </div>
      </div>
    </div>
  );
}

export default PlanConfirmModal;
