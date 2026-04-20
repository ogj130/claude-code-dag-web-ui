import { describe, it, expect, beforeEach } from 'vitest';
import { useGlobalTerminalStore } from '@/stores/useGlobalTerminalStore';

describe('useGlobalTerminalStore', () => {
  beforeEach(() => {
    useGlobalTerminalStore.setState({ workspaceChunks: {}, mergedOrder: [] });
  });

  it('appendChunk adds chunk to correct workspace', () => {
    useGlobalTerminalStore.getState().appendChunk('ws-A', 'hello');
    expect(useGlobalTerminalStore.getState().workspaceChunks['ws-A']).toEqual(['hello']);
  });

  it('appendChunk accumulates multiple chunks per workspace', () => {
    useGlobalTerminalStore.getState().appendChunk('ws-A', 'chunk1');
    useGlobalTerminalStore.getState().appendChunk('ws-A', 'chunk2');
    expect(useGlobalTerminalStore.getState().workspaceChunks['ws-A']).toEqual(['chunk1', 'chunk2']);
  });

  it('getMergedContent returns interleaved chunks in arrival order', () => {
    useGlobalTerminalStore.getState().appendChunk('ws-A', 'A1');
    useGlobalTerminalStore.getState().appendChunk('ws-B', 'B1');
    useGlobalTerminalStore.getState().appendChunk('ws-A', 'A2');
    const merged = useGlobalTerminalStore.getState().getMergedContent();
    expect(merged).toEqual([
      { workspaceId: 'ws-A', chunk: 'A1' },
      { workspaceId: 'ws-B', chunk: 'B1' },
      { workspaceId: 'ws-A', chunk: 'A2' },
    ]);
  });

  it('reset clears all state', () => {
    useGlobalTerminalStore.getState().appendChunk('ws-A', 'hello');
    useGlobalTerminalStore.getState().reset();
    expect(useGlobalTerminalStore.getState().workspaceChunks).toEqual({});
    expect(useGlobalTerminalStore.getState().mergedOrder).toEqual([]);
  });
});
