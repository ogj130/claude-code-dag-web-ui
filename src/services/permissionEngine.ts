/**
 * permissionEngine — 权限与安全引擎
 *
 * 6 级权限模型 + Token 预算告警 + 沙箱执行 + 审计日志
 *
 * L1 只读 / L2 编辑 / L3 创建删除 / L4 Shell / L5 配置 / L6 完全访问
 */

// ── 类型定义 ────────────────────────────────────────────────

export type PermissionLevel = 1 | 2 | 3 | 4 | 5 | 6;

export type ActionType =
  | 'read'
  | 'edit'
  | 'create'
  | 'delete'
  | 'shell'
  | 'config'
  | 'admin';

export interface PermissionCheck {
  action: ActionType;
  resource: string;
  level: PermissionLevel;
}

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  action: ActionType;
  resource: string;
  level: PermissionLevel;
  result: 'allowed' | 'denied';
  userId?: string;
  details?: string;
}

export interface TokenBudget {
  total: number;
  used: number;
  remaining: number;
  usagePercent: number;
  isWarning: boolean;  // >= 80%
  isPaused: boolean;   // >= 100%
}

export interface SandboxConfig {
  allowedPaths: string[];
  blockedCommands: string[];
  maxFileSize: number; // bytes
}

// ── 权限等级定义 ────────────────────────────────────────────

const LEVEL_PERMISSIONS: Record<PermissionLevel, Set<ActionType>> = {
  1: new Set(['read']),
  2: new Set(['read', 'edit']),
  3: new Set(['read', 'edit', 'create', 'delete']),
  4: new Set(['read', 'edit', 'create', 'delete', 'shell']),
  5: new Set(['read', 'edit', 'create', 'delete', 'shell', 'config']),
  6: new Set(['read', 'edit', 'create', 'delete', 'shell', 'config', 'admin']),
};

const LEVEL_LABELS: Record<PermissionLevel, string> = {
  1: '只读',
  2: '编辑',
  3: '创建删除',
  4: 'Shell',
  5: '配置',
  6: '完全访问',
};

// ── 状态 ────────────────────────────────────────────────────

let _currentLevel: PermissionLevel = 3; // 默认 L3
const _auditLogs: AuditLogEntry[] = [];
const MAX_AUDIT_LOGS = 1000;

let _tokenBudget: TokenBudget = {
  total: 100000,
  used: 0,
  remaining: 100000,
  usagePercent: 0,
  isWarning: false,
  isPaused: false,
};

let _sandboxConfig: SandboxConfig = {
  allowedPaths: ['/tmp/sandbox', '/workspace/output'],
  blockedCommands: ['rm -rf /', 'format', 'mkfs', 'dd if='],
  maxFileSize: 10 * 1024 * 1024, // 10MB
};

// ── 权限检查 ────────────────────────────────────────────────

