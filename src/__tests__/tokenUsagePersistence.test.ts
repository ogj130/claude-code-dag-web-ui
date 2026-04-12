import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTaskStore } from '@/stores/useTaskStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { db as statsDb } from '@/stores/db';
import { db as contentDb } from '@/lib/db';

vi.mock('@/stores/vectorStorage', () => ({
  indexQueryChunk: vi.fn().mockResolvedValue(undefined),
  indexAnswerChunks: vi.fn().mockResolvedValue(undefined),
}));

describe('token usage persistence timing', () => {
  beforeEach(async () => {
    useTaskStore.getState().reset();

    await contentDb.queries.clear();
    await contentDb.sessions.clear();
    await statsDb.queries.clear();
    await statsDb.sessions.clear();
    await statsDb.toolCalls.clear();
    await statsDb.sessionShards.clear();

    useSessionStore.setState({
      sessions: [
        {
          id: 'session_test_token',
          name: '测试会话',
          projectPath: '/Users/ouguangji/2026/cc-web-ui',
          createdAt: Date.now(),
          isActive: true,
        },
      ],
      activeSessionId: 'session_test_token',
      isInitialized: true,
    });
  });

  async function waitForStatsQuery(tokenUsageExpected?: number) {
    for (let i = 0; i < 50; i += 1) {
      const row = await statsDb.queries.toArray().then(rows => rows[0]);
      if (row) {
        // 如果指定了期望 tokenUsage，等待异步 updateQueryTokenUsage 完成
        if (tokenUsageExpected !== undefined) {
          if (row.tokenUsage === tokenUsageExpected) return row;
        } else {
          return row;
        }
      }
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    throw new Error('stats query was not persisted in time');
  }

  it('persists correct tokenUsage when token_usage arrives AFTER query_summary (pending update path)', async () => {
    const store = useTaskStore.getState();

    store.handleEvent({
      type: 'user_input_sent',
      queryId: 'q_token_after_summary',
      text: '解释一下 TypeScript 泛型',
    });

    store.handleEvent({
      type: 'query_start',
      queryId: 'q_token_after_summary',
      label: '解释一下 TypeScript 泛型',
    });

    // 先触发 query_summary（此时 tokenUsage 未知，写入 0）
    store.handleEvent({
      type: 'query_summary',
      queryId: 'q_token_after_summary',
      summary: '这是一个关于 TypeScript 泛型的回答',
    });

    // token_usage 后到达，触发 pending 更新逻辑
    store.handleEvent({
      type: 'token_usage',
      usage: {
        input: 257,
        output: 400,
      },
    });

    // 等待 query_record 出现 AND updateQueryTokenUsage 异步更新完成
    const persisted = await waitForStatsQuery(657);

    expect(persisted.question).toBe('解释一下 TypeScript 泛型');
    expect(persisted.workspacePath).toBe('/Users/ouguangji/2026/cc-web-ui');
    expect(persisted.tokenUsage).toBe(657);
  });

  it('persists correct tokenUsage when token_usage arrives BEFORE query_summary (direct update path)', async () => {
    const store = useTaskStore.getState();

    store.handleEvent({
      type: 'user_input_sent',
      queryId: 'q_token_before_summary',
      text: 'React useEffect 怎么用',
    });

    store.handleEvent({
      type: 'query_start',
      queryId: 'q_token_before_summary',
      label: 'React useEffect 怎么用',
    });

    // token_usage 先到达，直接触发 DB 更新（savedQueryId 已存在）
    store.handleEvent({
      type: 'token_usage',
      usage: {
        input: 300,
        output: 500,
      },
    });

    // query_summary 后到达，写入时 tokenUsage 从 Map 获取
    store.handleEvent({
      type: 'query_summary',
      queryId: 'q_token_before_summary',
      summary: 'useEffect 是 React 的 Hook',
    });

    const persisted = await waitForStatsQuery();

    expect(persisted.question).toBe('React useEffect 怎么用');
    expect(persisted.tokenUsage).toBe(800);
  });
});
