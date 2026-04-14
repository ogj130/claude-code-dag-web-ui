/**
 * DataDashboard — 数据总览仪表盘
 *
 * 展示 KPI 指标、SVG 图表（环形图/面积图/柱状图）、RAG 索引状态、快速入口
 * 布局参考 design-complete-v2.html Phase 5
 */

import { useState, useEffect, useCallback } from 'react';
import { db } from '@/stores/db';
import type { DBSession } from '@/types/storage';

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------

interface ToolCallStats {
  name: string;
  count: number;
}

interface QueryTrend {
  date: string;
  count: number;
}

interface WorkspaceStats {
  path: string;
  count: number;
}

interface DashboardData {
  workspacePaths: number;
  totalSessions: number;
  totalQueries: number;
  totalVectors: number;
  workspaceStats: WorkspaceStats[];
  queryTrend: QueryTrend[];
  toolRanking: ToolCallStats[];
  indexedQueries: number;
  indexedToolCalls: number;
  vectorUsageMB: number;
  ragHealth: number; // 0-100
  loading: boolean;
}

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatBytes(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb.toFixed(1)} MB`;
}

// 生成近7天日期标签
function getLast7Days(): string[] {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(`${d.getMonth() + 1}/${d.getDate()}`);
  }
  return days;
}

// ---------------------------------------------------------------------------
// SVG 图表子组件
// ---------------------------------------------------------------------------

/** 环形图 — 工作路径占比 */
function DonutChart({ stats }: { stats: WorkspaceStats[] }) {
  const COLORS = ['#4a9eff', '#8b5cf6', '#22c55e', '#f97316', '#ef4444', '#ec4899', '#14b8a6'];
  const total = stats.reduce((s, w) => s + w.count, 0);
  if (total === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <svg width="120" height="120" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="40" fill="none" stroke="var(--bg-input)" strokeWidth="16" />
          <text x="60" y="56" textAnchor="middle" fontSize="14" fontWeight="700" fill="var(--text-secondary)" fontFamily="'JetBrains Mono', monospace">0</text>
          <text x="60" y="70" textAnchor="middle" fontSize="8" fill="var(--text-muted)">会话</text>
        </svg>
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>暂无数据</span>
      </div>
    );
  }

  const r = 40;
  const cx = 60;
  const cy = 60;
  const circumference = 2 * Math.PI * r;
  const centerGap = 6; // 弧段间隔

  let accumulated = 0;
  const segments = stats.map((s, i) => {
    const fraction = s.count / total;
    const dashLen = fraction * circumference - centerGap;
    const offset = accumulated * circumference;
    accumulated += fraction;
    return {
      color: COLORS[i % COLORS.length],
      dashArray: `${Math.max(0, dashLen)} ${circumference}`,
      dashOffset: -offset,
      name: s.path,
      count: s.count,
      pct: (fraction * 100).toFixed(0),
    };
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <svg width="120" height="120" viewBox="0 0 120 120">
        <g>
          {segments.map((seg, i) => (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth="16"
              strokeDasharray={seg.dashArray}
              strokeDashoffset={seg.dashOffset}
              style={{ transition: 'all 0.4s ease' }}
            />
          ))}
        </g>
        {/* 中心文字 */}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="16" fontWeight="700" fill="var(--text-primary)" fontFamily="'JetBrains Mono', monospace">
          {formatNumber(total)}
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" fontSize="8" fill="var(--text-muted)">
          会话
        </text>
      </svg>

      {/* 图例 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 10px', justifyContent: 'center', maxWidth: 200 }}>
        {stats.slice(0, 5).map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 7, height: 7, borderRadius: 2, background: COLORS[i % COLORS.length], flexShrink: 0 }} />
            <span style={{ fontSize: 9, color: 'var(--text-muted)', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {s.path.split('/').pop() ?? s.path}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** 面积图 — 近7天 Query 趋势 */
function AreaChart({ data }: { data: QueryTrend[] }) {
  const days = getLast7Days();
  const values = data.map(d => d.count);
  const maxVal = Math.max(...values, 1);

  const W = 280;
  const H = 120;
  const padX = 8;
  const padY = 8;
  const chartW = W - padX * 2;
  const chartH = H - padY * 2;

  const pts = values.map((v, i) => ({
    x: padX + (i / (values.length - 1)) * chartW,
    y: padY + chartH - (v / maxVal) * chartH,
  }));

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${pts[pts.length - 1].x} ${padY + chartH} L ${padX} ${padY + chartH} Z`;

  // Y轴标签（2个）
  const yLabels = [maxVal, 0];

  return (
    <div style={{ width: '100%' }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H + 24}`} preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* 网格线 */}
        {[0, 0.5, 1].map((frac, i) => (
          <line
            key={i}
            x1={padX}
            y1={padY + chartH * frac}
            x2={padX + chartW}
            y2={padY + chartH * frac}
            stroke="var(--border)"
            strokeWidth="0.5"
            strokeDasharray={frac === 0 ? 'none' : '3 3'}
          />
        ))}

        {/* Y轴标签 */}
        {yLabels.map((v, i) => (
          <text
            key={i}
            x={padX - 2}
            y={padY + chartH * i + 4}
            textAnchor="end"
            fontSize="8"
            fill="var(--text-muted)"
            fontFamily="'JetBrains Mono', monospace"
          >
            {formatNumber(v)}
          </text>
        ))}

        {/* 面积 */}
        <path d={areaPath} fill="url(#areaGrad)" />
        {/* 折线 */}
        <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* 数据点 */}
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={2.5} fill="var(--accent)" />
        ))}

        {/* X轴标签 */}
        {days.map((d, i) => (
          <text
            key={i}
            x={padX + (i / (days.length - 1)) * chartW}
            y={H + 14}
            textAnchor="middle"
            fontSize="8"
            fill="var(--text-muted)"
          >
            {d}
          </text>
        ))}
      </svg>
    </div>
  );
}

/** 水平柱状图 — Top 6 工具调用 */
function ToolBarChart({ tools }: { tools: ToolCallStats[] }) {
  const maxCount = Math.max(...tools.map(t => t.count), 1);
  const top6 = tools.slice(0, 6);
  const COLORS = ['#4a9eff', '#8b5cf6', '#22c55e', '#f97316', '#ec4899', '#14b8a6'];

  if (tools.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, color: 'var(--text-muted)', fontSize: 12 }}>
        暂无工具调用数据
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {top6.map((tool, i) => {
        const pct = (tool.count / maxCount) * 100;
        return (
          <div key={tool.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* 编号 */}
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 9,
                fontWeight: 700,
                color: '#fff',
                background: COLORS[i % COLORS.length],
                flexShrink: 0,
              }}
            >
              {i + 1}
            </div>

            {/* 工具名 */}
            <div
              style={{
                width: 120,
                fontSize: 10,
                color: 'var(--text-secondary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
              title={tool.name}
            >
              {tool.name}
            </div>

            {/* 进度条 */}
            <div style={{ flex: 1, height: 6, background: 'var(--bg-input)', borderRadius: 3, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${pct}%`,
                  background: `linear-gradient(90deg, ${COLORS[i % COLORS.length]}cc, ${COLORS[i % COLORS.length]})`,
                  borderRadius: 3,
                  transition: 'width 0.5s ease',
                }}
              />
            </div>

            {/* 次数 */}
            <div
              style={{
                fontSize: 10,
                color: 'var(--text-primary)',
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 600,
                width: 40,
                textAlign: 'right',
                flexShrink: 0,
              }}
            >
              {formatNumber(tool.count)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** 健康度环形图 */
function HealthDonut({ health }: { health: number }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const fill = (health / 100) * circ;
  const color = health >= 80 ? '#4ade80' : health >= 50 ? '#f59e0b' : '#ef4444';

  return (
    <div style={{ position: 'relative', width: 88, height: 88, flexShrink: 0 }}>
      <svg width="88" height="88" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r={r} fill="none" stroke="var(--bg-input)" strokeWidth="10" />
        <circle
          cx="44" cy="44" r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={`${fill} ${circ}`}
          strokeDashoffset={circ * 0.25}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
        <text x="44" y="40" textAnchor="middle" fontSize="14" fontWeight="700" fill="var(--text-primary)" fontFamily="'JetBrains Mono', monospace">
          {health}%
        </text>
        <text x="44" y="53" textAnchor="middle" fontSize="8" fill="var(--text-muted)">
          健康度
        </text>
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPI 卡片
// ---------------------------------------------------------------------------

function KPICard({
  label,
  value,
  accent = false,
  mono = true,
  subValue,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
  mono?: boolean;
  subValue?: string;
}) {
  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: `1px solid ${accent ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 10,
        padding: '14px 16px',
        flex: 1,
        minWidth: 100,
        transition: 'transform 0.2s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; }}
    >
      <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: accent ? 'var(--accent)' : 'var(--text-primary)',
          fontFamily: mono ? "'JetBrains Mono', monospace" : 'inherit',
        }}
      >
        {value}
      </div>
      {subValue && (
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{subValue}</div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 快速入口卡片
// ---------------------------------------------------------------------------

function QuickEntryCard({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        minWidth: 80,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        padding: '14px 8px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        cursor: 'pointer',
        transition: 'all 0.15s',
        color: 'var(--text-secondary)',
      }}
      onMouseEnter={e => {
        const btn = e.currentTarget as HTMLButtonElement;
        btn.style.borderColor = 'var(--accent)';
        btn.style.background = 'var(--bg-input)';
        btn.style.color = 'var(--accent)';
        btn.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={e => {
        const btn = e.currentTarget as HTMLButtonElement;
        btn.style.borderColor = 'var(--border)';
        btn.style.background = 'var(--bg-card)';
        btn.style.color = 'var(--text-secondary)';
        btn.style.transform = 'translateY(0)';
      }}
    >
      <div style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </div>
      <span style={{ fontSize: 10, fontWeight: 600 }}>{label}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// 主组件
// ---------------------------------------------------------------------------

export function DataDashboard() {
  const [data, setData] = useState<DashboardData>({
    workspacePaths: 0,
    totalSessions: 0,
    totalQueries: 0,
    totalVectors: 0,
    workspaceStats: [],
    queryTrend: [],
    toolRanking: [],
    indexedQueries: 0,
    indexedToolCalls: 0,
    vectorUsageMB: 0,
    ragHealth: 0,
    loading: true,
  });

  const loadData = useCallback(async () => {
    setData(prev => ({ ...prev, loading: true }));
    try {
      // 会话/Query 统计
      // TODO: 待 sessionStorage.ts 提供 getSessionsGroupedByWorkspace() 后替换下方逻辑
      const [sessionCount, queryCount, allSessions] = await Promise.all([
        db.sessions.where('status').notEqual('deleted').count(),
        db.queries.count(),
        db.sessions.toArray().catch(() => [] as DBSession[]),
      ]);

      // 按 workspacePath 分组（内联实现，兼容 workspacePath 可能尚不存在的情况）
      const grouped: Record<string, DBSession[]> = {};
      for (const s of allSessions) {
        const path = (s as DBSession & { workspacePath?: string }).workspacePath ?? 'Default';
        if (!grouped[path]) grouped[path] = [];
        grouped[path].push(s);
      }

      const workspacePaths = Object.keys(grouped).length;
      const workspaceStats: WorkspaceStats[] = Object.entries(grouped)
        .map(([path, sessions]) => ({ path, count: sessions.length }))
        .sort((a, b) => b.count - a.count);

      // 近7天 Query 趋势（从 queries 表按日期聚合，fallback 模拟）
      const last7Days = getLast7Days();
      let queryTrend: QueryTrend[] = [];
      try {
        const allQueries = await db.queries.toArray();
        const byDate: Record<string, number> = {};
        for (const q of allQueries) {
          const d = new Date(q.createdAt);
          const key = `${d.getMonth() + 1}/${d.getDate()}`;
          byDate[key] = (byDate[key] ?? 0) + 1;
        }
        queryTrend = last7Days.map(day => ({
          date: day,
          count: byDate[day] ?? 0,
        }));
      } catch {
        // 无数据时显示空状态（不生成随机数据，避免界面抖动）
        queryTrend = last7Days.map(day => ({ date: day, count: 0 }));
      }

      // 工具调用统计（从 toolCalls 表，fallback 模拟）
      let toolRanking: ToolCallStats[] = [];
      try {
        const toolCalls = await db.toolCalls.toArray();
        const byName: Record<string, number> = {};
        for (const tc of toolCalls) {
          byName[tc.name] = (byName[tc.name] ?? 0) + 1;
        }
        toolRanking = Object.entries(byName)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count);
      } catch {
        toolRanking = [];
      }

      // 向量统计（通过 IPC 从主进程 LanceDB 获取）
      let totalVectors = 0;
      let indexedQueries = 0;
      let indexedToolCalls = 0;
      let vectorUsageMB = 0;
      let ragHealth = 0;
      try {
        if (window.electron?.vectorApi) {
          const stats = await window.electron.vectorApi.getTableStats() as {
            totalChunks: number; tables: Array<{ name: string; count: number }>;
          };
          totalVectors = stats.totalChunks ?? 0;
          indexedQueries = stats.tables.find(t => t.name === 'rag_global')?.count ?? 0;
          indexedToolCalls = totalVectors - indexedQueries;
          // 估算：每个向量约 4KB（1536维 float32 ≈ 6KB，压缩后约 4KB）
          vectorUsageMB = (totalVectors * 4) / 1024;
          // 健康度：已索引 Query > 100 则为 100，否则按比例
          ragHealth = Math.min(100, Math.round((indexedQueries / 100) * 100));
        }
      } catch {
        // LanceDB 不可用，保持 0 值，显示"未连接"状态
      }

      setData({
        workspacePaths,
        totalSessions: sessionCount,
        totalQueries: queryCount,
        totalVectors,
        workspaceStats,
        queryTrend,
        toolRanking,
        indexedQueries,
        indexedToolCalls,
        vectorUsageMB,
        ragHealth,
        loading: false,
      });
    } catch (err) {
      console.error('[DataDashboard] Failed to load data:', err);
      setData(prev => ({ ...prev, loading: false }));
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const kpiLoading = data.loading;

  return (
    <>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .dashboard-section {
          animation: fadeIn 0.25s ease-out;
        }
        .kpi-card {
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .kpi-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
      `}</style>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          padding: '20px 24px',
          maxWidth: 900,
          margin: '0 auto',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        {/* 标题栏 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="9" width="3" height="5" rx="1" fill="var(--accent)" opacity="0.5" />
              <rect x="6.5" y="6" width="3" height="8" rx="1" fill="var(--accent)" opacity="0.75" />
              <rect x="11" y="2" width="3" height="12" rx="1" fill="var(--accent)" />
            </svg>
            <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
              数据总览
            </span>
          </div>
          <button
            onClick={loadData}
            style={{
              padding: '5px 12px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 7,
              fontSize: 11,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              const btn = e.currentTarget as HTMLButtonElement;
              btn.style.background = 'var(--bg-input)';
              btn.style.borderColor = 'var(--accent)';
            }}
            onMouseLeave={e => {
              const btn = e.currentTarget as HTMLButtonElement;
              btn.style.background = 'var(--bg-card)';
              btn.style.borderColor = 'var(--border)';
            }}
          >
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
              <path d="M2 8a6 6 0 0110.5-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M14 8a6 6 0 01-10.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M13 2v4h-4M3 14v-4h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            刷新
          </button>
        </div>

        {/* KPI Row */}
        <div className="dashboard-section" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <KPICard
            label="工作路径"
            value={kpiLoading ? '—' : data.workspacePaths}
            subValue="个"
          />
          <KPICard
            label="会话总数"
            value={kpiLoading ? '—' : formatNumber(data.totalSessions)}
          />
          <KPICard
            label="Query 总数"
            value={kpiLoading ? '—' : formatNumber(data.totalQueries)}
            accent={true}
          />
          <KPICard
            label="向量总数"
            value={kpiLoading ? '—' : data.totalVectors > 0 ? formatNumber(data.totalVectors) : '待索引'}
            subValue={data.totalVectors > 0 ? '条' : 'LanceDB 未连接'}
          />
        </div>

        {/* 第一行图表 */}
        <div className="dashboard-section" style={{ display: 'flex', gap: 12, animationDelay: '0.05s' }}>
          {/* 左侧：环形图 */}
          <div
            style={{
              flex: '0 0 220px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
              工作路径分布
            </div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <DonutChart stats={data.workspaceStats} />
            </div>
          </div>

          {/* 右侧：面积图 */}
          <div
            style={{
              flex: 1,
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
                近7天 Query 趋势
              </span>
              {!kpiLoading && data.queryTrend.length > 0 && (
                <span
                  style={{
                    fontSize: 10,
                    color: 'var(--accent)',
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  合计 {data.queryTrend.reduce((s, d) => s + d.count, 0)} 次
                </span>
              )}
            </div>
            <div style={{ flex: 1 }}>
              {kpiLoading ? (
                <div
                  style={{
                    height: 120,
                    background: 'linear-gradient(90deg, var(--bg-card) 25%, var(--bg-input) 50%, var(--bg-card) 75%)',
                    backgroundSize: '200% 100%',
                    animation: 'shimmer 1.5s infinite',
                    borderRadius: 6,
                  }}
                />
              ) : (
                <AreaChart data={data.queryTrend} />
              )}
            </div>
          </div>
        </div>

        {/* 第二行图表 */}
        <div className="dashboard-section" style={{ display: 'flex', gap: 12, animationDelay: '0.1s' }}>
          {/* 左侧：工具排行柱状图 */}
          <div
            style={{
              flex: 1,
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
              Top 工具调用排行
            </div>
            <ToolBarChart tools={data.toolRanking} />
          </div>

          {/* 右侧：RAG 索引状态 */}
          <div
            style={{
              flex: 1,
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
              RAG 索引状态
            </div>

            {data.ragHealth === 0 ? (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  color: 'var(--text-muted)',
                  fontSize: 11,
                  textAlign: 'center',
                }}
              >
                <svg width="32" height="32" viewBox="0 0 48 48" fill="none">
                  <path d="M24 6L6 15v18l18 9 18-9V15L24 6z" stroke="currentColor" strokeWidth="2" fill="none" />
                  <path d="M24 6v36M6 15l18 9 18-9" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                </svg>
                <span>向量数据库未连接</span>
                <span style={{ fontSize: 10 }}>请在 Embedding 配置中连接后端</span>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <HealthDonut health={data.ragHealth} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>已索引 Query</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace" }}>
                      {formatNumber(data.indexedQueries)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>已索引 ToolCall</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace" }}>
                      {formatNumber(data.indexedToolCalls)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>向量占用</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace" }}>
                      {formatBytes(data.vectorUsageMB)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 快速入口行 */}
        <div className="dashboard-section" style={{ display: 'flex', gap: 10, animationDelay: '0.15s' }}>
          <QuickEntryCard
            label="RAG 检索"
            onClick={() => console.info('[DataDashboard] RAG 检索 clicked')}
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="11" cy="11" r="7" />
                <path d="M16 16l4 4" strokeLinecap="round" />
                <path d="M8 11h6M11 8v6" strokeLinecap="round" />
              </svg>
            }
          />
          <QuickEntryCard
            label="Embedding"
            onClick={() => console.info('[DataDashboard] Embedding clicked')}
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 2L3 7v10l9 5 9-5V7L12 2z" />
                <path d="M12 2v20M3 7l9 5 9-5" strokeLinejoin="round" />
              </svg>
            }
          />
          <QuickEntryCard
            label="执行分析"
            onClick={() => console.info('[DataDashboard] 执行分析 clicked')}
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" opacity="0.5" />
                <rect x="3" y="14" width="7" height="7" rx="1" opacity="0.5" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            }
          />
          <QuickEntryCard
            label="Token 统计"
            onClick={() => console.info('[DataDashboard] Token 统计 clicked')}
            icon={
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M2 6h20M2 12h14M2 18h18" strokeLinecap="round" />
                <circle cx="19" cy="14" r="3" opacity="0.5" />
              </svg>
            }
          />
        </div>
      </div>
    </>
  );
}
