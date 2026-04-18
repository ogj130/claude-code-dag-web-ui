import type { DispatchExecutePromptInput, DispatchExecutePromptResult } from './globalDispatchService';
import { getWorkspaceById } from '@/stores/workspaceStorage';
import { getAllConfigs } from '@/stores/modelConfigStorage';
import type { ModelConfig } from '@/types/models';

// ─────────────────────────────────────────────
// 全局进程管理器（单例，渲染进程 IPC 侧接入时替换）
// ─────────────────────────────────────────────
let _processManager: ClaudeCodeProcessManager | null = null;

export interface ClaudeCodeProcessManager {
  spawn(
    sessionId: string,
    projectPath: string,
    options?: {
      prompt?: string;
      model?: string;
      baseUrl?: string;
      apiKey?: string;
    },
  ): void;
  sendInput(sessionId: string, input: string): string;
  kill(sessionId: string): void;
  isRunning(sessionId: string): boolean;
  onEvent(handler: (payload: ClaudeCodeEventPayload) => void): () => void;
  off(event: string, handler: (payload: ClaudeCodeEventPayload) => void): void;
}

export interface ClaudeCodeEventPayload {
  event: {
    type:
      | 'session_start'
      | 'session_end'
      | 'result'
      | 'error'
      | string;
    sessionId?: string;
    [key: string]: unknown;
  };
  sessionId: string;
  timestamp: number;
}

// ─────────────────────────────────────────────
// 默认空实现（无进程时静默返回失败）
// ─────────────────────────────────────────────
const noopProcessManager: ClaudeCodeProcessManager = {
  spawn() {},
  sendInput() { return ''; },
  kill() {},
  isRunning() { return false; },
  onEvent() { return () => {}; },
  off() {},
};

// ─────────────────────────────────────────────
// 注入真实的进程管理器（由 Electron 主进程在启动时注入）
// ─────────────────────────────────────────────
export function setProcessManager(manager: ClaudeCodeProcessManager): void {
  _processManager = manager;
}

function getProcessManager(): ClaudeCodeProcessManager {
  return _processManager ?? noopProcessManager;
}

// ─────────────────────────────────────────────
// 缓存：modelConfigId → ModelConfig（避免每次都读存储）
// ─────────────────────────────────────────────
let _configCache: Map<string, ModelConfig> | null = null;

export async function preloadModelConfigs(): Promise<void> {
  const configs = await getAllConfigs();
  _configCache = new Map(configs.map(c => [c.id, c]));
}

export function clearModelConfigCache(): void {
  _configCache = null;
}

async function loadModelConfig(configId: string): Promise<ModelConfig | undefined> {
  if (_configCache) {
    return _configCache.get(configId);
  }
  const configs = await getAllConfigs();
  _configCache = new Map(configs.map(c => [c.id, c]));
  return _configCache.get(configId);
}

// ─────────────────────────────────────────────
// 默认超时时间（毫秒）
// ─────────────────────────────────────────────
export const DEFAULT_PROMPT_TIMEOUT_MS = 120_000; // 2 分钟

// ─────────────────────────────────────────────
// 核心执行函数：为指定工作区 + 会话执行一条 prompt
// ─────────────────────────────────────────────
export interface ExecutePromptForWorkspaceOptions {
  workspaceId: string;
  sessionId: string;
  prompt: string;
  /** 超时时间（毫秒），默认 120 秒 */
  timeoutMs?: number;
  /**
   * 是否在会话内已有运行中进程时继续追加输入。
   * 设为 false 时，重复输入会先 kill 旧进程后重新 spawn。
   * 默认为 true（Claude Code CLI 本身支持多轮对话）。
   */
  reuseRunning?: boolean;
}

export async function executePromptForWorkspace(
  options: ExecutePromptForWorkspaceOptions,
): Promise<DispatchExecutePromptResult> {
  const { workspaceId, sessionId, prompt, timeoutMs = DEFAULT_PROMPT_TIMEOUT_MS, reuseRunning = true } = options;

  // 1. 加载工作区
  const workspace = await getWorkspaceById(workspaceId);
  if (!workspace) {
    return { status: 'failed', reason: `Workspace not found: ${workspaceId}` };
  }

  // 2. 加载模型配置
  const config = await loadModelConfig(workspace.modelConfigId);
  if (!config) {
    return { status: 'failed', reason: `Model config not found: ${workspace.modelConfigId}` };
  }

  const pm = getProcessManager();
  const isRunning = pm.isRunning(sessionId);

  // 3. 若会话未启动，先 spawn
  if (!isRunning) {
    pm.spawn(sessionId, workspace.workspacePath, {
      model: config.model,
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
    });
  } else if (!reuseRunning) {
    // 用户明确要求不再复用时，先 kill 再重新 spawn
    pm.kill(sessionId);
    pm.spawn(sessionId, workspace.workspacePath, {
      model: config.model,
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
    });
  }

  // 4. 发送 prompt 并等待结果
  return new Promise<DispatchExecutePromptResult>(resolve => {
    let settled = false;

    const cleanup = () => {
      if (settled) return;
      settled = true;
      pm.off('event', handler);
      clearTimeout(timer);
    };

    const timer = setTimeout(() => {
      cleanup();
      pm.kill(sessionId);
      resolve({ status: 'failed', reason: 'timeout' });
    }, timeoutMs);

    const handler = (payload: ClaudeCodeEventPayload) => {
      // 只处理当前 session 的事件
      if (payload.sessionId !== sessionId) return;

      const evt = payload.event;
      if (evt.type === 'result') {
        cleanup();
        const resultData = evt as { type: 'result'; result?: unknown; error?: string; output?: string };
        if (resultData.error) {
          resolve({ status: 'failed', reason: resultData.error });
        } else {
          resolve({
            status: 'success',
            output: typeof resultData.output === 'string' ? resultData.output : undefined,
          });
        }
      } else if (evt.type === 'error') {
        cleanup();
        const errorData = evt as { type: 'error'; error?: string };
        resolve({ status: 'failed', reason: errorData.error ?? 'unknown error' });
      } else if (evt.type === 'session_end') {
        cleanup();
        const endData = evt as { type: 'session_end'; reason?: string };
        resolve({ status: 'failed', reason: `session ended: ${endData.reason ?? 'unknown'}` });
      }
    };

    pm.onEvent(handler);
    pm.sendInput(sessionId, prompt);
  });
}

// ─────────────────────────────────────────────
// 便捷包装：直接作为 dispatchGlobalPrompts 的 executePrompt 使用
// ─────────────────────────────────────────────
export async function dispatchExecutePromptAdapter(
  input: DispatchExecutePromptInput,
): Promise<DispatchExecutePromptResult> {
  return executePromptForWorkspace({
    workspaceId: input.workspaceId,
    sessionId: input.sessionId,
    prompt: input.prompt,
  });
}
