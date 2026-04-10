/**
 * 错误日志工具
 * 提供错误日志的写入和读取功能，使用 localStorage 存储，FIFO 淘汰超过 50 条的旧日志
 */

export interface ErrorLog {
  id: string;
  message: string;
  stack?: string;
  componentStack?: string;
  timestamp: number;
}

const STORAGE_KEY = 'cc_errors';
const MAX_LOGS = 50;

/** 生成唯一 ID */
function generateId(): string {
  return `err_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** 从 localStorage 读取所有错误日志 */
export function getErrorLogs(): ErrorLog[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const logs: ErrorLog[] = JSON.parse(raw);
    if (!Array.isArray(logs)) return [];
    return logs;
  } catch {
    return [];
  }
}

/** 追加一条错误日志（FIFO 淘汰超过 50 条的最旧记录） */
export function appendErrorLog(
  message: string,
  stack?: string,
  componentStack?: string
): ErrorLog {
  const logs = getErrorLogs();
  const newEntry: ErrorLog = {
    id: generateId(),
    message,
    stack,
    componentStack,
    timestamp: Date.now(),
  };

  // FIFO 淘汰：超过 50 条则删除最旧的
  const updated = logs.length >= MAX_LOGS
    ? [...logs.slice(logs.length - MAX_LOGS + 1), newEntry]
    : [...logs, newEntry];

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // localStorage 已满，尝试清理后重写
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([newEntry]));
    } catch {
      // 无法写入，忽略
    }
  }

  return newEntry;
}

/** 清空所有错误日志 */
export function clearErrorLogs(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 忽略
  }
}
