import { describe, it, expect } from 'vitest';
import type { MarkdownCardData } from '@/stores/useTaskStore';

/**
 * 模拟 TerminalView 中的 markdownCards 过滤逻辑
 *
 * 全局视图: 显示全部卡片
 * 工作区视图: 仅显示 workspaceId 匹配当前 tab 的卡片
 */
function filterCards(
  cards: MarkdownCardData[],
  activeTab: string,
  workspaceTabsCount: number,
): MarkdownCardData[] {
  const isWorkspaceView = activeTab !== 'global';
  if (!isWorkspaceView) return cards;
  return cards.filter(c => c.workspaceId === activeTab);
}

describe('workspace markdownCards filter', () => {
  const cardGlobal: MarkdownCardData = {
    id: 'card1', queryId: 'q1', timestamp: 1000,
    query: '全局查询', analysis: '分析',
    workspaceId: undefined, // 旧卡片，无 workspaceId
  };
  const cardWsA: MarkdownCardData = {
    id: 'card2', queryId: 'q2', timestamp: 2000,
    query: '工作区A查询', analysis: '分析',
    workspaceId: 'ws-A',
  };
  const cardWsB: MarkdownCardData = {
    id: 'card3', queryId: 'q3', timestamp: 3000,
    query: '工作区B查询', analysis: '分析',
    workspaceId: 'ws-B',
  };
  const cards = [cardGlobal, cardWsA, cardWsB];

  it('全局视图显示全部卡片（包括无 workspaceId 的旧卡片）', () => {
    const result = filterCards(cards, 'global', 2);
    expect(result).toHaveLength(3);
  });

  it('切换工作区A后仅显示 ws-A 的卡片，不显示无 workspaceId 的旧卡片', () => {
    const result = filterCards(cards, 'ws-A', 2);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('card2');
    expect(result[0].query).toBe('工作区A查询');
  });

  it('切换工作区B后仅显示 ws-B 的卡片', () => {
    const result = filterCards(cards, 'ws-B', 2);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('card3');
  });

  it('工作区C无卡片时显示空列表', () => {
    const result = filterCards(cards, 'ws-C', 2);
    expect(result).toHaveLength(0);
  });

  it('静态工作区标签（无动态tabs）也进入工作区视图', () => {
    const result = filterCards(cards, 'ws-A', 0);
    // 即使 workspaceTabs 为空，只要 activeTab !== 'global' 就进入过滤模式
    expect(result).toHaveLength(1);
    expect(result[0].workspaceId).toBe('ws-A');
  });
});
