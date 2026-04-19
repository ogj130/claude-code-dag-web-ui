import { useState, useEffect, useCallback } from 'react';
import { Toolbar } from './components/Toolbar/Toolbar';
import { DAGCanvas } from './components/DAG/DAGCanvas';
import { TerminalView } from './components/ToolView/TerminalView';
import { BottomBar } from './components/BottomBar/RecentTools';
import { ErrorBoundary } from './components/ErrorBoundary';
import { EmptyState } from './components/EmptyState';
import { ErrorState } from './components/ErrorState';
import { LoadingSkeleton } from './components/LoadingSkeleton';
import { SearchModal } from './components/SearchModal';
import { ThemeSettings } from './components/ThemeSettings';
import { HistoryPanel } from './components/HistoryPanel';
import { ShortcutHelp } from './components/ShortcutHelp';
import { ExecutionAnalytics } from './components/ExecutionAnalytics';
import { TokenAnalytics } from './components/TokenAnalytics';
import { RAGRetrievalModal } from './components/RAGRetrievalModal';
import { CompactionDrawer } from './components/Compaction/CompactionDrawer';
import { RAGContextBar } from './components/RAGContextBar';
import { GlobalTerminalModal } from './components/GlobalTerminal/GlobalTerminalModal';
import { useSessionStore } from './stores/useSessionStore';
import { useTaskStore, type MarkdownCardData } from './stores/useTaskStore';
import { useWebSocket } from './hooks/useWebSocket';
import { useTheme } from './hooks/useTheme';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useClipboardImage } from './hooks/useClipboardImage';
import { useCompressionTrigger } from './hooks/useCompressionTrigger';
import { useWorkspaceModelConfig, getModelOptionsFromConfig } from './hooks/useWorkspaceModelConfig';
import { appendErrorLog } from './utils/errorLogger';
import { getQueriesBySession } from './stores/queryStorage';
import type { SearchResult } from './stores/searchIndex';
import type { QueryRecord } from './lib/db';
import type { ModelConfig } from './types/models';
import './styles/themes.css';

/**
 * 从 QueryRecord 转换为 MarkdownCardData 格式
 */
function convertQueryToCard(q: QueryRecord): MarkdownCardData {
  let summary: string | undefined;
  let status: string | undefined;
  try {
    const meta = q.metadata ? JSON.parse(q.metadata) : {};
    summary = meta.answer || undefined;
    status = meta.status;
  } catch {}
  return {
    id: `card_${q.id}`,
    queryId: q.id,
    timestamp: q.timestamp,
    query: q.query,
    analysis: q.analysis || '',
    summary: summary || (status === 'error' ? `状态: ${status}` : undefined),
    tokenUsage: q.tokenCount,
  };
}

/**
 * 加载指定会话的历史卡片
 */
async function loadSessionCards(sessionId: string): Promise<MarkdownCardData[]> {
  try {
    const result = await getQueriesBySession(sessionId, { page: 1, pageSize: 50 });
    // 只返回已完成的查询
    return result.items
      .filter(q => {
        try {
          const meta = q.metadata ? JSON.parse(q.metadata) : {};
          return meta.status === 'success' || meta.status === 'error';
        } catch { return false; }
      })
      .map(convertQueryToCard);
  } catch (error) {
    console.error('[App] Failed to load session cards:', error);
    return [];
  }
}