function generateId(): string {
  return `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 检查是否有权限执行操作
 */
export function checkPermission(action: ActionType, resource: string): boolean {
  const allowed = LEVEL_PERMISSIONS[_currentLevel]?.has(action) ?? false;

  const log: AuditLogEntry = {
    id: generateId(),
    timestamp: Date.now(),
    action,
    resource,
    level: _currentLevel,
    result: allowed ? 'allowed' : 'denied',
  };
  addAuditLog(log);

  return allowed;
}

/**
 * 获取当前权限等级
 */
export function getCurrentLevel(): PermissionLevel {
  return _currentLevel;
}

/**
 * 设置权限等级
 */
export function setLevel(level: PermissionLevel): void {
  _currentLevel = level;
}

/**
 * 获取等级标签
 */
export function getLevelLabel(level: PermissionLevel): string {
  return LEVEL_LABELS[level];
}

/**
 * 获取所有等级信息
 */
export function getAllLevels(): Array<{ level: PermissionLevel; label: string; permissions: ActionType[] }> {
  return (Object.keys(LEVEL_LABELS).map(Number) as PermissionLevel[]).map((l) => ({
    level: l,
    label: LEVEL_LABELS[l],
    permissions: [...LEVEL_PERMISSIONS[l]],
  }));
}

/**
 * 基于用户画像推荐权限等级
 */
export function recommendLevel(context: {
  skillLevel?: string;
  projectType?: string;
}): PermissionLevel {
  if (context.skillLevel === 'expert') return 6;
  if (context.skillLevel === 'advanced') return 5;
  if (context.skillLevel === 'intermediate') return 4;
  return 3;
}

// ── Token 预算 ──────────────────────────────────────────────

/**
 * 设置 Token 预算
 */
export function setTokenBudget(total: number): void {
  _tokenBudget = {
    total,
    used: _tokenBudget.used,
    remaining: total - _tokenBudget.used,
    usagePercent: _tokenBudget.used / total,
    isWarning: _tokenBudget.used / total >= 0.8,
    isPaused: _tokenBudget.used >= total,
  };
}

/**
 * 消耗 Token
 */
export function consumeTokens(count: number): TokenBudget {
  _tokenBudget = {
    ..._tokenBudget,
    used: _tokenBudget.used + count,
    remaining: Math.max(0, _tokenBudget.total - _tokenBudget.used - count),
    usagePercent: (_tokenBudget.used + count) / _tokenBudget.total,
    isWarning: (_tokenBudget.used + count) / _tokenBudget.total >= 0.8,
    isPaused: _tokenBudget.used + count >= _tokenBudget.total,
  };
  return _tokenBudget;
}

/**
 * 获取 Token 预算状态
 */
export function getTokenBudget(): TokenBudget {
  return { ..._tokenBudget };
}

/**
 * 重置 Token 消耗
 */
export function resetTokenUsage(): void {
  _tokenBudget = {
    ..._tokenBudget,
    used: 0,
    remaining: _tokenBudget.total,
    usagePercent: 0,
    isWarning: false,
    isPaused: false,
  };
}

// ── 审计日志 ────────────────────────────────────────────────

function addAuditLog(entry: AuditLogEntry): void {
  _auditLogs.push(entry);
  if (_auditLogs.length > MAX_AUDIT_LOGS) {
    _auditLogs.splice(0, _auditLogs.length - MAX_AUDIT_LOGS);
  }
}

/**
 * 获取审计日志
 */
export function getAuditLogs(options?: {
  action?: ActionType;
  result?: 'allowed' | 'denied';
  since?: number;
  limit?: number;
}): AuditLogEntry[] {
  let logs = [..._auditLogs];

  if (options?.action) logs = logs.filter((l) => l.action === options.action);
  if (options?.result) logs = logs.filter((l) => l.result === options.result);
  if (options?.since) logs = logs.filter((l) => l.timestamp >= options.since!);

  logs.sort((a, b) => b.timestamp - a.timestamp);

  if (options?.limit) logs = logs.slice(0, options.limit);
  return logs;
}

// ── 沙箱 ────────────────────────────────────────────────────

/**
 * 检查路径是否在沙箱内
 */
export function isPathAllowed(filePath: string): boolean {
  return _sandboxConfig.allowedPaths.some((p) => filePath.startsWith(p));
}

/**
 * 检查命令是否被阻止
 */
export function isCommandBlocked(command: string): boolean {
  return _sandboxConfig.blockedCommands.some((blocked) => command.includes(blocked));
}

/**
 * 检查文件大小是否在限制内
 */
export function isFileSizeAllowed(sizeBytes: number): boolean {
  return sizeBytes <= _sandboxConfig.maxFileSize;
}

/**
 * 获取沙箱配置
 */
export function getSandboxConfig(): SandboxConfig {
  return { ..._sandboxConfig };
}

/**
 * 更新沙箱配置
 */
export function updateSandboxConfig(updates: Partial<SandboxConfig>): void {
  _sandboxConfig = { ..._sandboxConfig, ...updates };
}

// ── 重置（测试用）───────────────────────────────────────────

export function resetPermissionEngine(): void {
  _currentLevel = 3;
  _auditLogs.length = 0;
  _tokenBudget = { total: 100000, used: 0, remaining: 100000, usagePercent: 0, isWarning: false, isPaused: false };
  _sandboxConfig = {
    allowedPaths: ['/tmp/sandbox', '/workspace/output'],
    blockedCommands: ['rm -rf /', 'format', 'mkfs', 'dd if='],
    maxFileSize: 10 * 1024 * 1024,
  };
}
