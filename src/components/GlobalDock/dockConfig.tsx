import React from 'react';

// Each panel component receives no props -- they manage state internally or via stores
export interface V3PanelProps {}

export interface DockSubItem {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  type: 'inline' | 'modal';
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

export const DOCK_GROUPS: DockGroupConfig[] = [
  { groupId: 'core', label: '核心智能', icon: GroupIcons.core, items: [] },
  { groupId: 'memory', label: '记忆系统', icon: GroupIcons.memory, items: [] },
  { groupId: 'orchestration', label: '编排系统', icon: GroupIcons.orchestration, items: [] },
  { groupId: 'learning', label: '学习系统', icon: GroupIcons.learning, items: [] },
  { groupId: 'tools', label: '开发工具', icon: GroupIcons.tools, items: [] },
  { groupId: 'security', label: '安全审计', icon: GroupIcons.security, items: [] },
  { groupId: 'system', label: '系统工具', icon: GroupIcons.system, items: [] },
];
