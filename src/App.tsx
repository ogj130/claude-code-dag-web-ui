import { useEffect } from 'react';
import { useState } from 'react';
import { Toolbar } from './components/Toolbar/Toolbar';
import { DAGCanvas } from './components/DAG/DAGCanvas';
import { ToolViewPanel } from './components/ToolView/ToolViewPanel';
import { BottomBar } from './components/BottomBar/RecentTools';
import { useSessionStore } from './stores/useSessionStore';
import { useWebSocket } from './hooks/useWebSocket';

export function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [viewMode, setViewMode] = useState<'terminal' | 'cards'>('terminal');
  const { activeSessionId, addSession } = useSessionStore();

  // 自动创建默认会话
  useEffect(() => {
    if (!activeSessionId) {
      const id = `session_${Date.now()}`;
      addSession({
        id,
        name: '会话 1',
        projectPath: '/Users/ouguangji/2026/cc-web-ui',
        createdAt: Date.now(),
        isActive: true,
      });
    }
  }, [activeSessionId, addSession]);

  useWebSocket(activeSessionId);

  const applyTheme = (t: 'dark' | 'light') => {
    setTheme(t);
    document.documentElement.classList.remove('theme-dark', 'theme-light');
    document.documentElement.classList.add(`theme-${t}`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Toolbar theme={theme} onThemeChange={applyTheme} />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <DAGCanvas style={{ flex: 1 }} />
        <ToolViewPanel
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          style={{ width: 420 }}
        />
      </div>
      <BottomBar />
    </div>
  );
}