export function App() {
  const {
    theme, mode, accent, density, fontSize,
    setMode, setAccent, setDensity, setFontSize,
  } = useTheme();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isThemeSettingsOpen, setIsThemeSettingsOpen] = useState(false);
  const [themeSettingsTab, setThemeSettingsTab] = useState<'theme' | 'embedding' | 'update' | 'model'>('theme');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isShortcutHelpOpen, setIsShortcutHelpOpen] = useState(false);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const [isTokenAnalyticsOpen, setIsTokenAnalyticsOpen] = useState(false);
  const [isRAGOpen, setIsRAGOpen] = useState(false);
  const [isCompactionOpen, setIsCompactionOpen] = useState(false);
  const [isGlobalTerminalOpen, setIsGlobalTerminalOpen] = useState(false);

  // 响应式布局：监听窗口宽度
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 根据窗口宽度计算布局比例
  // < 1024px: DAG flex:1, Terminal 360px固定
  // 1024-1440px: DAG 50%, Terminal 50%
  // > 1440px: DAG 55%, Terminal 45%
  const getLayoutStyle = (): { dag: React.CSSProperties; terminal: React.CSSProperties } => {
    if (windowWidth < 1024) {
      return { dag: { flex: 1 }, terminal: { width: 360, overflow: 'hidden' } };
    }
    if (windowWidth < 1440) {
      return { dag: { flex: 1 }, terminal: { flex: 1, overflow: 'hidden' } };
    }
    return { dag: { flex: 55 }, terminal: { flex: 45, overflow: 'hidden' } };
  };
  const layout = getLayoutStyle();

  const { activeSessionId } = useSessionStore();
  // 获取当前活跃 session 的 projectPath
  const activeSession = useSessionStore(state =>
    state.sessions.find(s => s.id === state.activeSessionId)
  );
  const { config: modelConfig } = useWorkspaceModelConfig(activeSession?.projectPath ?? null);
  const modelOptions = getModelOptionsFromConfig(modelConfig ?? null);
  const { sendInput, disconnect, connect } = useWebSocket(activeSessionId, modelOptions);
  const { nodes, error, isStarting, markdownCards, isRunning, currentCard } = useTaskStore();

  // 发送消息时自动关闭历史面板（避免发送后仍显示旧记录）
  // 注意：这里不用 useEffect 监听 isRunning，因为 isRunning 在 user_input_sent 时不会变，
  // 只在后续 session_start/agent_start 时才变，时机太晚。直接包装 sendInput 最可靠。
  const wrappedSendInput = useCallback((input: string): boolean => {
    setIsHistoryOpen(false);
    return sendInput(input);
  }, [sendInput]);

  // 模型切换处理：更新会话模型并断开连接（下次发送自动用新模型重连）
  const handleSwitchModel = useCallback((config: ModelConfig) => {
    if (!activeSessionId) return;
    useSessionStore.getState().updateSession(activeSessionId, { model: config.model });
    disconnect();
  }, [activeSessionId, disconnect]);

  // V1.4.0: Clipboard image paste detection
  useClipboardImage({
    sessionId: activeSessionId || 'default',
    showToast: true,
    toastMessage: '截图已添加到输入',
  });

  // V1.4.0: Context compression monitoring
  useCompressionTrigger();

  // 快捷键系统（替换原有的 Cmd+K 和 Esc 监听）
  const { shortcuts, conflicts } = useKeyboardShortcuts({
    openSearch: () => setIsSearchOpen(prev => !prev),
    // V1.4.0: 折叠/展开同时处理旧 DAG 分组和新的 Agent Group
    collapseAll: () => {
      useTaskStore.getState().collapseAllDagQueries();
      useTaskStore.getState().collapseAllAgentGroups();
    },
    expandAll: () => {
      useTaskStore.getState().expandAllDagQueries();
      useTaskStore.getState().expandAllAgentGroups();
    },
    openCompaction: () => setIsCompactionOpen(prev => !prev),
    toggleTheme: () => {
      const next = mode === 'dark' ? 'light' : 'dark';
      setMode(next);
    },
    toggleHistory: () => setIsHistoryOpen(prev => !prev),
    closeModal: () => {
      // 关闭所有弹窗（按优先级）
      if (isShortcutHelpOpen) { setIsShortcutHelpOpen(false); return; }
      if (isHistoryOpen) { setIsHistoryOpen(false); return; }
      if (isRAGOpen) { setIsRAGOpen(false); return; }
      if (isCompactionOpen) { setIsCompactionOpen(false); return; }
      if (isAnalyticsOpen) { setIsAnalyticsOpen(false); return; }
      if (isTokenAnalyticsOpen) { setIsTokenAnalyticsOpen(false); return; }
      if (isSearchOpen) { setIsSearchOpen(false); return; }
      if (isThemeSettingsOpen) { setIsThemeSettingsOpen(false); return; }
    },
    showShortcutHelp: () => setIsShortcutHelpOpen(prev => !prev),
    enabled: true,
  });

  // 搜索结果选择回调
  const handleSearchSelect = useCallback((result: SearchResult) => {
    const { doc } = result;
    if (doc.type === 'session') {
      // 切换到指定会话
      useSessionStore.getState().setActive(doc.id);
    } else if (doc.type === 'query' && doc.sessionId) {
      // 切换到问答所属会话
      useSessionStore.getState().setActive(doc.sessionId);
    }
    console.info('[App] Search selected:', doc.id, doc.type);
  }, []);

  // 判断主区域应显示什么：
  // 1. 有错误 → 错误状态
  // 2. DAG 尚未收到任何节点（正在连接中）→ DAG 骨架屏
  // 3. DAG 有节点或正在运行 → 正常内容
  const hasDagNodes = nodes.size > 0;
  const hasHistory = markdownCards.length > 0 || currentCard !== null || isRunning || hasDagNodes;

  // 主区域渲染
  const renderMainContent = () => {
    if (error) {
      return (
        <ErrorState
          message={error}
          onRetry={() => {
            disconnect();
            setTimeout(() => connect(), 100);
          }}
        />
      );
    }
    if (!hasDagNodes && isStarting) {
      return <LoadingSkeleton type="dag" />;
    }
    if (!hasHistory) {
      return <EmptyState type="no-history" />;
    }
    // 正常内容：左侧 DAG，右侧终端+工具卡片（响应式布局）
    return (
      <>
        <ErrorBoundary name="DAGCanvas">
          <DAGCanvas style={layout.dag} />
        </ErrorBoundary>
        <ErrorBoundary name="TerminalView">
          <TerminalView
            theme={theme}
            onInput={wrappedSendInput}
            style={layout.terminal}
          />
        </ErrorBoundary>
      </>
    );
  };

  // 新建会话时会自动触发 useSessionStore 的 activeSessionId 变化
  // useWebSocket 会自动重连到新的 activeSessionId
  const handleNewSession = () => {
    // 空实现，store.addSession 会自动更新 activeSessionId
    // useWebSocket 靠 activeSessionId 变化自动重连
  };

  // 路径切换：先 kill 当前进程，再用新路径重新 spawn
  const handleSwitchSession = (_sessionId: string) => {
    disconnect();
    // 短暂延迟确保旧进程已清理，然后重新连接
    setTimeout(() => connect(), 100);
  };

  // 全局未捕获异常处理器
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      appendErrorLog(
        event.message,
        event.error?.stack,
        undefined
      );
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message = reason instanceof Error ? reason.message : String(reason);
      const stack = reason instanceof Error ? reason.stack : undefined;
      appendErrorLog(`[Promise Rejection] ${message}`, stack, undefined);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  // 从 IndexedDB 加载历史卡片（会话切换时）
  useEffect(() => {
    if (activeSessionId) {
      loadSessionCards(activeSessionId).then(cards => {
        if (cards.length > 0) {
          const store = useTaskStore.getState();
          for (const card of cards) {
            store.addMarkdownCard(card);
          }
        }
      });
    }
  }, [activeSessionId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Toolbar
        theme={theme}
        onThemeChange={(t) => setMode(t)}
        onNewSession={handleNewSession}
        onSwitchSession={handleSwitchSession}
        onOpenThemeSettings={() => { setThemeSettingsTab('theme'); setIsThemeSettingsOpen(true); }}
        onOpenAnalytics={() => setIsAnalyticsOpen(prev => !prev)}
        onOpenTokenAnalytics={() => setIsTokenAnalyticsOpen(prev => !prev)}
        onOpenRAG={() => setIsRAGOpen(prev => !prev)}
        onOpenCompaction={() => setIsCompactionOpen(prev => !prev)}
        onOpenGlobalTerminal={() => setIsGlobalTerminalOpen(true)}
        onSwitchModel={handleSwitchModel}
      />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {renderMainContent()}
      </div>
      <BottomBar />
      <ExecutionAnalytics
        isOpen={isAnalyticsOpen}
        onClose={() => setIsAnalyticsOpen(false)}
      />
      <ThemeSettings
        isOpen={isThemeSettingsOpen}
        activeTab={themeSettingsTab}
        onTabChange={tab => { setThemeSettingsTab(tab); }}
        onClose={() => setIsThemeSettingsOpen(false)}
        mode={mode}
        accent={accent}
        density={density}
        fontSize={fontSize}
        onModeChange={setMode}
        onAccentChange={setAccent}
        onDensityChange={setDensity}
        onFontSizeChange={setFontSize}
      />
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelect={handleSearchSelect}
      />
      <HistoryPanel
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
      />
      <TokenAnalytics
        isOpen={isTokenAnalyticsOpen}
        onClose={() => setIsTokenAnalyticsOpen(false)}
      />
      <RAGContextBar />
      <RAGRetrievalModal
        isOpen={isRAGOpen}
        onClose={() => setIsRAGOpen(false)}
        onOpenSettings={(tab) => {
          setThemeSettingsTab(tab ?? 'embedding');
          setIsRAGOpen(false);
          setIsThemeSettingsOpen(true);
        }}
      />
      <CompactionDrawer
        isOpen={isCompactionOpen}
        onClose={() => setIsCompactionOpen(false)}
      />
      <ShortcutHelp
        isOpen={isShortcutHelpOpen}
        onClose={() => setIsShortcutHelpOpen(false)}
        shortcuts={shortcuts}
        conflicts={conflicts}
      />
      <GlobalTerminalModal
        isOpen={isGlobalTerminalOpen}
        onClose={() => setIsGlobalTerminalOpen(false)}
      />
    </div>
  );
}
