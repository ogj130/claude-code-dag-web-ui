/**
 * SkillNode — DAG 技能节点组件
 *
 * 展示 Agent 加载和使用的技能，包括匹配分数。
 */
import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

export interface SkillNodeData {
  label: string;
  skillName: string;
  skillDomain?: string;
  matchScore?: number;
  status: 'completed' | 'loaded' | 'used' | 'unused';
}

const DOMAIN_COLORS: Record<string, string> = {
  components: '#3b82f6',
  stores: '#8b5cf6',
  services: '#10b981',
  types: '#f59e0b',
  tests: '#ef4444',
  utils: '#06b6d4',
};

function scoreColor(score: number): string {
  if (score >= 0.8) return '#10b981';
  if (score >= 0.5) return '#f59e0b';
  return '#6b7280';
}

export const SkillNode = memo(function SkillNode({ data }: { data: SkillNodeData }) {
  const domainColor = DOMAIN_COLORS[data.skillDomain ?? ''] ?? '#6b7280';
  const mColor = data.matchScore != null ? scoreColor(data.matchScore) : '#6b7280';
  const statusIcon = data.status === 'used' || data.status === 'completed' ? '✓' : data.status === 'unused' ? '⊘' : '…';

  return (
    <div
      style={{
        padding: '6px 10px',
        borderRadius: 6,
        background: 'rgba(59,130,246,0.06)',
        border: '1.5px solid rgba(59,130,246,0.3)',
        minWidth: 120,
        maxWidth: 180,
        fontSize: 10,
        color: 'var(--text-primary)',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ visibility: 'hidden' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
        <span style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: domainColor,
          flexShrink: 0,
        }} />
        <span style={{ fontWeight: 600, fontSize: 10, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {data.skillName}
        </span>
        <span style={{ fontSize: 9, color: 'var(--text-muted)', flexShrink: 0 }}>{statusIcon}</span>
      </div>
      {data.skillDomain && (
        <div style={{ fontSize: 9, color: domainColor, opacity: 0.8 }}>
          {data.skillDomain}
        </div>
      )}
      {data.matchScore != null && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
          <div style={{
            flex: 1,
            height: 3,
            borderRadius: 2,
            background: 'var(--bg-hover)',
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${Math.round(data.matchScore * 100)}%`,
              height: '100%',
              borderRadius: 2,
              background: mColor,
              transition: 'width 300ms',
            }} />
          </div>
          <span style={{ fontSize: 8, color: mColor, flexShrink: 0 }}>
            {Math.round(data.matchScore * 100)}%
          </span>
        </div>
      )}
      <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden' }} />
    </div>
  );
});

export default SkillNode;
