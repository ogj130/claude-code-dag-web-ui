/**
 * SkillDetailPanel — Skill 详情面板
 *
 * 展示 Skill 的详细信息、使用统计、版本历史。
 * 所有样式使用内联 style + CSS 变量（本项目未安装 Tailwind CSS）。
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getById,
  getVersions,
  getUsageStats,
  rollback,
  type Skill,
  type SkillVersion,
  type SkillUsageStats,
} from '../../services/skillStore';

// ── 统计卡片 ────────────────────────────────────────────────

function StatCard({ label, value, color = '#CBD5E1' }: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div style={{
      padding: 8,
      borderRadius: 6,
      background: 'rgba(30, 41, 59, 0.5)',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 14, fontWeight: 500, color }}>{value}</div>
      <div style={{ fontSize: 10, color: '#64748B' }}>{label}</div>
    </div>
  );
}

// ── 成功率条形图 ────────────────────────────────────────────

function SuccessRateBar({ rate }: { rate: number }) {
  const percent = Math.round(rate * 100);
  const barColor = percent >= 80 ? '#34D399' : percent >= 50 ? '#FBBF24' : '#F87171';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
        <span style={{ color: '#94A3B8' }}>成功率</span>
        <span style={{ color: '#CBD5E1' }}>{percent}%</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: 'rgba(148, 163, 184, 0.15)' }}>
        <div style={{
          height: '100%',
          borderRadius: 3,
          background: barColor,
          width: `${percent}%`,
          transition: 'width 0.5s ease-out',
        }} />
      </div>
    </div>
  );
}

// ── 版本历史列表 ────────────────────────────────────────────

function VersionList({
  versions,
  onRollback,
}: {
  versions: SkillVersion[];
  onRollback: (version: number) => void;
}) {
  if (versions.length === 0) {
    return <div style={{ fontSize: 12, color: '#64748B', padding: '8px 0' }}>暂无版本历史</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {[...versions].reverse().map((v) => (
        <div key={v.id} style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 8,
          borderRadius: 6,
          background: 'rgba(30, 41, 59, 0.3)',
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: '#CBD5E1' }}>v{v.version}</span>
              {v.changeNote && (
                <span style={{
                  fontSize: 10,
                  color: '#64748B',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {v.changeNote}
                </span>
              )}
            </div>
            <div style={{ fontSize: 10, color: '#64748B' }}>
              {new Date(v.createdAt).toLocaleString()}
            </div>
          </div>
          {v.version < (versions[versions.length - 1]?.version ?? 0) && (
            <button
              onClick={() => onRollback(v.version)}
              style={{
                fontSize: 10,
                padding: '2px 8px',
                borderRadius: 4,
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
              回滚
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// ── 主组件 ──────────────────────────────────────────────────

export interface SkillDetailPanelProps {
  skillId: string;
  onClose?: () => void;
  className?: string;
}

export default function SkillDetailPanel({
  skillId,
  onClose,
}: SkillDetailPanelProps) {
  const [skill, setSkill] = useState<Skill | null>(null);
  const [stats, setStats] = useState<SkillUsageStats | null>(null);
  const [versions, setVersions] = useState<SkillVersion[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [s, st, vs] = await Promise.all([
      getById(skillId),
      getUsageStats(skillId),
      getVersions(skillId),
    ]);
    setSkill(s);
    setStats(st);
    setVersions(vs);
    setLoading(false);
  }, [skillId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRollback = useCallback(async (version: number) => {
    await rollback(skillId, version);
    await loadData();
  }, [skillId, loadData]);

  if (loading) {
    return (
      <div style={{ padding: 16, textAlign: 'center', color: '#64748B', fontSize: 14 }}>
        加载中...
      </div>
    );
  }

  if (!skill) {
    return (
      <div style={{ padding: 16, textAlign: 'center', color: '#64748B', fontSize: 14 }}>
        Skill 未找到
      </div>
    );
  }

  return (
    <div style={{ padding: 16 }}>
      {/* 头部 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 500, color: '#CBD5E1' }}>{skill.name}</h3>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94A3B8' }}>{skill.description}</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              fontSize: 12,
              color: '#64748B',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#CBD5E1'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#64748B'; }}
          >
            ✕
          </button>
        )}
      </div>

      {/* 统计概览 */}
      {stats && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 8,
          marginBottom: 16,
        }}>
          <StatCard label="总调用" value={stats.totalCalls} />
          <StatCard label="成功" value={stats.successCount} color="#34D399" />
          <StatCard label="失败" value={stats.failureCount} color="#F87171" />
          <StatCard label="Tokens" value={stats.totalTokens.toLocaleString()} color="#A78BFA" />
        </div>
      )}

      {/* 成功率 */}
      {stats && (
        <div style={{ marginBottom: 16 }}>
          <SuccessRateBar rate={stats.successRate} />
        </div>
      )}

      {/* 标签 */}
      {skill.tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 16 }}>
          {skill.tags.map((tag) => (
            <span key={tag} style={{
              fontSize: 10,
              padding: '1px 6px',
              borderRadius: 4,
              background: 'rgba(148, 163, 184, 0.07)',
              color: '#94A3B8',
            }}>
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* 版本历史 */}
      <div>
        <h4 style={{
          margin: '0 0 8px',
          fontSize: 12,
          fontWeight: 500,
          color: '#CBD5E1',
        }}>
          版本历史
        </h4>
        <VersionList versions={versions} onRollback={handleRollback} />
      </div>
    </div>
  );
}
