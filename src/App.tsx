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

  // store 初始化时就有了默认会话，activeSessionId 从第一帧就不是 null
  const { activeSessionId } = useSessionStore();
  const { sendInput } = useWebSocket(activeSessionId);

  const applyTheme = (t: 'dark' | 'light') => {
    setTheme(t);
    document.documentElement.classList.remove('theme-dark', 'theme-light');
    document.documentElement.classList.add(`theme-${t}`);
  };

  // 新建会话时会自动触发 useSessionStore 的 activeSessionId 变化
  // useWebSocket 会自动重连到新的 activeSessionId
  const handleNewSession = () => {
    // 空实现，store.addSession 会自动更新 activeSessionId
    // useWebSocket 靠 activeSessionId 变化自动重连
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Toolbar theme={theme} onThemeChange={applyTheme} onNewSession={handleNewSession} />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <DAGCanvas style={{ flex: 1 }} />
        <ToolViewPanel
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          theme={theme}
          onInput={sendInput}
          style={{ width: 420 }}
        />
      </div>
      <BottomBar />
    </div>
  );
}
