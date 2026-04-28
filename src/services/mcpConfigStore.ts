/**
 * mcpConfigStore — MCP 服务器配置管理
 *
 * 管理 MCP 服务器连接配置、连接状态监控、工具自动发现。
 *
 * 使用方式：
 *   import { mcpConfigStore } from '@/services/mcpConfigStore';
 *   mcpConfigStore.addServer({ name: '...', command: '...' });
 *   const tools = await mcpConfigStore.discoverTools(serverId);
 */

// ── 类型定义 ────────────────────────────────────────────────

export type MCPConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error';

export interface MCPServerConfig {
  id: string;
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface MCPServerState {
  config: MCPServerConfig;
  status: MCPConnectionStatus;
  tools: MCPTool[];
  lastConnectedAt?: number;
  lastError?: string;
  toolDiscoveryCount: number;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  serverId: string;
  serverName: string;
}

export interface AddServerParams {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled?: boolean;
}

// ── ID 生成 ─────────────────────────────────────────────────

function generateId(): string {
  return `mcp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── 存储 ────────────────────────────────────────────────────

const _servers: Map<string, MCPServerState> = new Map();
const _statusListeners: Array<(serverId: string, status: MCPConnectionStatus) => void> = [];

// ── CRUD ────────────────────────────────────────────────────

/**
 * 添加 MCP 服务器
 */
export function addServer(params: AddServerParams): MCPServerState {
  const id = generateId();
  const now = Date.now();

  const config: MCPServerConfig = {
    id,
    name: params.name,
    command: params.command,
    args: params.args,
    env: params.env,
    enabled: params.enabled ?? true,
    createdAt: now,
    updatedAt: now,
  };

  const state: MCPServerState = {
    config,
    status: 'disconnected',
    tools: [],
    toolDiscoveryCount: 0,
  };

  _servers.set(id, state);
  return state;
}

/**
 * 获取服务器状态
 */
export function getServer(id: string): MCPServerState | null {
  return _servers.get(id) ?? null;
}

/**
 * 列出所有服务器
 */
export function listServers(): MCPServerState[] {
  return [..._servers.values()];
}

/**
 * 更新服务器配置
 */
export function updateServer(
  id: string,
  updates: Partial<Pick<MCPServerConfig, 'name' | 'command' | 'args' | 'env' | 'enabled'>>
): MCPServerState | null {
  const state = _servers.get(id);
  if (!state) return null;

  const updated: MCPServerState = {
    ...state,
    config: { ...state.config, ...updates, updatedAt: Date.now() },
  };

  _servers.set(id, updated);
  return updated;
}

/**
 * 删除服务器
 */
export function removeServer(id: string): boolean {
  return _servers.delete(id);
}

// ── 连接状态 ────────────────────────────────────────────────

/**
 * 更新连接状态
 */
export function updateStatus(id: string, status: MCPConnectionStatus, error?: string): void {
  const state = _servers.get(id);
  if (!state) return;

  const updated: MCPServerState = {
    ...state,
    status,
    lastError: status === 'error' ? error : state.lastError,
    lastConnectedAt: status === 'connected' ? Date.now() : state.lastConnectedAt,
  };

  _servers.set(id, updated);

  for (const listener of _statusListeners) {
    listener(id, status);
  }
}

/**
 * 监听连接状态变化
 */
export function onStatusChange(
  listener: (serverId: string, status: MCPConnectionStatus) => void
): () => void {
  _statusListeners.push(listener);
  return () => {
    const idx = _statusListeners.indexOf(listener);
    if (idx >= 0) _statusListeners.splice(idx, 1);
  };
}

/**
 * 测试连接（模拟）
 */
export async function testConnection(id: string): Promise<{
  success: boolean;
  latencyMs?: number;
  error?: string;
}> {
  const state = _servers.get(id);
  if (!state) return { success: false, error: 'Server not found' };

  updateStatus(id, 'connecting');

  // 模拟连接测试
  await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 200));

  // 模拟：80% 成功率
  if (Math.random() > 0.2) {
    updateStatus(id, 'connected');
    return { success: true, latencyMs: Math.floor(100 + Math.random() * 200) };
  } else {
    const error = 'Connection refused';
    updateStatus(id, 'error', error);
    return { success: false, error };
  }
}

// ── 工具发现 ────────────────────────────────────────────────

/**
 * 发现 MCP 服务器提供的工具
 *
 * 实际会通过 MCP 协议查询工具列表，当前为模拟。
 */
export async function discoverTools(id: string): Promise<MCPTool[]> {
  const state = _servers.get(id);
  if (!state || state.status !== 'connected') return [];

  // 模拟工具发现
  const mockTools: MCPTool[] = [
    { name: `${state.config.name}_search`, description: 'Search tool', serverId: id, serverName: state.config.name },
    { name: `${state.config.name}_fetch`, description: 'Fetch tool', serverId: id, serverName: state.config.name },
  ];

  const updated: MCPServerState = {
    ...state,
    tools: mockTools,
    toolDiscoveryCount: state.toolDiscoveryCount + 1,
  };
  _servers.set(id, updated);

  return mockTools;
}

/**
 * 获取所有已发现的工具
 */
export function getAllTools(): MCPTool[] {
  const tools: MCPTool[] = [];
  for (const state of _servers.values()) {
    if (state.status === 'connected') {
      tools.push(...state.tools);
    }
  }
  return tools;
}

// ── 重置（测试用）───────────────────────────────────────────

export function resetMCPConfigStore(): void {
  _servers.clear();
  _statusListeners.length = 0;
}
