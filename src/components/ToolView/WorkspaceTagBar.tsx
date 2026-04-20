import type { Workspace } from '@/types/workspace';
import styles from './WorkspaceTagBar.module.css';

export interface WorkspaceTagBarProps {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  onSwitch: (workspaceId: string) => void;
  runningWorkspaces?: Set<string>;
}

export function WorkspaceTagBar({
  workspaces,
  activeWorkspaceId,
  onSwitch,
  runningWorkspaces = new Set(),
}: WorkspaceTagBarProps) {
  const enabled = workspaces.filter((ws) => ws.enabled);

  return (
    <div className={styles.bar} role="tablist" aria-label="工作区切换">
      {enabled.map((ws) => {
        const isActive = ws.id === activeWorkspaceId;
        const isRunning = runningWorkspaces.has(ws.id);

        return (
          <button
            key={ws.id}
            role="tab"
            aria-selected={isActive}
            data-active={isActive ? 'true' : 'false'}
            data-running={isRunning ? 'true' : 'false'}
            className={styles.tag}
            onClick={() => onSwitch(ws.id)}
          >
            {isRunning && <span className={styles.pulse} aria-hidden="true" />}
            {ws.name}
          </button>
        );
      })}
    </div>
  );
}
