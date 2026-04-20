import type { TabStatus } from '../../stores/useTerminalWorkspaceStore';
import styles from './WorkspaceTagBar.module.css';

export interface WorkspaceTab {
  id: string;
  name: string;
  status: TabStatus;
}

export interface WorkspaceTagBarProps {
  // 固定标签："全局"
  activeTab: 'global' | string;
  onTabChange: (tab: 'global' | string) => void;
  // 动态工作区标签（执行时填充）
  workspaceTabs?: WorkspaceTab[];
  // 回退：静态工作区列表（仅用于单工作区模式）
  workspaces?: Array<{ id: string; name: string; enabled: boolean }>;
  runningWorkspaces?: Set<string>;
}

export function WorkspaceTagBar({
  activeTab,
  onTabChange,
  workspaceTabs = [],
  workspaces = [],
  runningWorkspaces = new Set(),
}: WorkspaceTagBarProps) {
  const enabled = workspaces.filter((ws) => ws.enabled);

  return (
    <div className={styles.bar} role="tablist" aria-label="视图切换">
      {/* 全局标签（固定） */}
      <button
        role="tab"
        aria-selected={activeTab === 'global'}
        data-active={activeTab === 'global' ? 'true' : 'false'}
        className={styles.tag}
        onClick={() => onTabChange('global')}
      >
        全局
      </button>

      {/* 动态工作区标签（执行时显示） */}
      {workspaceTabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            data-active={isActive ? 'true' : 'false'}
            data-status={tab.status}
            className={styles.tag}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.status === 'running' && (
              <span className={styles.pulse} aria-hidden="true" />
            )}
            {tab.status === 'completed' && (
              <span aria-hidden="true">✓</span>
            )}
            {tab.status === 'error' && (
              <span aria-hidden="true">✗</span>
            )}
            {tab.name}
          </button>
        );
      })}

      {/* 静态工作区标签（无动态标签时降级显示） */}
      {workspaceTabs.length === 0 &&
        enabled.map((ws) => {
          const isActive = ws.id === activeTab;
          const isRunning = runningWorkspaces.has(ws.id);
          return (
            <button
              key={ws.id}
              role="tab"
              aria-selected={isActive}
              data-active={isActive ? 'true' : 'false'}
              data-running={isRunning ? 'true' : 'false'}
              className={styles.tag}
              onClick={() => onTabChange(ws.id)}
            >
              {isRunning && (
                <span className={styles.pulse} aria-hidden="true" />
              )}
              {ws.name}
            </button>
          );
        })}
    </div>
  );
}
