import type { DispatchExecutePromptInput, DispatchExecutePromptResult } from './globalDispatchService';
import { getAllConfigs } from '@/stores/modelConfigStorage';
import type { ModelConfig } from '@/types/models';
import type { WSClientMessage, WSMessage, ModelOptions } from '@/types/events';

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
// WebSocket URL（与 useWebSocket 保持一致，走 ws://localhost 直连）
// ─────────────────────────────────────────────
function getDispatchWsUrl(): string {
  const params = new URLSearchParams(window.location.search);
  const wsPort = params.get('wsPort') ?? '5300';
  return `ws://localhost:${wsPort}`;
}

// ─────────────────────────────────────────────
// 已建立的 dispatch WS 连接（按 sessionId 缓存，避免重复连接）
// ─────────────────────────────────────────────
const dispatchWsCache = new Map<string, WebSocket>();

const logger = {
  info: (...args: unknown[]) => console.log('[DispatchExecutor]', new Date().toISOString(), ...args),
  error: (...args: unknown[]) => console.error('[DispatchExecutor]', new Date().toISOString(), ...args),
};

// ─────────────────────────────────────────────
// WS 方式执行 prompt（Dev 模式 / 未注入 processManager 时使用）
// ─────────────────────────────────────────────
interface DispatchWsResult {
  status: 'success' | 'failed';
  output?: string;
  reason?: string;
}

function executePromptViaWs(
  sessionId: string,
  projectPath: string,
  prompt: string,
  modelOptions?: ModelOptions,
): Promise<DispatchWsResult> {
  return new Promise((resolve) => {
    let ws: WebSocket;
    let settled = false;
    const wsUrl = getDispatchWsUrl();

    logger.info('executePromptViaWs called', { sessionId, projectPath, wsUrl, prompt: prompt.slice(0, 30) });

    const cleanup = () => {
      if (settled) return;
      settled = true;
      ws.removeEventListener('message', onMessage);
    };

    const doResolve = (result: DispatchWsResult) => {
      logger.info('Resolving executePromptViaWs', result);
      cleanup();
      resolve(result);
    };

    const onMessage = (event: MessageEvent) => {
      let msg: WSMessage;
      try {
        msg = JSON.parse(event.data as string);
      } catch {
        return;
      }

      // 只处理当前 session 的事件
      if (msg.sessionId !== sessionId) return;
      const evt = msg.event;
      if (!evt) return;

      logger.info('WS message received', { sessionId, eventType: evt.type });

      if (evt.type === 'result') {
        const r = evt as { type: 'result'; result?: string; error?: string };
        doResolve(r.error
          ? { status: 'failed', reason: r.error }
          : { status: 'success', output: r.result ?? undefined });
      } else if (evt.type === 'error') {
        const r = evt as { type: 'error'; message?: string };
        doResolve({ status: 'failed', reason: r.message ?? 'unknown error' });
      } else if (evt.type === 'session_end') {
        const r = evt as { type: 'session_end'; reason?: string };
        doResolve({ status: 'failed', reason: `session ended: ${r.reason ?? 'unknown'}` });
      }
    };

    // 复用缓存的 WS 连接（若已存在且 open）
    const cached = dispatchWsCache.get(sessionId);
    if (cached?.readyState === WebSocket.OPEN) {
      logger.info('Reusing cached WS connection');
      ws = cached;
      ws.addEventListener('message', onMessage);
      ws.send(JSON.stringify({ type: 'send_input', sessionId, input: prompt } as WSClientMessage));
      return;
    }

    // 建立新连接
    logger.info('Creating new WebSocket connection');
    ws = new WebSocket(wsUrl);
    dispatchWsCache.set(sessionId, ws);

    ws.addEventListener('message', onMessage);

    // 超时保护：30 秒内 WS 未 open 则失败
    const timeout = setTimeout(() => {
      if (!settled) {
        logger.error('WS connection timeout, closing');
        ws.close();
        doResolve({ status: 'failed', reason: 'connection timeout' });
      }
    }, 30_000);

    ws.addEventListener('open', () => {
      logger.info('WS connected, sending start_session + send_input');
      clearTimeout(timeout);

      // 先 start_session 建立 session，再 send_input
      ws.send(JSON.stringify({
        type: 'start_session',
        sessionId,
        projectPath,
        modelOptions,
      } as WSClientMessage));

      // session 建立后立即发送 prompt
      ws.send(JSON.stringify({ type: 'send_input', sessionId, input: prompt } as WSClientMessage));
    });

    ws.addEventListener('error', (e) => {
      logger.error('WS error event', e);
      clearTimeout(timeout);
      dispatchWsCache.delete(sessionId);
      doResolve({ status: 'failed', reason: 'WebSocket connection error' });
    });

    ws.addEventListener('close', () => {
      clearTimeout(timeout);
      dispatchWsCache.delete(sessionId);
      if (!settled) {
        logger.error('WS closed without result');
        doResolve({ status: 'failed', reason: 'session ended unexpectedly' });
      }
    });
  });
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
  /** 工作区路径（调用方直接传入，无需跨 DB 查询） */
  workspacePath: string;
  /** 模型配置 ID（调用方直接传入，无需跨 DB 查询） */
  modelConfigId: string;
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
  const {
    workspaceId: _workspaceId, workspacePath: resolvedWorkspacePath, modelConfigId: resolvedConfigId,
    sessionId, prompt, timeoutMs = DEFAULT_PROMPT_TIMEOUT_MS, reuseRunning = true,
  } = options;

  // 加载模型配置（workspacePath 和 modelConfigId 由调用方直接传入，无需跨 DB 查询）
  const config = await loadModelConfig(resolvedConfigId);
  if (!config) {
    return { status: 'failed', reason: `Model config not found: ${resolvedConfigId}` };
  }

  const pm = getProcessManager();
  const isRunning = pm.isRunning(sessionId);

  // 若会话未启动，先 spawn
  if (!isRunning) {
    pm.spawn(sessionId, resolvedWorkspacePath, {
      model: config.model,
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
    });
  } else if (!reuseRunning) {
    // 用户明确要求不再复用时，先 kill 再重新 spawn
    pm.kill(sessionId);
    pm.spawn(sessionId, resolvedWorkspacePath, {
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
//
// 优先检测是否已注入真实的 processManager：
// - Electron 打包模式（main.ts 调用了 setProcessManager）→ 使用 processManager
// - Dev 模式 / 未注入 → 使用独立的 WebSocket 连接（与默认终端完全隔离）
// ─────────────────────────────────────────────
export async function dispatchExecutePromptAdapter(
  input: DispatchExecutePromptInput,
): Promise<DispatchExecutePromptResult> {
  // 优先使用已注入的 processManager（Electron 打包模式）
  if (_processManager !== null) {
    return executePromptForWorkspace({
      workspaceId: input.workspaceId,
      workspacePath: input.workspacePath,
      modelConfigId: input.modelConfigId,
      sessionId: input.sessionId,
      prompt: input.prompt,
    });
  }

  // Dev 模式：使用独立的 WebSocket 连接（直接从 input 获取配置，无需跨 DB 查询）
  const config = input.modelConfigId ? await loadModelConfig(input.modelConfigId) : undefined;
  const modelOptions = config ? {
    model: config.model,
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
  } : undefined;

  const result = await executePromptViaWs(
    input.sessionId,
    input.workspacePath,
    input.prompt,
    modelOptions,
  );

  return result;
}
