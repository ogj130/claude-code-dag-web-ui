import React from 'react';

// Each panel component receives no props -- they manage state internally or via stores
export interface V3PanelProps {}

export interface DockSubItem {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  type: 'panel' | 'drawer' | 'modal';
  panel?: React.ComponentType<V3PanelProps>;
  openModal?: () => void;
}

export interface DockGroupConfig {
  groupId: string;
  label: string;
  icon: React.ReactNode;
  items: DockSubItem[];
}

// Group SVG icons -- 20px, stroke-based, consistent with V3IntelligencePanel style
const GroupIcons: Record<string, React.ReactNode> = {
  core: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a7 7 0 0 1 7 7c0 2.4-1.2 4.5-3 5.7V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.3C6.2 13.5 5 11.4 5 9a7 7 0 0 1 7-7z"/>
      <path d="M10 21h4"/>
    </svg>
  ),
  memory: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>
  ),
  orchestration: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  learning: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20V10"/>
      <path d="M18 20V4"/>
      <path d="M6 20v-4"/>
    </svg>
  ),
  tools: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  ),
  security: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
  system: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
      <line x1="8" y1="21" x2="16" y2="21"/>
      <line x1="12" y1="17" x2="12" y2="21"/>
    </svg>
  ),
};

// Sub-item SVG icons -- 16px, stroke-based, consistent with GlobalDock style
const SubIcons: Record<string, React.ReactNode> = {
  // Core
  mode: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a7 7 0 0 1 7 7c0 2.4-1.2 4.5-3 5.7V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.3C6.2 13.5 5 11.4 5 9a7 7 0 0 1 7-7z"/>
      <path d="M10 21h4"/>
    </svg>
  ),
  intent: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 6v6l4 2"/>
    </svg>
  ),
  profile: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  voice: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
      <line x1="12" y1="19" x2="12" y2="23"/>
      <line x1="8" y1="23" x2="16" y2="23"/>
    </svg>
  ),
  // Memory
  'memory-browser': (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
      <line x1="8" y1="7" x2="16" y2="7"/>
      <line x1="8" y1="11" x2="14" y2="11"/>
    </svg>
  ),
  'knowledge-graph': (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="3"/>
      <circle cx="5" cy="19" r="3"/>
      <circle cx="19" cy="19" r="3"/>
      <line x1="10.5" y1="7.5" x2="6.5" y2="17"/>
      <line x1="13.5" y1="7.5" x2="17.5" y2="17"/>
      <line x1="8" y1="19" x2="16" y2="19"/>
    </svg>
  ),
  'working-memory': (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
      <line x1="8" y1="21" x2="16" y2="21"/>
      <line x1="12" y1="17" x2="12" y2="21"/>
    </svg>
  ),
  // Orchestration
  'agent-canvas': (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
      <circle cx="8.5" cy="8.5" r="1.5"/>
      <circle cx="15.5" cy="15.5" r="1.5"/>
      <line x1="9.5" y1="9.5" x2="14.5" y2="14.5"/>
    </svg>
  ),
  'agent-monitor': (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
    </svg>
  ),
  'flow-builder': (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="6" height="6" rx="1"/>
      <rect x="16" y="3" width="6" height="6" rx="1"/>
      <rect x="9" y="15" width="6" height="6" rx="1"/>
      <path d="M5 9v3h14v3"/>
    </svg>
  ),
  'flow-exec': (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 3 19 12 5 21 5 3"/>
    </svg>
  ),
  kanban: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
      <line x1="9" y1="3" x2="9" y2="21"/>
      <line x1="15" y1="3" x2="15" y2="21"/>
    </svg>
  ),
  // Learning
  evolution: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  ),
  report: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  ),
  replay: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 4 15 12 5 20 5 4"/>
      <line x1="19" y1="5" x2="19" y2="19"/>
    </svg>
  ),
  // Tools
  'skill-rec': (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  ),
  'skill-detail': (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  ),
  'hook-editor': (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6"/>
      <polyline points="8 6 2 12 8 18"/>
    </svg>
  ),
  'hook-log': (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
    </svg>
  ),
  'mcp-settings': (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
  'error-heal': (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/>
      <path d="M9 12l2 2 4-4"/>
    </svg>
  ),
  'diff-review': (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <line x1="6" y1="3" x2="6" y2="15"/>
      <circle cx="18" cy="6" r="3"/>
      <circle cx="6" cy="18" r="3"/>
      <path d="M18 9a9 9 0 0 1-9 9"/>
    </svg>
  ),
  // Security
  'audit-log': (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <path d="M9 12l2 2 4-4"/>
    </svg>
  ),
  // System (modal type)
  'global-terminal': (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5"/>
      <line x1="12" y1="19" x2="20" y2="19"/>
    </svg>
  ),
  'exec-analytics': (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  ),
  'token-stats': (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  ),
  compaction: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 14 10 14 10 20"/>
      <polyline points="20 10 14 10 14 4"/>
      <line x1="14" y1="10" x2="21" y2="3"/>
      <line x1="3" y1="21" x2="10" y2="14"/>
    </svg>
  ),
  search: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/>
      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  ),
  settings: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
    </svg>
  ),
};

