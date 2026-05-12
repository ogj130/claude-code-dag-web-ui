/**
 * 集成测试：模拟工作区切换时对话历史联动的完整场景
 *
 * 场景：全局有1条对话，工作区A 0条 → 切换到工作区A → 终端应显示0条
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useTaskStore, type MarkdownCardData } from '@/stores/useTaskStore';
import { useTerminalWorkspaceStore } from '@/stores/useTerminalWorkspaceStore';

// 模拟 TerminalView 中的过滤逻辑（与 src/components/ToolView/TerminalView.tsx 一致）
function filterByWorkspace(
  allCards: MarkdownCardData[],
  activeTab: string,
  workspaceTabsCount: number,
): MarkdownCardData[] {
  const isWorkspaceView = activeTab !== 'global';
  if (!isWorkspaceView) return allCards;
  return allCards.filter(c => c.workspaceId === activeTab);
}

describe('Workspace Tab Switch Integration', () => {
  beforeEach(() => {
    useTaskStore.setState({
      markdownCards: [],
      currentCardByWorkspace: {},
      previousCardByWorkspace: {},
    });
    useTerminalWorkspaceStore.setState({
      activeTab: 'global',
      workspaceTabs: [],
    });
  });

  // ── 场景1：全局有卡片，切换后工作区无卡片 ──
  it('全局有1条记录，切换工作区A后显示空列表', () => {
    // Arrange: 全局 dispatch 产生 1 条卡片，workspaceId='default'
    useTaskStore.setState({
      markdownCards: [
        {
          id: 'card1', queryId: 'q1', timestamp: 1000,
          query: '全局查询', analysis: '分析结果',
          workspaceId: 'default', // 单工作区卡片
        },
      ],
    });
    useTerminalWorkspaceStore.setState({
      activeTab: 'ws-A',
      workspaceTabs: [
        { id: 'ws-A', name: '工作区A', status: 'completed', addedAt: 1000, batchId: 1 },
        { id: 'ws-B', name: '工作区B', status: 'completed', addedAt: 1000, batchId: 1 },
      ],
    });

    const state = useTaskStore.getState();
    const termState = useTerminalWorkspaceStore.getState();

    const filteredCards = filterByWorkspace(
      state.markdownCards,
      termState.activeTab,
      termState.workspaceTabs.length,
    );

    // 工作区A 没有自己的卡片，全局卡片(workspaceId='default')不匹配 → 空列表
    expect(filteredCards).toHaveLength(0);
  });

  // ── 场景2：全局视图显示所有卡片 ──
  it('全局视图显示所有卡片（含 workspaceId=default 和无 workspaceId 的旧卡片）', () => {
    useTaskStore.setState({
      markdownCards: [
        { id: 'card1', queryId: 'q1', timestamp: 1000, query: 'ws-A查询', analysis: '', workspaceId: 'ws-A' },
        { id: 'card2', queryId: 'q2', timestamp: 2000, query: 'ws-B查询', analysis: '', workspaceId: 'ws-B' },
        { id: 'card3', queryId: 'q3', timestamp: 3000, query: '旧查询', analysis: '', workspaceId: undefined },
      ],
    });
    useTerminalWorkspaceStore.setState({
      activeTab: 'global',
      workspaceTabs: [
        { id: 'ws-A', name: 'A', status: 'completed', addedAt: 1000, batchId: 1 },
        { id: 'ws-B', name: 'B', status: 'completed', addedAt: 1000, batchId: 1 },
      ],
    });

    const filteredCards = filterByWorkspace(
      useTaskStore.getState().markdownCards,
      useTerminalWorkspaceStore.getState().activeTab,
      useTerminalWorkspaceStore.getState().workspaceTabs.length,
    );

    expect(filteredCards).toHaveLength(3);
  });

  // ── 场景3：多工作区各自隔离 ──
  it('切换工作区A后仅显示ws-A的卡片', () => {
    useTaskStore.setState({
      markdownCards: [
        { id: 'card1', queryId: 'q1', timestamp: 1000, query: 'ws-A查询', analysis: '', workspaceId: 'ws-A' },
        { id: 'card2', queryId: 'q2', timestamp: 2000, query: 'ws-B查询', analysis: '', workspaceId: 'ws-B' },
        { id: 'card3', queryId: 'q3', timestamp: 3000, query: 'ws-A查询2', analysis: '', workspaceId: 'ws-A' },
      ],
    });
    useTerminalWorkspaceStore.setState({
      activeTab: 'ws-A',
      workspaceTabs: [
        { id: 'ws-A', name: 'A', status: 'completed', addedAt: 1000, batchId: 1 },
        { id: 'ws-B', name: 'B', status: 'completed', addedAt: 1000, batchId: 1 },
      ],
    });

    const filteredCards = filterByWorkspace(
      useTaskStore.getState().markdownCards,
      useTerminalWorkspaceStore.getState().activeTab,
      useTerminalWorkspaceStore.getState().workspaceTabs.length,
    );

    expect(filteredCards).toHaveLength(2);
    expect(filteredCards.every(c => c.workspaceId === 'ws-A')).toBe(true);
  });

  // ── 场景4：静态标签也进入工作区隔离 ──
  it('静态工作区标签（无动态tabs）也按 activeTab 过滤', () => {
    useTaskStore.setState({
      markdownCards: [
        { id: 'card1', queryId: 'q1', timestamp: 1000, query: '查询', analysis: '', workspaceId: 'ws-A' },
        { id: 'card2', queryId: 'q2', timestamp: 2000, query: '查询', analysis: '', workspaceId: 'ws-B' },
      ],
    });
    useTerminalWorkspaceStore.setState({
      activeTab: 'ws-A',
      workspaceTabs: [], // 静态标签场景：无动态执行标签
    });

    const filteredCards = filterByWorkspace(
      useTaskStore.getState().markdownCards,
      useTerminalWorkspaceStore.getState().activeTab,
      useTerminalWorkspaceStore.getState().workspaceTabs.length,
    );

    // activeTab !== 'global' → 进入过滤模式
    expect(filteredCards).toHaveLength(1);
    expect(filteredCards[0].workspaceId).toBe('ws-A');
  });

  // ── 场景5：切换工作区B后仅显示 ws-B 的卡片（合并自 workspaceMarkdownFilter）──
  it('切换工作区B后仅显示ws-B的卡片', () => {
    useTaskStore.setState({
      markdownCards: [
        { id: 'card1', queryId: 'q1', timestamp: 1000, query: 'ws-A查询', analysis: '', workspaceId: 'ws-A' },
        { id: 'card2', queryId: 'q2', timestamp: 2000, query: 'ws-B查询', analysis: '', workspaceId: 'ws-B' },
      ],
    });
    useTerminalWorkspaceStore.setState({
      activeTab: 'ws-B',
      workspaceTabs: [
        { id: 'ws-A', name: 'A', status: 'completed', addedAt: 1000, batchId: 1 },
        { id: 'ws-B', name: 'B', status: 'completed', addedAt: 1000, batchId: 1 },
      ],
    });

    const filteredCards = filterByWorkspace(
      useTaskStore.getState().markdownCards,
      useTerminalWorkspaceStore.getState().activeTab,
      useTerminalWorkspaceStore.getState().workspaceTabs.length,
    );

    expect(filteredCards).toHaveLength(1);
    expect(filteredCards[0].id).toBe('card2');
  });

  // ── 场景6：不存在的工作区显示空列表（合并自 workspaceMarkdownFilter）──
  it('工作区C无卡片时显示空列表', () => {
    useTaskStore.setState({
      markdownCards: [
        { id: 'card1', queryId: 'q1', timestamp: 1000, query: 'ws-A查询', analysis: '', workspaceId: 'ws-A' },
        { id: 'card2', queryId: 'q2', timestamp: 2000, query: 'ws-B查询', analysis: '', workspaceId: 'ws-B' },
      ],
    });
    useTerminalWorkspaceStore.setState({
      activeTab: 'ws-C',
      workspaceTabs: [
        { id: 'ws-A', name: 'A', status: 'completed', addedAt: 1000, batchId: 1 },
        { id: 'ws-B', name: 'B', status: 'completed', addedAt: 1000, batchId: 1 },
        { id: 'ws-C', name: 'C', status: 'completed', addedAt: 1000, batchId: 1 },
      ],
    });

    const filteredCards = filterByWorkspace(
      useTaskStore.getState().markdownCards,
      useTerminalWorkspaceStore.getState().activeTab,
      useTerminalWorkspaceStore.getState().workspaceTabs.length,
    );

    expect(filteredCards).toHaveLength(0);
  });
});
