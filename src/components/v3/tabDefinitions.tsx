/**
 * V3 Tab Definitions — shared types, icons, tokens, and config
 *
 * Extracted from V3IntelligencePanel.tsx so individual panel components
 * can import these without circular dependencies.
 */

import React from 'react';

// ── 类型定义 ────────────────────────────────────────────────

export type TabCategory = 'core' | 'memory' | 'orchestration' | 'learning' | 'tools' | 'security';

export interface TabItem {
  id: string;
  label: string;
  category: TabCategory;
  icon: JSX.Element;
}

export interface V3PanelProps {
  // Panel components receive no props — they manage internal state or read from global stores
}

// ── Design Tokens ───────────────────────────────────────────

export const TOKENS = {
  // Colors
  bgBase: '#0F172A',
  bgElevated: '#1E293B',
  bgHover: '#334155',
  bgActive: '#1E3A5F',
  accent: '#3B82F6',
  accentDim: 'rgba(59, 130, 246, 0.15)',
  accentGlow: 'rgba(59, 130, 246, 0.3)',
  textPrimary: '#F1F5F9',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  border: 'rgba(148, 163, 184, 0.1)',
  borderActive: 'rgba(59, 130, 246, 0.4)',
  // Shadows
  shadowSm: '0 1px 2px rgba(0, 0, 0, 0.3)',
  shadowMd: '0 4px 12px rgba(0, 0, 0, 0.4)',
  shadowLg: '0 8px 32px rgba(0, 0, 0, 0.5)',
  shadowGlow: '0 0 20px rgba(59, 130, 246, 0.15)',
  // Spacing
  radiusSm: 6,
  radiusMd: 10,
  radiusLg: 14,
} as const;

// ── 图标 ────────────────────────────────────────────────────

const ICON_SIZE = 15;

export const Icons = {
  brain: (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a7 7 0 0 1 7 7c0 2.4-1.2 4.5-3 5.7V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.3C6.2 13.5 5 11.4 5 9a7 7 0 0 1 7-7z"/>
      <path d="M10 21h4"/>
    </svg>
  ),
  intent: (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 16v-4M12 8h.01"/>
    </svg>
  ),
  user: (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  memory: (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>
  ),
  graph: (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="6" r="3"/>
      <circle cx="18" cy="6" r="3"/>
      <circle cx="6" cy="18" r="3"/>
      <circle cx="18" cy="18" r="3"/>
      <line x1="8.5" y1="7.5" x2="15.5" y2="16.5"/>
      <line x1="15.5" y1="7.5" x2="8.5" y2="16.5"/>
    </svg>
  ),
  workMemory: (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
      <line x1="8" y1="21" x2="16" y2="21"/>
      <line x1="12" y1="17" x2="12" y2="21"/>
    </svg>
  ),
  agent: (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  flow: (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  ),
  kanban: (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <path d="M9 3v18M15 3v18"/>
    </svg>
  ),
  evolution: (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20V10"/>
      <path d="M18 20V4"/>
      <path d="M6 20v-4"/>
    </svg>
  ),
  report: (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  ),
  replay: (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3"/>
    </svg>
  ),
  skill: (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  ),
  hook: (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>
  ),
  mcp: (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/>
      <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
      <line x1="6" y1="6" x2="6.01" y2="6"/>
      <line x1="6" y1="18" x2="6.01" y2="18"/>
    </svg>
  ),
  heal: (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
    </svg>
  ),
  diff: (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v18"/>
      <path d="M5 12h14"/>
    </svg>
  ),
  audit: (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
  monitor: (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
      <line x1="8" y1="21" x2="16" y2="21"/>
      <line x1="12" y1="17" x2="12" y2="21"/>
    </svg>
  ),
  voice: (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
      <line x1="12" y1="19" x2="12" y2="23"/>
      <line x1="8" y1="23" x2="16" y2="23"/>
    </svg>
  ),
  close: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  sparkles: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z"/>
    </svg>
  ),
};

// ── Category icons (larger, for category nav) ─────────────────

export const CATEGORY_ICONS: Record<TabCategory, JSX.Element> = {
  core: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a7 7 0 0 1 7 7c0 2.4-1.2 4.5-3 5.7V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.3C6.2 13.5 5 11.4 5 9a7 7 0 0 1 7-7z"/>
      <path d="M10 21h4"/>
    </svg>
  ),
  memory: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>
  ),
  orchestration: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  learning: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20V10"/>
      <path d="M18 20V4"/>
      <path d="M6 20v-4"/>
    </svg>
  ),
  tools: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  ),
  security: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
};

