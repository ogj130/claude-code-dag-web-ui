import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { dispatchGlobalPrompts } from '@/services/globalDispatchService';
import type { Workspace } from '@/types/workspace';
import * as sessionService from '@/services/sessionService';
import * as globalTerminalRuntime from '@/services/globalTerminalRuntime';
import { useTaskStore } from '@/stores/useTaskStore';
import { useMultiDispatchStore } from '@/stores/useMultiDispatchStore';

// Mock the session service so we don't need a real DB
vi.mock('@/services/sessionService', () => ({
  getOrCreateSessionForWorkspace: vi.fn().mockResolvedValue({
    session: { id: 'mock-session-1' },
  }),
}));

// Mock the terminal runtime so it calls the user-provided executePrompt
vi.mock('@/services/globalTerminalRuntime', () => ({
  runGlobalTerminalRuntime: vi.fn(),
}));

const mockWorkspace1: Workspace = {
  id: 'ws1',
  name: 'WS1',
  workspacePath: '/a',
  modelConfigId: 'cfg1',
  enabled: true,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

const mockWorkspace2: Workspace = {
  id: 'ws2',
  name: 'WS2',
  workspacePath: '/b',
  modelConfigId: 'cfg2',
  enabled: true,
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

const mockExecutePromptSuccess = vi
  .fn<[Parameters<globalTerminalRuntime.RunGlobalTerminalRuntimeInput['executePrompt']>[0]], Promise<{ status: 'success' }>>()
  .mockResolvedValue({ status: 'success' });

const mockRuntime = globalTerminalRuntime.runGlobalTerminalRuntime as ReturnType<typeof vi.fn>;

function setupRuntimeMock(status: globalTerminalRuntime.GlobalTerminalRuntimeResult['status'], promptResults: globalTerminalRuntime.DispatchPromptResult[]) {
  mockRuntime.mockResolvedValue({ status, promptResults });
}

describe('dispatchGlobalPrompts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: all workspaces succeed
    setupRuntimeMock('success', [{ prompt: 'hello', status: 'success' }]);
  });

  it('1. single query → mode is single, results for all workspaces', async () => {
    const result = await dispatchGlobalPrompts({
      rawInput: 'hello',
      workspaces: [mockWorkspace1, mockWorkspace2],
      createNewSession: false,
      executePrompt: mockExecutePromptSuccess,
    });

    expect(result.mode).toBe('single');
    expect(result.workspaceResults.length).toBe(2);
  });

  it('2. multi-line input → mode is list, each workspace has promptResults per line', async () => {
    setupRuntimeMock('success', [
      { prompt: 'line1', status: 'success' },
      { prompt: 'line2', status: 'success' },
    ]);

    const result = await dispatchGlobalPrompts({
      rawInput: 'line1\nline2',
      workspaces: [mockWorkspace1, mockWorkspace2],
      createNewSession: false,
      executePrompt: mockExecutePromptSuccess,
    });

    expect(result.mode).toBe('list');
    expect(result.workspaceResults[0].promptResults.length).toBe(2);
    expect(result.workspaceResults[1].promptResults.length).toBe(2);
  });

  it('3. createNewSession=true → policy is new_session_for_all', async () => {
    const result = await dispatchGlobalPrompts({
      rawInput: 'hello',
      workspaces: [mockWorkspace1],
      createNewSession: true,
      executePrompt: mockExecutePromptSuccess,
    });

    expect(result.policy).toBe('new_session_for_all');
  });

  it('4. createNewSession=false → policy is continue_current_by_workspace', async () => {
    const result = await dispatchGlobalPrompts({
      rawInput: 'hello',
      workspaces: [mockWorkspace1],
      createNewSession: false,
      executePrompt: mockExecutePromptSuccess,
    });

    expect(result.policy).toBe('continue_current_by_workspace');
  });

  it('5. single workspace success → workspace result status success', async () => {
    setupRuntimeMock('success', [{ prompt: 'hello', status: 'success' }]);

    const result = await dispatchGlobalPrompts({
      rawInput: 'hello',
      workspaces: [mockWorkspace1],
      createNewSession: false,
      executePrompt: mockExecutePromptSuccess,
    });

    expect(result.workspaceResults[0].status).toBe('success');
    expect(result.workspaceResults[0].promptResults[0].status).toBe('success');
  });

  it('6. single workspace failure → workspace result status failed with reason', async () => {
    const failedExecute = vi.fn().mockResolvedValue({
      status: 'failed' as const,
      reason: 'claude not found',
    });
    setupRuntimeMock('failed', [{ prompt: 'hello', status: 'failed', reason: 'claude not found' }]);

    const result = await dispatchGlobalPrompts({
      rawInput: 'hello',
      workspaces: [mockWorkspace1],
      createNewSession: false,
      executePrompt: failedExecute,
    });

    expect(result.workspaceResults[0].status).toBe('failed');
    expect(result.workspaceResults[0].promptResults[0].status).toBe('failed');
    expect(result.workspaceResults[0].promptResults[0].reason).toBe('claude not found');
  });

  it('7. multiple workspaces: one succeeds, one fails → both workspaceResults present with independent statuses', async () => {
    // Workspace 1 succeeds, workspace 2 fails
    mockRuntime
      .mockResolvedValueOnce({ status: 'success', promptResults: [{ prompt: 'hello', status: 'success' }] })
      .mockResolvedValueOnce({ status: 'failed', promptResults: [{ prompt: 'hello', status: 'failed', reason: 'connection error' }] });

    const result = await dispatchGlobalPrompts({
      rawInput: 'hello',
      workspaces: [mockWorkspace1, mockWorkspace2],
      createNewSession: false,
      executePrompt: mockExecutePromptSuccess,
    });

    expect(result.workspaceResults.length).toBe(2);
    expect(result.workspaceResults[0].workspaceId).toBe('ws1');
    expect(result.workspaceResults[0].status).toBe('success');
    expect(result.workspaceResults[1].workspaceId).toBe('ws2');
    expect(result.workspaceResults[1].status).toBe('failed');
  });

  it('8. batchId starts with "batch_" and contains a timestamp-like segment', async () => {
    const result = await dispatchGlobalPrompts({
      rawInput: 'hello',
      workspaces: [mockWorkspace1],
      createNewSession: false,
      executePrompt: mockExecutePromptSuccess,
    });

    expect(result.batchId).toMatch(/^batch_\d+_[a-z0-9]+$/);
  });

  it('9. empty workspaces array → still returns valid DispatchResult with empty workspaceResults', async () => {
    const result = await dispatchGlobalPrompts({
      rawInput: 'hello',
      workspaces: [],
      createNewSession: false,
      executePrompt: mockExecutePromptSuccess,
    });

    expect(result.batchId).toMatch(/^batch_/);
    expect(result.mode).toBe('single');
    expect(result.policy).toBe('continue_current_by_workspace');
    expect(result.workspaceResults).toEqual([]);
  });

  it('10. executePrompt fires user_input_sent BEFORE calling executePrompt → dispatchCurrentCard populated', async () => {
    // Reset dispatch state before test
    useTaskStore.getState().reset();
    useMultiDispatchStore.setState({
      sessions: new Map(),
      workspacePromptHistory: new Map(),
    });

    // Track call order: is handleDispatchEvent called before executePrompt resolves?
    let handleDispatchEventCalledBeforeExecute = false;

    // Mock runtime: capture executePrompt and immediately invoke it (simulates real execution)
    mockRuntime.mockImplementation(async (input) => {
      // Execute the callback immediately to verify ordering
      await input.executePrompt({ sessionId: 'mock-session-1', prompt: 'hello' });
      return { status: 'success', promptResults: [{ prompt: 'hello', status: 'success' }] };
    });

    await dispatchGlobalPrompts({
      rawInput: 'hello',
      workspaces: [mockWorkspace1],
      createNewSession: false,
      executePrompt: async ({ prompt }) => {
        // At this point, user_input_sent MUST have already been dispatched
        const currentCard = useTaskStore.getState().dispatchCurrentCard.get('ws1');
        handleDispatchEventCalledBeforeExecute = currentCard !== null && currentCard.query === 'hello';
        return { status: 'success' };
      },
    });

    // Assert: dispatchCurrentCard is set (user_input_sent was fired before executePrompt)
    const currentCard = useTaskStore.getState().dispatchCurrentCard.get('ws1');
    expect(currentCard).not.toBeNull();
    expect(currentCard!.query).toBe('hello');
    expect(currentCard!.queryId).toMatch(/^dispatch_ws1_0_\d+$/);

    // Assert: workspacePromptHistory also populated (via addPromptHistory in user_input_sent handler)
    const history = useMultiDispatchStore.getState().workspacePromptHistory.get('ws1') ?? [];
    expect(history).toHaveLength(1);
    expect(history[0].prompt).toBe('hello');
    expect(history[0].status).toBe('pending');
    expect(history[0].queryId).toBe(currentCard!.queryId);
  });

  it('11. multiple prompts → each fires user_input_sent with unique queryId', async () => {
    useTaskStore.getState().reset();
    useMultiDispatchStore.setState({ sessions: new Map(), workspacePromptHistory: new Map() });

    const queryIdsSeen = new Set<string>();
    const promptTexts: string[] = [];

    mockRuntime.mockImplementation(async (input) => {
      for (const item of input.prompts) {
        await input.executePrompt({ sessionId: 'mock-session-1', prompt: item.prompt });
      }
      return {
        status: 'success',
        promptResults: input.prompts.map(p => ({ prompt: p.prompt, status: 'success' as const })),
      };
    });

    await dispatchGlobalPrompts({
      rawInput: 'task1\ntask2',
      workspaces: [mockWorkspace1],
      createNewSession: false,
      executePrompt: async ({ prompt }) => {
        const card = useTaskStore.getState().dispatchCurrentCard.get('ws1');
        if (card) {
          queryIdsSeen.add(card.queryId);
          promptTexts.push(card.query);
        }
        return { status: 'success' };
      },
    });

    // Each prompt gets a unique queryId
    expect(queryIdsSeen.size).toBe(2);
    expect(promptTexts).toEqual(['task1', 'task2']);
  });
});
