import { useTaskStore } from '../stores/useTaskStore';
import type { RAGChunk } from '../types/events';

describe('RAG Chunk JSON storage', () => {
  beforeEach(() => {
    useTaskStore.getState().reset();
  });

  it('should parse JSON payload with ragChunks in user_input_sent', () => {
    const chunks: RAGChunk[] = [
      {
        id: 'chunk-1',
        content: 'React Hooks 是 React 16.8 引入的新特性',
        score: 0.87,
        sourceSessionId: 'session-123',
        sourceSessionTitle: 'React 讨论',
        timestamp: 1710000000,
      },
    ];

    const jsonPayload = JSON.stringify({ query: '解释一下 useMemo', ragChunks: chunks });

    // 触发 user_input_sent 事件
    useTaskStore.getState().handleEvent({
      type: 'user_input_sent',
      queryId: 'q1',
      text: jsonPayload,
    });

    const state = useTaskStore.getState();
    expect(state.currentCard?.query).toBe('解释一下 useMemo');
    expect(state.currentCard?.ragChunks).toHaveLength(1);
    expect(state.currentCard?.ragChunks?.[0].id).toBe('chunk-1');
    expect(state.currentCard?.ragChunks?.[0].score).toBe(0.87);
  });

  it('should handle plain text payload (no RAG)', () => {
    useTaskStore.getState().handleEvent({
      type: 'user_input_sent',
      queryId: 'q2',
      text: '普通查询问题',
    });

    const state = useTaskStore.getState();
    expect(state.currentCard?.query).toBe('普通查询问题');
    expect(state.currentCard?.ragChunks).toBeUndefined();
  });

  it('should set pendingRAGItems when ragChunks present', () => {
    const chunks: RAGChunk[] = [
      {
        id: 'chunk-x',
        content: 'useState 是最常用的 Hook',
        score: 0.82,
        sourceSessionId: 'session-456',
        sourceSessionTitle: 'Hooks 基础',
        timestamp: 1710000001,
      },
    ];

    useTaskStore.getState().handleEvent({
      type: 'user_input_sent',
      queryId: 'q3',
      text: JSON.stringify({ query: 'useState 是什么', ragChunks: chunks }),
    });

    const state = useTaskStore.getState();
    expect(state.pendingRAGItems).toHaveLength(1);
    expect(state.pendingRAGItems[0].id).toBe('chunk-x');
  });
});
