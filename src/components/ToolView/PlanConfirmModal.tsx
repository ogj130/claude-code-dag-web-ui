import type { AgentPlan, AgentPlanItem } from '@/types/multi-agent/ceo-agent';

export interface PlanConfirmModalProps {
  plan: AgentPlan;
  onConfirm: () => void;
  onCancel: () => void;
}

const AGENT_TYPE_COLORS: Record<string, string> = {
  context: '#3b82f6',
  planning: '#f59e0b',
  execution: '#10b981',
  review: '#8b5cf6',
};

const AGENT_TYPE_LABELS: Record<string, string> = {
  context: 'Context',
  planning: 'Planning',
  execution: 'Execution',
  review: 'Review',
};

const STRATEGY_LABELS: Record<string, string> = {
  pipeline: '流水线',
  parallel: '并行',
  mixed: '混合',
};

function AgentItem({ agent, index }: { agent: AgentPlanItem; index: number }) {
  const color = AGENT_TYPE_COLORS[agent.type] || '#6b7280';
  const label = AGENT_TYPE_LABELS[agent.type] || agent.type;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
      padding: '10px 12px',
      background: `${color}0D`,
      border: `1px solid ${color}30`,
      borderRadius: 8,
      marginBottom: 6,
    }}>
      <span style={{
        width: 24,
        height: 24,
        borderRadius: '50%',
        background: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontSize: 11,
        fontWeight: 600,
        flexShrink: 0,
        marginTop: 1,
      }}>
        {index + 1}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <span style={{
            backgroundColor: color,
            color: '#fff',
            padding: '1px 6px',
            borderRadius: 3,
            fontSize: 9,
            fontWeight: 600,
          }}>
            {label}
          </span>
          <span style={{ fontSize: 12, color: '#c9d1d9', fontWeight: 500 }}>
            {agent.name}
          </span>
        </div>
        <div style={{
          fontSize: 10,
          color: '#6b7280',
          lineHeight: 1.5,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap' as const,
        }}>
          {agent.description}
        </div>
      </div>
    </div>
  );
}

export function PlanConfirmModal({ plan, onConfirm, onCancel }: PlanConfirmModalProps) {
  const agentCount = plan.agents.length;
  const strategyLabel = STRATEGY_LABELS[plan.strategy] || plan.strategy;
  const typeCounts: Record<string, number> = {};
  plan.agents.forEach(a => {
    typeCounts[a.type] = (typeCounts[a.type] || 0) + 1;
  });

  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(2px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#161b22',
          border: '1px solid #30363d',
          borderRadius: 12,
          width: 480,
          maxHeight: '80vh',
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* ---- 头部 ---- */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #21262d',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 14,
            fontWeight: 700,
            flexShrink: 0,
          }}>
            P
          </div>
          <div>
            <div style={{ fontSize: 14, color: '#c9d1d9', fontWeight: 600 }}>
              Agent 执行计划
            </div>
            <div style={{ fontSize: 11, color: '#6b7280' }}>
              策略: {strategyLabel}
              {'  '}·{'  '}
              {agentCount} 个 Agent
              {plan.estimatedDuration > 0 && (
                <span>{'  '}·{'  '}预计 {Math.round(plan.estimatedDuration / 1000)}s</span>
              )}
            </div>
          </div>
          <button
            onClick={onCancel}
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              color: '#6b7280',
              cursor: 'pointer',
              fontSize: 16,
              padding: '2px 6px',
              borderRadius: 4,
            }}
            title="关闭"
          >
            {'\u2715'}
          </button>
        </div>

        {/* ---- Agent 列表 ---- */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '14px 20px',
        }}>
          {plan.agents.map((agent, i) => (
            <AgentItem key={agent.id} agent={agent} index={i} />
          ))}
        </div>

        {/* ---- 统计 ---- */}
        <div style={{
          padding: '10px 20px',
          borderTop: '1px solid #21262d',
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
        }}>
          <div style={{
            fontSize: 10,
            color: '#6b7280',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}>
            <span style={{ fontSize: 11, color: '#c9d1d9', fontWeight: 600 }}>
              {agentCount}
            </span>
            个 Agent
          </div>
          {Object.entries(typeCounts).map(([type, count]) => (
            <div
              key={type}
              style={{
                fontSize: 10,
                color: AGENT_TYPE_COLORS[type] || '#6b7280',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span style={{ fontWeight: 600 }}>{count}</span>
              {AGENT_TYPE_LABELS[type] || type}
            </div>
          ))}
        </div>

        {/* ---- 底部按钮 ---- */}
        <div style={{
          padding: '14px 20px',
          borderTop: '1px solid #21262d',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 10,
        }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 20px',
              borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.1)',
              background: '#374151',
              color: '#c9d1d9',
              fontSize: 12,
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '8px 24px',
              borderRadius: 6,
              border: 'none',
              background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
              color: '#fff',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(139,92,246,0.3)',
            }}
          >
            确认执行
          </button>
        </div>
      </div>
    </div>
  );
}

export default PlanConfirmModal;
