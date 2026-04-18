import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createWorkspace,
  edb as workspaceEdb,
  getAllWorkspaces,
} from '@/stores/workspaceStorage';
import { saveConfig, edb as modelConfigEdb } from '@/stores/modelConfigStorage';
import {
  createSession,
  edb as sessionEdb,
  getSession,
} from '@/stores/sessionStorage';
import {
  bindSessionToWorkspace,
  edb as bindingEdb,
  getLatestSessionBindingByWorkspaceId,
} from '@/stores/sessionWorkspaceBindingStorage';
import {
  dispatchGlobalPrompts,
  dispatchGlobalPromptsWithDefaults,
} from '@/services/globalDispatchService';

describe('globalDispatchService', () => {
  beforeEach(async () => {
    await bindingEdb.bindings.clear();
    await sessionEdb.sessions.clear();
    await workspaceEdb.workspaces.clear();
    await modelConfigEdb.configs.clear();
    vi.restoreAllMocks();
  });

  // ─────────────────────────────────────────────
  // Helper: 创建两个带独立模型配置的工作区
  // ─────────────────────────────────────────────
  async function setupTwoWorkspaces() {
    const configA = await saveConfig({
      name: 'Claude Sonnet',
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      isDefault: true,
    });
    const configB = await saveConfig({
      name: 'Claude Opus',
      provider: 'anthropic',
      model: 'claude-opus-4-6',
      isDefault: false,
    });

    const workspaceA = await createWorkspace({
      name: 'Workspace A',
      workspacePath: '/tmp/project-a',
      modelConfigId: configA.id,
      enabled: true,
    });

    const workspaceB = await createWorkspace({
      name: 'Workspace B',
      workspacePath: '/tmp/project-b',
      modelConfigId: configB.id,
      enabled: true,
    });

    return { workspaceA, workspaceB, configA, configB };
  }

  // ─────────────────────────────────────────────
  // 测试：单行输入 → single 模式，两个工作区各执行一次
  // ─────────────────────────────────────────────
  it('single 模式下两个工作区各执行一次 prompt', async () => {
    const { workspaceA, workspaceB } = await setupTwoWorkspaces();
    const executed: Array<{ workspaceId: string; sessionId: string; prompt: string }> = [];

    const result = await dispatchGlobalPrompts({
      rawInput: '实现 LRU 缓存',
      workspaces: [workspaceA, workspaceB],
      createNewSession: false,
      executePrompt: async ({ workspaceId, sessionId, prompt }) => {
        executed.push({ workspaceId, sessionId, prompt });
        return { status: 'success' };
      },
    });

    expect(result.mode).toBe('single');
    expect(result.policy).toBe('continue_current_by_workspace');
    expect(result.workspaceResults).toHaveLength(2);

    // 两个工作区都执行了
    expect(executed).toHaveLength(2);
    expect(executed[0]?.workspaceId).toBe(workspaceA.id);
    expect(executed[1]?.workspaceId).toBe(workspaceB.id);
    expect(executed[0]?.prompt).toBe('实现 LRU 缓存');
    expect(executed[1]?.prompt).toBe('实现 LRU 缓存');

    // 每个工作区各创建一个新 session（无历史）
    const sessionA = await getSession(result.workspaceResults[0].sessionId!);
    const sessionB = await getSession(result.workspaceResults[1].sessionId!);
    expect(sessionA?.workspacePath).toBe('/tmp/project-a');
    expect(sessionB?.workspacePath).toBe('/tmp/project-b');

    // binding 记录 createdBy = 'global-dispatch'
    const bindingA = await getLatestSessionBindingByWorkspaceId(workspaceA.id);
    const bindingB = await getLatestSessionBindingByWorkspaceId(workspaceB.id);
    expect(bindingA?.createdBy).toBe('global-dispatch');
    expect(bindingB?.createdBy).toBe('global-dispatch');
  });

  // ─────────────────────────────────────────────
  // 测试：多行输入 → list 模式，按顺序逐个执行
  // ─────────────────────────────────────────────
  it('list 模式下顺序执行多个 prompt 并返回 partial', async () => {
    const { workspaceA } = await setupTwoWorkspaces();
    const executionOrder: string[] = [];

    const result = await dispatchGlobalPrompts({
      rawInput: '问题1\n问题2\n问题3',
      workspaces: [workspaceA],
      createNewSession: false,
      executePrompt: async ({ workspaceId, sessionId, prompt }) => {
        executionOrder.push(prompt);
        if (prompt === '问题2') {
          return { status: 'failed', reason: 'timeout' };
        }
        return { status: 'success' };
      },
    });

    expect(result.mode).toBe('list');
    expect(result.workspaceResults).toHaveLength(1);
    expect(result.workspaceResults[0].status).toBe('partial');
    expect(executionOrder).toEqual(['问题1', '问题2', '问题3']);
    expect(result.workspaceResults[0].promptResults).toEqual([
      { prompt: '问题1', status: 'success' },
      { prompt: '问题2', status: 'failed', reason: 'timeout' },
      { prompt: '问题3', status: 'success' },
    ]);
  });

  // ─────────────────────────────────────────────
  // 测试：createNewSession=true → 每个工作区创建新会话
  // ─────────────────────────────────────────────
  it('createNewSession=true 时强制每个工作区创建新会话', async () => {
    const { workspaceA } = await setupTwoWorkspaces();

    // 预先创建一个历史会话
    const existingSession = await createSession({
      title: 'Existing',
      workspacePath: '/tmp/project-a',
    });
    await bindSessionToWorkspace(existingSession.id, workspaceA.id, 'manual');
    const existingBinding = await getLatestSessionBindingByWorkspaceId(workspaceA.id);

    let usedSessionId: string | undefined;
    const result = await dispatchGlobalPrompts({
      rawInput: '新问题',
      workspaces: [workspaceA],
      createNewSession: true,
      executePrompt: async ({ workspaceId, sessionId, prompt }) => {
        usedSessionId = sessionId;
        return { status: 'success' };
      },
    });

    expect(usedSessionId).not.toBe(existingSession.id);
    expect(result.workspaceResults[0].sessionId).not.toBe(existingSession.id);
    expect(result.policy).toBe('new_session_for_all');

    // 旧 binding 仍存在（按主键直接读取，不依赖 lastActiveAt 排序）
    const oldBinding = await bindingEdb.bindings.get(existingSession.id);
    expect(oldBinding?.sessionId).toBe(existingSession.id);
  });

  // ─────────────────────────────────────────────
  // 测试：复用历史会话
  // ─────────────────────────────────────────────
  it('createNewSession=false 时复用最近活跃会话', async () => {
    const { workspaceA } = await setupTwoWorkspaces();

    const existingSession = await createSession({
      title: 'Existing',
      workspacePath: '/tmp/project-a',
    });
    await bindSessionToWorkspace(existingSession.id, workspaceA.id, 'manual');

    let usedSessionId: string | undefined;
    const result = await dispatchGlobalPrompts({
      rawInput: '续问',
      workspaces: [workspaceA],
      createNewSession: false,
      executePrompt: async ({ workspaceId, sessionId, prompt }) => {
        usedSessionId = sessionId;
        return { status: 'success' };
      },
    });

    expect(usedSessionId).toBe(existingSession.id);
    expect(result.workspaceResults[0].sessionId).toBe(existingSession.id);
    expect(result.workspaceResults[0].status).toBe('success');
  });

  // ─────────────────────────────────────────────
  // 测试：空输入抛出错误
  // ─────────────────────────────────────────────
  it('空输入抛出明确错误', async () => {
    const { workspaceA } = await setupTwoWorkspaces();
    await expect(
      dispatchGlobalPrompts({
        rawInput: '   \n  \n',
        workspaces: [workspaceA],
        createNewSession: false,
        executePrompt: async () => ({ status: 'success' }),
      }),
    ).rejects.toThrowError('Prompt input is empty');
  });

  // ─────────────────────────────────────────────
  // 测试：batchId 全局唯一
  // ─────────────────────────────────────────────
  it('batchId 在每次调用中唯一', async () => {
    const { workspaceA } = await setupTwoWorkspaces();
    const result1 = await dispatchGlobalPrompts({
      rawInput: '问题',
      workspaces: [workspaceA],
      createNewSession: false,
      executePrompt: async () => ({ status: 'success' }),
    });
    const result2 = await dispatchGlobalPrompts({
      rawInput: '问题',
      workspaces: [workspaceA],
      createNewSession: false,
      executePrompt: async () => ({ status: 'success' }),
    });
    expect(result1.batchId).not.toBe(result2.batchId);
  });

  // ─────────────────────────────────────────────
  // 测试：withDefaults 内部解析 input 并注入 workspaces
  // ─────────────────────────────────────────────
  it('withDefaults 自动从存储加载所有启用工作区', async () => {
    const { workspaceA, workspaceB } = await setupTwoWorkspaces();
    const executed: string[] = [];

    const result = await dispatchGlobalPromptsWithDefaults({
      rawInput: '全局问题',
      createNewSession: false,
      executePrompt: async ({ workspaceId, sessionId, prompt }) => {
        executed.push(workspaceId);
        return { status: 'success' };
      },
    });

    expect(result.workspaceResults).toHaveLength(2);
    expect(executed).toContain(workspaceA.id);
    expect(executed).toContain(workspaceB.id);
  });

  // ─────────────────────────────────────────────
  // 测试：withDefaults 跳过禁用工作区
  // ─────────────────────────────────────────────
  it('withDefaults 跳过 enabled=false 的工作区', async () => {
    const { workspaceA, workspaceB } = await setupTwoWorkspaces();
    await workspaceEdb.workspaces.update(workspaceB.id, { enabled: 0 } as any);

    const result = await dispatchGlobalPromptsWithDefaults({
      rawInput: '全局问题',
      createNewSession: false,
      executePrompt: async () => ({ status: 'success' }),
    });

    expect(result.workspaceResults).toHaveLength(1);
    expect(result.workspaceResults[0].workspaceId).toBe(workspaceA.id);
  });

  // ─────────────────────────────────────────────
  // 测试：全部失败时 workspace status = failed
  // ─────────────────────────────────────────────
  it('所有 prompt 失败时 workspace status 为 failed', async () => {
    const { workspaceA } = await setupTwoWorkspaces();

    const result = await dispatchGlobalPrompts({
      rawInput: '问题1\n问题2',
      workspaces: [workspaceA],
      createNewSession: false,
      executePrompt: async () => ({ status: 'failed', reason: 'error' }),
    });

    expect(result.workspaceResults[0].status).toBe('failed');
    expect(result.workspaceResults[0].promptResults).toEqual([
      { prompt: '问题1', status: 'failed', reason: 'error' },
      { prompt: '问题2', status: 'failed', reason: 'error' },
    ]);
  });

  // ─────────────────────────────────────────────
  // 测试：全部成功时 workspace status = success
  // ─────────────────────────────────────────────
  it('所有 prompt 成功时 workspace status 为 success', async () => {
    const { workspaceA } = await setupTwoWorkspaces();

    const result = await dispatchGlobalPrompts({
      rawInput: '问题1\n问题2',
      workspaces: [workspaceA],
      createNewSession: false,
      executePrompt: async () => ({ status: 'success' }),
    });

    expect(result.workspaceResults[0].status).toBe('success');
    expect(result.workspaceResults[0].promptResults).toEqual([
      { prompt: '问题1', status: 'success' },
      { prompt: '问题2', status: 'success' },
    ]);
  });
});
