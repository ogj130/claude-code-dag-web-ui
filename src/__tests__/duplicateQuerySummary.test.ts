import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTaskStore } from '@/stores/useTaskStore';
import { useSessionStore } from '@/stores/useSessionStore';
import { useGlobalTerminalStore } from '@/stores/useGlobalTerminalStore';
import { db as statsDb } from '@/stores/db';
import { db as contentDb } from '@/lib/db';

vi.mock('@/stores/queryStorage', () => ({
  createQuery: vi.fn().mockImplementation(async (input) => {
    const id = `query_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    await statsDb.queries.add({
      id,
      sessionId: input.sessionId,
      question: input.question,
      answer: input.answer,
      toolCalls: input.toolCalls,
      tokenUsage: input.tokenUsage,
      duration: input.duration,
      status: input.status,
      workspacePath: input.workspacePath,
      timestamp: Date.now(),
    });
    return { id };
  }),
  updateQueryTokenUsage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/stores/vectorStorage', () => ({
  indexQueryChunk: vi.fn().mockResolvedValue(undefined),
  indexAnswerChunks: vi.fn().mockResolvedValue(undefined),
}));

describe('duplicate query_summary guard', () => {
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
          id: 'session_duplicate_summary',
          name: '重复总结测试',
          projectPath: '/Users/ouguangji/2026/cc-web-ui',
          createdAt: Date.now(),
          isActive: true,
        },
      ],
      activeSessionId: 'session_duplicate_summary',
      isInitialized: true,
    });
  });

  it('should not create duplicate markdown cards for the same query_summary', () => {
    const store = useTaskStore.getState();

    store.handleEvent({
      type: 'user_input_sent',
      queryId: 'query_1',
      text: 'hello',
    });

    store.handleEvent({
      type: 'query_start',
      queryId: 'query_1',
      label: '{"query":"hello"}',
    });

    store.handleEvent({
      type: 'summary_chunk',
      queryId: 'query_1',
      chunk: 'Hello! How can I help?',
    });

    store.handleEvent({
      type: 'query_summary',
      queryId: 'query_1',
      summary: 'Hello! How can I help?',
    });

    store.handleEvent({
      type: 'query_summary',
      queryId: 'query_1',
      summary: 'Hello! How can I help?',
    });

    const state = useTaskStore.getState();
    expect(state.markdownCards).toHaveLength(1);
    expect(state.markdownCards[0].queryId).toBe('query_1');
    expect(state.markdownCards[0].query).toBe('hello');
    expect(state.markdownCards[0].summary).toBe('Hello! How can I help?');
  });

  it('should not duplicate summaryChunks when the same summary_chunk is processed twice (double WS connection scenario)', () => {
    const store = useTaskStore.getState();

    // Simulate: both WS handlers receive the same summary_chunk
    store.handleEvent({ type: 'summary_chunk', queryId: 'query_2', chunk: 'Summary part 1' });
    store.handleEvent({ type: 'summary_chunk', queryId: 'query_2', chunk: 'Summary part 1' }); // duplicate from second WS
    store.handleEvent({ type: 'summary_chunk', queryId: 'query_2', chunk: 'Summary part 2' });
    store.handleEvent({ type: 'summary_chunk', queryId: 'query_2', chunk: 'Summary part 2' }); // duplicate from second WS

    const state = useTaskStore.getState();
    // Should only have 2 unique chunks, not 4
    expect(state.summaryChunks).toHaveLength(2);
    expect(state.summaryChunks).toEqual(['Summary part 1', 'Summary part 2']);
  });

  it('should not create duplicate markdownCards when the same query_summary arrives from two WS handlers', () => {
    const store = useTaskStore.getState();

    store.handleEvent({ type: 'user_input_sent', queryId: 'query_3', text: 'test query' });
    store.handleEvent({ type: 'query_start', queryId: 'query_3', label: '{"query":"test query"}' });
    store.handleEvent({ type: 'summary_chunk', queryId: 'query_3', chunk: 'Answer content' });

    // Both WS handlers (useWebSocket + globalDispatchExecutor) receive the same query_summary
    store.handleEvent({ type: 'query_summary', queryId: 'query_3', summary: 'Answer content', endToolIds: [] });
    store.handleEvent({ type: 'query_summary', queryId: 'query_3', summary: 'Answer content', endToolIds: [] });

    const state = useTaskStore.getState();
    expect(state.markdownCards).toHaveLength(1);
    // summaryChunks is cleared after query_summary (regardless of deduplication)
    expect(state.summaryChunks).toHaveLength(0);
  });
});

describe('useGlobalTerminalStore appendChunk deduplication', () => {
  beforeEach(() => {
    useGlobalTerminalStore.getState().reset();
  });

  it('should not duplicate chunks when the same chunk is appended twice (double WS connection scenario)', () => {
    const store = useGlobalTerminalStore.getState();
    const sessionId = 'session_test';

    // Simulate: both WS handlers (useWebSocket + globalDispatchExecutor) receive the same terminalChunk
    store.appendChunk(sessionId, 'First line\n');
    store.appendChunk(sessionId, 'First line\n'); // duplicate from second WS handler
    store.appendChunk(sessionId, 'Second line\n');
    store.appendChunk(sessionId, 'Second line\n'); // duplicate from second WS handler

    const state = useGlobalTerminalStore.getState();
    expect(state.workspaceChunks[sessionId]).toHaveLength(2);
    expect(state.workspaceChunks[sessionId]).toEqual(['First line\n', 'Second line\n']);
    expect(state.mergedOrder).toHaveLength(2);
  });

  it('should allow different workspaceIds to have independent chunks', () => {
    const store = useGlobalTerminalStore.getState();

    store.appendChunk('workspace_1', 'Chunk A');
    store.appendChunk('workspace_2', 'Chunk B');
    store.appendChunk('workspace_1', 'Chunk C');

    const state = useGlobalTerminalStore.getState();
    expect(state.workspaceChunks['workspace_1']).toEqual(['Chunk A', 'Chunk C']);
    expect(state.workspaceChunks['workspace_2']).toEqual(['Chunk B']);
    expect(state.mergedOrder).toHaveLength(3);
  });

  it('should not skip chunks with same content but different workspaceIds', () => {
    const store = useGlobalTerminalStore.getState();

    store.appendChunk('workspace_1', 'Same content');
    store.appendChunk('workspace_2', 'Same content');

    const state = useGlobalTerminalStore.getState();
    expect(state.workspaceChunks['workspace_1']).toEqual(['Same content']);
    expect(state.workspaceChunks['workspace_2']).toEqual(['Same content']);
    expect(state.mergedOrder).toHaveLength(2);
  });
});

describe('useTaskStore workspace-isolated card state', () => {
  beforeEach(() => {
    useTaskStore.getState().reset();
  });

  it('should isolate currentCard by workspaceId when global dispatch sends events for different workspaces', () => {
    const store = useTaskStore.getState();

    // Simulate: Workspace A sends user_input_sent (via globalDispatchExecutor with workspaceId)
    store.handleEvent({
      type: 'user_input_sent',
      queryId: 'query_A',
      text: 'Question from workspace A',
      workspaceId: 'workspace_A',
    } as any);

    // Simulate: Workspace B sends user_input_sent (different queryId, via globalDispatchExecutor)
    // This overwrites global currentCard but archives workspace A's card to previousCardByWorkspace
    store.handleEvent({
      type: 'user_input_sent',
      queryId: 'query_B',
      text: 'Question from workspace B',
      workspaceId: 'workspace_B',
    } as any);

    // Use getState() to read fresh state after set() updates
    const state = useTaskStore.getState();
    // Global currentCard should be workspace B's (last one to write)
    expect(state.currentCard?.queryId).toBe('query_B');
    // Workspace A's card should be in currentCardByWorkspace (still active for its workspace)
    expect(state.currentCardByWorkspace['workspace_A']?.queryId).toBe('query_A');
    // Workspace B's card should be in currentCardByWorkspace
    expect(state.currentCardByWorkspace['workspace_B']?.queryId).toBe('query_B');
  });

  it('should find workspace-specific card when query_summary arrives for a non-active workspace', () => {
    const store = useTaskStore.getState();

    // Workspace A sends query (via global dispatch with workspaceId)
    store.handleEvent({
      type: 'user_input_sent',
      queryId: 'query_A',
      text: 'WS A question',
      workspaceId: 'workspace_A',
    } as any);

    // Workspace B sends query (via global dispatch, overwrites global currentCard)
    store.handleEvent({
      type: 'user_input_sent',
      queryId: 'query_B',
      text: 'WS B question',
      workspaceId: 'workspace_B',
    } as any);

    // Workspace A's query_summary arrives (should find workspace_A's card via workspaceId)
    store.handleEvent({
      type: 'query_summary',
      queryId: 'query_A',
      summary: 'Summary for workspace A',
      endToolIds: [],
      workspaceId: 'workspace_A',
    } as any);

    // Use getState() to read fresh state after set() updates
    const state = useTaskStore.getState();
    // Workspace A's card should be converted to markdownCard (with summary)
    expect(state.markdownCards.some(c => c.queryId === 'query_A' && c.summary === 'Summary for workspace A')).toBe(true);
    // Workspace A's card should be cleared from workspace-specific state
    expect(state.currentCardByWorkspace['workspace_A']).toBeUndefined();
    // Global currentCard should still be workspace B's (not cleared by A's query_summary)
    expect(state.currentCard?.queryId).toBe('query_B');
  });
});