// ── 标签定义 ────────────────────────────────────────────────

export const TABS: TabItem[] = [
  // 核心智能
  { id: 'mode', label: '模式切换', category: 'core', icon: Icons.brain },
  { id: 'intent', label: '意图理解', category: 'core', icon: Icons.intent },
  { id: 'profile', label: '用户画像', category: 'core', icon: Icons.user },
  { id: 'voice', label: '语音输入', category: 'core', icon: Icons.voice },
  // 记忆系统
  { id: 'memory-browser', label: '记忆浏览器', category: 'memory', icon: Icons.memory },
  { id: 'knowledge-graph', label: '知识图谱', category: 'memory', icon: Icons.graph },
  { id: 'working-memory', label: '工作记忆', category: 'memory', icon: Icons.workMemory },
  // 编排系统
  { id: 'agent-canvas', label: 'Agent 编排', category: 'orchestration', icon: Icons.agent },
  { id: 'agent-monitor', label: 'Agent 监控', category: 'orchestration', icon: Icons.monitor },
  { id: 'flow-builder', label: '流程编排', category: 'orchestration', icon: Icons.flow },
  { id: 'flow-exec', label: '流程执行', category: 'orchestration', icon: Icons.flow },
  { id: 'kanban', label: '任务看板', category: 'orchestration', icon: Icons.kanban },
  // 学习系统
  { id: 'evolution', label: '自进化闭环', category: 'learning', icon: Icons.evolution },
  { id: 'report', label: '学习报告', category: 'learning', icon: Icons.report },
  { id: 'replay', label: '会话回放', category: 'learning', icon: Icons.replay },
  // 开发工具
  { id: 'skill-rec', label: 'Skill 推荐', category: 'tools', icon: Icons.skill },
  { id: 'skill-detail', label: 'Skill 详情', category: 'tools', icon: Icons.skill },
  { id: 'hook-editor', label: 'Hook 编辑', category: 'tools', icon: Icons.hook },
  { id: 'hook-log', label: 'Hook 日志', category: 'tools', icon: Icons.hook },
  { id: 'mcp-settings', label: 'MCP 设置', category: 'tools', icon: Icons.mcp },
  { id: 'error-heal', label: '错误自愈', category: 'tools', icon: Icons.heal },
  { id: 'diff-review', label: 'Diff 审查', category: 'tools', icon: Icons.diff },
  // 安全审计
  { id: 'audit-log', label: '审计日志', category: 'security', icon: Icons.audit },
];

export const CATEGORY_LABELS: Record<TabCategory, string> = {
  core: '核心智能',
  memory: '记忆系统',
  orchestration: '编排系统',
  learning: '学习系统',
  tools: '开发工具',
  security: '安全审计',
};

// ── 内容卡片组件 ────────────────────────────────────────────

export function ContentCard({ title, description, children }: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    }}>
      {/* 标题 — 纯文本, 无卡片包装 */}
      <div>
        <h3 style={{
          margin: 0,
          fontSize: 16,
          fontWeight: 600,
          color: TOKENS.textPrimary,
          letterSpacing: '0.02em',
        }}>
          {title}
        </h3>
        <p style={{
          margin: '4px 0 0',
          fontSize: 13,
          color: TOKENS.textSecondary,
          lineHeight: 1.6,
        }}>
          {description}
        </p>
      </div>

      {/* 内容区域 — 单层一致卡片 */}
      <div style={{
        background: TOKENS.bgElevated,
        borderRadius: TOKENS.radiusMd,
        border: `1px solid ${TOKENS.border}`,
        padding: 16,
      }}>
        {children}
      </div>
    </div>
  );
}
