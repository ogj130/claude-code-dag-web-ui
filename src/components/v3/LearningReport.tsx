/**
 * LearningReport — 学习报告
 *
 * 展示月度统计：任务完成量、Token 消耗、Skill 使用、错误率。
 * 所有样式使用内联 style + CSS 变量（本项目未安装 Tailwind CSS）。
 */

import { useState, useEffect } from 'react';
import { useTaskStore } from '../../stores/useTaskStore';
import { list as listSkills } from '../../services/skillStore';

// ── 类型 ────────────────────────────────────────────────────

interface MonthlyStats {
  month: string;
  tasksCompleted: number;
  tokensUsed: number;
  skillsUsed: number;
  errorRate: number;
  topSkills: Array<{ name: string; count: number }>;
}

// ── 真实数据 Hook ────────────────────────────────────────────

function useLearningStats(): MonthlyStats[] {
  const { toolCalls } = useTaskStore();
  const [stats, setStats] = useState<MonthlyStats[]>([]);

  useEffect(() => {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const completedCalls = toolCalls.filter(t => t.status === 'completed');
    const errorCalls = toolCalls.filter(t => t.status === 'error');
    const errorRate = toolCalls.length > 0 ? errorCalls.length / toolCalls.length : 0;

    const toolNames = [...new Set(toolCalls.map(t => t.tool))];
    const topSkills = toolNames.slice(0, 5).map(name => ({
      name,
      count: toolCalls.filter(t => t.tool === name).length,
    }));

    listSkills({ limit: 10 }).then(skills => {
      const current: MonthlyStats = {
        month,
        tasksCompleted: completedCalls.length,
        tokensUsed: 0,
        skillsUsed: skills.length,
        errorRate: Math.round(errorRate * 100) / 100,
        topSkills: topSkills.length > 0 ? topSkills : skills.map(s => ({ name: s.name, count: s.usageStats?.totalCalls || 0 })),
      };
      setStats([current]);
    }).catch(() => {
      setStats([{
        month,
        tasksCompleted: completedCalls.length,
        tokensUsed: 0,
        skillsUsed: toolNames.length,
        errorRate: Math.round(errorRate * 100) / 100,
        topSkills,
      }]);
    });
  }, [toolCalls]);

  return stats;
}

// ── 迷你折线图 ──────────────────────────────────────────────

function MiniChart({ values, color, label }: { values: number[]; color: string; label: string }) {
  const max = Math.max(...values, 1);
  const width = 120;
  const height = 40;
  const points = values
    .map((v, i) => `${(i / (values.length - 1)) * width},${height - (v / max) * height}`)
    .join(' ');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg width={width} height={height} style={{ marginBottom: 4 }}>
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span style={{ fontSize: 10, color: '#64748B' }}>{label}</span>
    </div>
  );
}

// ── 柱状图 ──────────────────────────────────────────────────

function MiniBarChart({ values, color, label }: { values: number[]; color: string; label: string }) {
  const max = Math.max(...values, 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 40 }}>
        {values.map((v, i) => (
          <div
            key={i}
            style={{
              width: 16,
              borderRadius: '4px 4px 0 0',
              height: `${(v / max) * 40}px`,
              backgroundColor: color,
              opacity: 0.6 + (i / values.length) * 0.4,
              transition: 'height 0.3s ease-out',
            }}
          />
        ))}
      </div>
      <span style={{ fontSize: 10, color: '#64748B', marginTop: 4 }}>{label}</span>
    </div>
  );
}

// ── 主组件 ──────────────────────────────────────────────────

export interface LearningReportProps {
  className?: string;
}

export default function LearningReport({}: LearningReportProps) {
  const stats = useLearningStats();
  const [selectedMonth, setSelectedMonth] = useState<MonthlyStats | null>(null);

  useEffect(() => {
    if (stats.length > 0 && !selectedMonth) {
      setSelectedMonth(stats[stats.length - 1]);
    }
  }, [stats, selectedMonth]);

  if (!selectedMonth) {
    return (
      <div style={{ padding: 16 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 500, color: '#CBD5E1' }}>学习报告</h3>
        <p style={{ fontSize: 12, color: '#64748B' }}>暂无数据</p>
      </div>
    );
  }

  const taskValues = stats.map((s) => s.tasksCompleted);
  const tokenValues = stats.map((s) => s.tokensUsed);
  const errorValues = stats.map((s) => s.errorRate * 100);

  return (
    <div style={{ padding: 16 }}>
      <h3 style={{
        margin: '0 0 12px',
        fontSize: 14,
        fontWeight: 500,
        color: '#CBD5E1',
      }}>
        学习报告
      </h3>

      {/* 月份选择 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
        {stats.map((s) => {
          const isSelected = selectedMonth.month === s.month;
          return (
            <button
              key={s.month}
              onClick={() => setSelectedMonth(s)}
              style={{
                fontSize: 10,
                padding: '4px 8px',
                borderRadius: 6,
                cursor: 'pointer',
                fontFamily: 'inherit',
                border: isSelected ? '1px solid rgba(59, 130, 246, 0.25)' : 'none',
                background: isSelected ? 'rgba(59, 130, 246, 0.15)' : 'rgba(148, 163, 184, 0.05)',
                color: isSelected ? '#60A5FA' : '#64748B',
                transition: 'all 0.15s ease-out',
              }}
              onMouseEnter={e => {
                if (!isSelected) e.currentTarget.style.color = '#94A3B8';
              }}
              onMouseLeave={e => {
                if (!isSelected) e.currentTarget.style.color = '#64748B';
              }}
            >
              {s.month}
            </button>
          );
        })}
      </div>

      {/* 统计卡片 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 8,
        marginBottom: 16,
      }}>
        {[
          { label: '完成任务', value: selectedMonth.tasksCompleted, color: '#60A5FA' },
          { label: 'Token 消耗', value: `${(selectedMonth.tokensUsed / 1000).toFixed(0)}K`, color: '#A78BFA' },
          { label: '使用 Skill', value: selectedMonth.skillsUsed, color: '#34D399' },
          { label: '错误率', value: `${(selectedMonth.errorRate * 100).toFixed(1)}%`, color: selectedMonth.errorRate > 0.1 ? '#F87171' : '#34D399' },
        ].map((stat) => (
          <div key={stat.label} style={{
            padding: 8,
            borderRadius: 6,
            background: 'rgba(30, 41, 59, 0.5)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: 10, color: '#64748B' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* 趋势图 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 12,
        marginBottom: 16,
      }}>
        <MiniChart values={taskValues} color="#3b82f6" label="任务完成趋势" />
        <MiniBarChart values={tokenValues} color="#a855f7" label="Token 消耗" />
        <MiniChart values={errorValues} color="#ef4444" label="错误率趋势" />
      </div>

      {/* Top Skills */}
      <div>
        <h4 style={{
          margin: '0 0 8px',
          fontSize: 12,
          fontWeight: 500,
          color: '#CBD5E1',
        }}>
          高频 Skill
        </h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {selectedMonth.topSkills.map((skill) => (
            <div key={skill.name} style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 8,
              borderRadius: 6,
              background: 'rgba(30, 41, 59, 0.3)',
            }}>
              <span style={{ fontSize: 12, color: '#CBD5E1' }}>{skill.name}</span>
              <span style={{ fontSize: 10, color: '#60A5FA' }}>{skill.count} 次</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
