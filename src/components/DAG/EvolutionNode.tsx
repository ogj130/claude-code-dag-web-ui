/**
 * EvolutionNode — DAG 自进化节点组件
 *
 * 显示 evolutionLoop 4 阶段（Execute→Evaluate→Abstract→Refine）的摘要。
 */
import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

export interface EvolutionNodeData {
  label: string;
  evolutionStage: string;
  candidateCount: number;
  scoreSummary?: Record<string, number>;
  status: 'running' | 'completed';
}

const STAGES = ['execute', 'evaluate', 'abstract', 'refine'] as const;
const STAGE_LABELS: Record<string, string> = {
  execute: '执行',
  evaluate: '评估',
  abstract: '抽象',
  refine: '精炼',
};

export const EvolutionNode = memo(function EvolutionNode({ data }: { data: EvolutionNodeData }) {
  const currentStageIdx = STAGES.indexOf(data.evolutionStage as typeof STAGES[number]);

  return (
    <div
      style={{
        padding: '10px 14px',
        borderRadius: 10,
        background: 'rgba(16,185,129,0.06)',
        border: '1.5px dashed rgba(16,185,129,0.4)',
        minWidth: 180,
        maxWidth: 240,
        fontSize: 10,
        color: 'var(--text-primary)',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ visibility: 'hidden' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span>🧬</span>
        <span style={{ fontWeight: 600, fontSize: 11 }}>{data.label}</span>
        {data.candidateCount > 0 && (
          <span style={{
            marginLeft: 'auto',
            background: '#10b981',
            color: '#fff',
            borderRadius: 10,
            padding: '1px 6px',
            fontSize: 9,
            fontWeight: 600,
          }}>
            +{data.candidateCount}
          </span>
        )}
      </div>

      {/* 4-Stage progress */}
      <div style={{ display: 'flex', gap: 3, marginBottom: 6 }}>
        {STAGES.map((stage, i) => (
          <div
            key={stage}
            title={STAGE_LABELS[stage]}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              background: i <= currentStageIdx ? '#10b981' : 'var(--bg-hover)',
              transition: 'background 500ms',
            }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: 'var(--text-muted)' }}>
        {STAGES.map(stage => (
          <span key={stage}>{STAGE_LABELS[stage]}</span>
        ))}
      </div>

      {data.scoreSummary && (
        <div style={{ marginTop: 6, fontSize: 9, color: 'var(--text-secondary)' }}>
          综合评分：{Object.values(data.scoreSummary).reduce((a, b) => a + b, 0).toFixed(1)}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden' }} />
    </div>
  );
});

export default EvolutionNode;