export const DOCK_GROUPS: DockGroupConfig[] = [
  {
    groupId: 'core',
    label: '核心智能',
    icon: GroupIcons.core,
    items: [
      { id: 'mode', label: '模式切换', description: 'Guided / Expert 双模式', icon: SubIcons.mode, type: 'panel' },
      { id: 'intent', label: '意图理解', description: '自然语言意图解析', icon: SubIcons.intent, type: 'panel' },
      { id: 'profile', label: '用户画像', description: '使用习惯与偏好分析', icon: SubIcons.profile, type: 'panel' },
      { id: 'voice', label: '语音输入', description: '语音命令与输入', icon: SubIcons.voice, type: 'panel' },
    ],
  },
  {
    groupId: 'memory',
    label: '记忆系统',
    icon: GroupIcons.memory,
    items: [
      { id: 'memory-browser', label: '记忆浏览器', description: '浏览与搜索记忆片段', icon: SubIcons['memory-browser'], type: 'drawer' },
      { id: 'knowledge-graph', label: '知识图谱', description: '实体关系可视化', icon: SubIcons['knowledge-graph'], type: 'drawer' },
      { id: 'working-memory', label: '工作记忆', description: '当前会话工作记忆', icon: SubIcons['working-memory'], type: 'drawer' },
    ],
  },
  {
    groupId: 'orchestration',
    label: '编排系统',
    icon: GroupIcons.orchestration,
    items: [
      { id: 'agent-canvas', label: 'Agent 编排', description: 'Agent 可视化编排画布', icon: SubIcons['agent-canvas'], type: 'modal' },
      { id: 'agent-monitor', label: 'Agent 监控', description: 'Agent 运行状态监控', icon: SubIcons['agent-monitor'], type: 'modal' },
      { id: 'flow-builder', label: '流程编排', description: '可视化流程设计器', icon: SubIcons['flow-builder'], type: 'modal' },
      { id: 'flow-exec', label: '流程执行', description: '流程执行与追踪', icon: SubIcons['flow-exec'], type: 'modal' },
      { id: 'kanban', label: '任务看板', description: '看板式任务管理', icon: SubIcons.kanban, type: 'modal' },
    ],
  },
  {
    groupId: 'learning',
    label: '学习系统',
    icon: GroupIcons.learning,
    items: [
      { id: 'evolution', label: '自进化闭环', description: '执行→评分→提取→消除', icon: SubIcons.evolution, type: 'modal' },
      { id: 'report', label: '学习报告', description: 'AI 学习成果报告', icon: SubIcons.report, type: 'drawer' },
      { id: 'replay', label: '会话回放', description: '回放历史会话过程', icon: SubIcons.replay, type: 'drawer' },
    ],
  },
  {
    groupId: 'tools',
    label: '开发工具',
    icon: GroupIcons.tools,
    items: [
      { id: 'skill-rec', label: 'Skill 推荐', description: '智能 Skill 推荐', icon: SubIcons['skill-rec'], type: 'drawer' },
      { id: 'skill-detail', label: 'Skill 详情', description: 'Skill 详细信息', icon: SubIcons['skill-detail'], type: 'drawer' },
      { id: 'hook-editor', label: 'Hook 编辑', description: 'Hook 可视化编辑器', icon: SubIcons['hook-editor'], type: 'modal' },
      { id: 'hook-log', label: 'Hook 日志', description: 'Hook 执行日志', icon: SubIcons['hook-log'], type: 'drawer' },
      { id: 'mcp-settings', label: 'MCP 设置', description: 'MCP 配置管理', icon: SubIcons['mcp-settings'], type: 'modal' },
      { id: 'error-heal', label: '错误自愈', description: '错误自动修复', icon: SubIcons['error-heal'], type: 'modal' },
      { id: 'diff-review', label: 'Diff 审查', description: '代码 Diff 审查', icon: SubIcons['diff-review'], type: 'modal' },
    ],
  },
  {
    groupId: 'security',
    label: '安全审计',
    icon: GroupIcons.security,
    items: [
      { id: 'audit-log', label: '审计日志', description: '操作审计日志', icon: SubIcons['audit-log'], type: 'drawer' },
    ],
  },
  {
    groupId: 'system',
    label: '系统工具',
    icon: GroupIcons.system,
    items: [
      { id: 'global-terminal', label: '全局终端', description: '全局命令行终端', icon: SubIcons['global-terminal'], type: 'modal' },
      { id: 'exec-analytics', label: '执行分析', description: '任务执行分析', icon: SubIcons['exec-analytics'], type: 'modal' },
      { id: 'token-stats', label: 'Token 统计', description: 'Token 用量统计', icon: SubIcons['token-stats'], type: 'modal' },
      { id: 'compaction', label: '上下文压缩', description: '上下文压缩管理', icon: SubIcons.compaction, type: 'modal' },
      { id: 'search', label: '搜索', description: '全局搜索', icon: SubIcons.search, type: 'modal' },
      { id: 'settings', label: '设置', description: '应用设置', icon: SubIcons.settings, type: 'modal' },
    ],
  },
];
