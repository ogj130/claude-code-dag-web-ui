/**
 * RadarChartView — 雷达图展示维度评分
 */

import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts';
import type { DimensionScore, ExtendedAnalysisDimension } from '@/types/globalAgent';

interface RadarChartViewProps {
  scores: DimensionScore[];
  height?: number;
}

const DIMENSION_LABELS: Record<ExtendedAnalysisDimension, string> = {
  codeQuality: '代码质量',
  correctness: '正确性',
  performance: '性能',
  consistency: '一致性',
  creativity: '创意',
  costEfficiency: '成本效率',
  speed: '速度',
  fileQuantity: '文件数量',
  fileDiversity: '文件多样性',
  codeDocRatio: '代码文档比',
  modificationDensity: '修改密度',
};

export function RadarChartView({ scores, height = 240 }: RadarChartViewProps) {
  const chartData = scores.map(s => ({
    dimension: DIMENSION_LABELS[s.dimension] ?? s.dimension,
    score: s.score,
    fullMark: 10,
  }));

  return (
    <div style={{
      background: 'var(--bg-input)',
      borderRadius: 10,
      padding: '16px',
      border: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      <div style={{
        fontSize: 10,
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}>
        维度评分雷达图
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <RadarChart data={chartData} margin={{ top: 0, right: 16, bottom: 0, left: 16 }}>
          <PolarGrid stroke="var(--border)" />
          <PolarAngleAxis
            dataKey="dimension"
            tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
          />
          <Radar
            name="评分"
            dataKey="score"
            stroke="#3b82f6"
            fill="#3b82f6"
            fillOpacity={0.2}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
