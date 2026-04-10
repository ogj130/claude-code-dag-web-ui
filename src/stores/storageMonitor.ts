/**
 * 存储空间检查和容量警告机制
 */

import type { StorageInfo } from '@/types/storage';

/** 警告阈值：剩余空间小于 50MB 时发出警告 */
const WARNING_THRESHOLD = 50 * 1024 * 1024; // 50MB

/**
 * 检查存储空间
 * @returns 存储空间信息
 */
export async function checkStorageSpace(): Promise<StorageInfo> {
  // 使用 navigator.storage API
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    try {
      const estimate = await navigator.storage.estimate();
      const used = estimate.usage ?? 0;
      const available = (estimate.quota ?? 0) - used;
      const usagePercent = estimate.quota ? (used / estimate.quota) * 100 : 0;

      return {
        used,
        available,
        isNearFull: available < WARNING_THRESHOLD,
        usagePercent,
      };
    } catch (error) {
      console.warn('[Storage] Failed to estimate storage:', error);
      return getDefaultStorageInfo();
    }
  }

  // 不支持 storage API 时返回默认值
  console.warn('[Storage] navigator.storage API not supported');
  return getDefaultStorageInfo();
}

/**
 * 获取默认存储空间信息
 */
function getDefaultStorageInfo(): StorageInfo {
  return {
    used: 0,
    available: 0,
    isNearFull: false,
    usagePercent: 0,
  };
}

/**
 * 格式化字节数为可读字符串
 * @param bytes 字节数
 * @returns 格式化后的字符串
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${units[i]}`;
}

/**
 * 存储空间警告事件类型
 */
export type StorageWarningLevel = 'none' | 'low' | 'critical';

/**
 * 获取存储空间警告级别
 * @param storageInfo 存储空间信息
 * @returns 警告级别
 */
export function getStorageWarningLevel(
  storageInfo: StorageInfo
): StorageWarningLevel {
  if (!storageInfo.isNearFull) {
    return 'none';
  }

  // 剩余空间小于 10MB 为 critical
  if (storageInfo.available < 10 * 1024 * 1024) {
    return 'critical';
  }

  // 剩余空间小于 50MB 为 low
  return 'low';
}

/**
 * 存储空间监听器类型
 */
export type StorageWarningListener = (
  level: StorageWarningLevel,
  storageInfo: StorageInfo
) => void;

/** 存储空间警告监听器列表 */
const listeners: Set<StorageWarningListener> = new Set();

/** 上次的警告级别 */
let lastWarningLevel: StorageWarningLevel = 'none';

/**
 * 启动存储空间监控
 * @param interval 检查间隔（毫秒），默认 30 秒
 * @returns 停止监控的函数
 */
export function startStorageMonitoring(
  interval = 30000
): () => void {
  let isRunning = true;

  const check = async () => {
    if (!isRunning) return;

    try {
      const storageInfo = await checkStorageSpace();
      const level = getStorageWarningLevel(storageInfo);

      // 只有级别变化时才通知
      if (level !== lastWarningLevel) {
        lastWarningLevel = level;
        listeners.forEach(listener => listener(level, storageInfo));
      }
    } catch (error) {
      console.error('[Storage] Monitoring error:', error);
    }

    // 继续检查
    if (isRunning) {
      setTimeout(check, interval);
    }
  };

  // 立即检查一次
  check();

  // 返回停止函数
  return () => {
    isRunning = false;
  };
}

/**
 * 添加存储空间警告监听器
 * @param listener 监听器函数
 * @returns 移除监听器的函数
 */
export function addStorageWarningListener(
  listener: StorageWarningListener
): () => void {
  listeners.add(listener);

  // 返回移除函数
  return () => {
    listeners.delete(listener);
  };
}

/**
 * 检查存储空间并发出警告
 * 如果存储空间不足，会通过控制台和事件提醒用户
 * @returns 存储空间信息
 */
export async function checkAndWarnStorage(): Promise<StorageInfo> {
  const storageInfo = await checkStorageSpace();
  const level = getStorageWarningLevel(storageInfo);

  if (level === 'critical') {
    console.error(
      '[Storage] CRITICAL: Storage space is almost full!',
      `Available: ${formatBytes(storageInfo.available)}`,
      'Please delete some data to continue using the application.'
    );
  } else if (level === 'low') {
    console.warn(
      '[Storage] WARNING: Storage space is running low.',
      `Available: ${formatBytes(storageInfo.available)}`,
      'Consider deleting old sessions to free up space.'
    );
  }

  return storageInfo;
}

/**
 * 获取存储使用建议
 * @param storageInfo 存储空间信息
 * @returns 建议文本
 */
export function getStorageSuggestions(storageInfo: StorageInfo): string[] {
  const suggestions: string[] = [];

  if (storageInfo.isNearFull) {
    suggestions.push('删除旧的或不需要的会话');
    suggestions.push('清理已归档的会话');
    suggestions.push('考虑导出重要数据后删除');
  }

  if (storageInfo.usagePercent > 80) {
    suggestions.push('存储使用率超过 80%，建议清理');
  }

  return suggestions;
}
