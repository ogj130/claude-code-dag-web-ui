/**
 * 内存管理工具 — Phase 4.3
 *
 * 功能：
 * 4.3.1 单会话 500 节点数软限制警告
 * 4.3.2 内存使用监控（超过 150MB 警告）
 * 4.3.3 图片压缩和缩略图生成
 * 4.3.4 会话切换时的内存清理（DAG 数据释放）
 * 4.3.5 存储空间不足时的 FIFO 淘汰（超过 100 条删除最旧的）
 */

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

/** 单会话 DAG 节点数软限制 */
export const NODE_LIMIT = 500;

/** 内存警告阈值：150MB */
export const MEMORY_WARNING_THRESHOLD = 150 * 1024 * 1024;

/** 会话 FIFO 淘汰阈值：超过此数量时删除最旧的 */
export const SESSION_FIFO_LIMIT = 100;

/** 每次 FIFO 淘汰删除的数量 */
export const SESSION_EVICT_BATCH = 10;

// ---------------------------------------------------------------------------
// 内存使用估算
// ---------------------------------------------------------------------------

/**
 * 估算 JavaScript 对象的内存占用（字节）
 *
 * 策略：
 * - 字符串：length * 2（UTF-16）
 * - 数字：8 字节
 * - 布尔：4 字节
 * - 对象：每个属性 50 字节开销 + 递归值大小
 * - 数组：每个元素开销 16 字节 + 递归值大小
 * - null/undefined：0 字节
 */
export function estimateMemoryUsage(data: unknown): number {
  if (data === null || data === undefined) return 0;

  const type = typeof data;

  if (type === 'string') return (data as string).length * 2;
  if (type === 'number') return 8;
  if (type === 'boolean') return 4;
  if (type === 'bigint') return 16;

  if (Array.isArray(data)) {
    let total = 16; // 数组基础开销
    for (const item of data) {
      total += 16 + estimateMemoryUsage(item);
    }
    return total;
  }

  if (type === 'object') {
    let total = 50; // 对象基础开销
    const obj = data as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      total += key.length * 2 + 50 + estimateMemoryUsage(obj[key]);
    }
    return total;
  }

  return 0;
}

/**
 * 估算 Map<string, T> 的内存占用
 */
export function estimateMapMemory<K, V>(map: Map<K, V>): number {
  let total = 50; // Map 基础开销
  for (const [key, value] of map) {
    total += estimateMemoryUsage(key) + estimateMemoryUsage(value) + 50;
  }
  return total;
}

// ---------------------------------------------------------------------------
// 浏览器内存监控 (4.3.2)
// ---------------------------------------------------------------------------

/** performance.memory 接口（仅 Chrome 支持） */
interface PerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

/**
 * 获取当前 JS 堆内存使用情况
 * @returns 已使用字节数，不支持时返回 -1
 */
export function getCurrentMemoryUsage(): number {
  try {
    // Chrome 特有 API
    const perf = performance as unknown as { memory?: PerformanceMemory };
    if (perf.memory) {
      return perf.memory.usedJSHeapSize;
    }
  } catch {
    // ignore
  }
  return -1;
}

/**
 * 获取详细的内存信息
 */
export function getMemoryInfo(): {
  used: number;
  total: number;
  limit: number;
  supported: boolean;
} {
  try {
    const perf = performance as unknown as { memory?: PerformanceMemory };
    if (perf.memory) {
      return {
        used: perf.memory.usedJSHeapSize,
        total: perf.memory.totalJSHeapSize,
        limit: perf.memory.jsHeapSizeLimit,
        supported: true,
      };
    }
  } catch {
    // ignore
  }
  return { used: 0, total: 0, limit: 0, supported: false };
}

/**
 * 检查内存使用是否超过阈值
 * @returns 是否超过警告阈值
 */
export function isMemoryAboveThreshold(): boolean {
  const usage = getCurrentMemoryUsage();
  if (usage < 0) return false; // 不支持检测
  return usage > MEMORY_WARNING_THRESHOLD;
}

// ---------------------------------------------------------------------------
// 内存警告事件系统
// ---------------------------------------------------------------------------

export type MemoryWarningType =
  | 'node_limit'
  | 'memory_high'
  | 'session_fifo'
  | 'storage_full';

export interface MemoryWarning {
  type: MemoryWarningType;
  message: string;
  details?: Record<string, unknown>;
}

export type MemoryWarningListener = (warning: MemoryWarning) => void;

const warningListeners = new Set<MemoryWarningListener>();

/**
 * 添加内存警告监听器
 * @returns 移除监听器的函数
 */
export function addMemoryWarningListener(
  listener: MemoryWarningListener
): () => void {
  warningListeners.add(listener);
  return () => {
    warningListeners.delete(listener);
  };
}

/**
 * 触发内存警告
 */
function emitWarning(warning: MemoryWarning): void {
  console.warn(`[MemoryManager] ${warning.type}: ${warning.message}`, warning.details ?? '');
  warningListeners.forEach(listener => {
    try {
      listener(warning);
    } catch (err) {
      console.error('[MemoryManager] Listener error:', err);
    }
  });
}

// ---------------------------------------------------------------------------
// 节点数限制检查 (4.3.1)
// ---------------------------------------------------------------------------

/**
 * 检查 DAG 节点数是否超过限制
 * @param nodeCount 当前节点数
 * @returns 是否超过限制
 */
export function checkNodeLimit(nodeCount: number): boolean {
  if (nodeCount > NODE_LIMIT) {
    emitWarning({
      type: 'node_limit',
      message: `DAG 节点数 (${nodeCount}) 已超过软限制 (${NODE_LIMIT})，可能影响渲染性能`,
      details: { nodeCount, limit: NODE_LIMIT },
    });
    return true;
  }
  // 接近限制时也提醒（80%）
  if (nodeCount > NODE_LIMIT * 0.8 && nodeCount <= NODE_LIMIT) {
    console.info(
      `[MemoryManager] DAG 节点数 (${nodeCount}) 接近软限制 (${NODE_LIMIT})，建议折叠已完成的查询`
    );
  }
  return false;
}

// ---------------------------------------------------------------------------
// FIFO 淘汰 (4.3.5)
// ---------------------------------------------------------------------------

/**
 * 执行 FIFO 淘汰：当会话总数超过阈值时，删除最旧的会话
 *
 * 注意：此函数只负责检查和触发，实际删除由调用方（useSessionStore）执行
 *
 * @param currentCount 当前会话总数
 * @returns 是否触发了淘汰
 */
export function shouldEvictSessions(currentCount: number): boolean {
  return currentCount > SESSION_FIFO_LIMIT;
}

/**
 * 计算需要淘汰的会话数量
 */
export function getEvictCount(currentCount: number): number {
  if (currentCount <= SESSION_FIFO_LIMIT) return 0;
  // 删除到阈值以下
  return Math.min(currentCount - SESSION_FIFO_LIMIT, SESSION_EVICT_BATCH);
}

/**
 * 触发 FIFO 淘汰警告
 */
export function notifyFifoEviction(evictedCount: number): void {
  emitWarning({
    type: 'session_fifo',
    message: `会话数量超过 ${SESSION_FIFO_LIMIT}，已自动淘汰 ${evictedCount} 个最旧会话`,
    details: { evictedCount, limit: SESSION_FIFO_LIMIT },
  });
}

// ---------------------------------------------------------------------------
// 图片压缩和缩略图生成 (4.3.3)
// ---------------------------------------------------------------------------

/**
 * 使用 Canvas 压缩图片
 *
 * @param file 原始图片文件
 * @param maxWidth 最大宽度（默认 800px）
 * @param quality JPEG 质量（0-1，默认 0.85）
 * @returns 压缩后的 File 对象
 */
export async function compressImage(
  file: File,
  maxWidth = 800,
  quality = 0.85
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      try {
        const { width, height } = img;
        // 计算缩放比例
        const scale = width > maxWidth ? maxWidth / width : 1;
        const newWidth = Math.round(width * scale);
        const newHeight = Math.round(height * scale);

        const canvas = document.createElement('canvas');
        canvas.width = newWidth;
        canvas.height = newHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('无法获取 Canvas 2D 上下文'));
          return;
        }

        ctx.drawImage(img, 0, 0, newWidth, newHeight);

        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(url);
            if (!blob) {
              reject(new Error('图片压缩失败'));
              return;
            }
            // 保持原始文件名
            const compressedFile = new File(
              [blob],
              file.name.replace(/\.[^.]+$/, '.jpg'),
              { type: 'image/jpeg', lastModified: Date.now() }
            );
            resolve(compressedFile);
          },
          'image/jpeg',
          quality
        );
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('图片加载失败'));
    };

    img.src = url;
  });
}

/**
 * 生成图片缩略图
 *
 * @param file 图片文件
 * @param maxSize 缩略图最大边长（默认 200px）
 * @returns 缩略图 Data URL（base64）
 */
export async function generateThumbnail(
  file: File,
  maxSize = 200
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      try {
        const { width, height } = img;
        const scale = Math.min(maxSize / width, maxSize / height, 1);
        const newWidth = Math.round(width * scale);
        const newHeight = Math.round(height * scale);

        const canvas = document.createElement('canvas');
        canvas.width = newWidth;
        canvas.height = newHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('无法获取 Canvas 2D 上下文'));
          return;
        }

        ctx.drawImage(img, 0, 0, newWidth, newHeight);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        URL.revokeObjectURL(url);
        resolve(dataUrl);
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('图片加载失败'));
    };

    img.src = url;
  });
}

// ---------------------------------------------------------------------------
// DAG 内存清理 (4.3.4)
// ---------------------------------------------------------------------------

/**
 * 清理 DAG 节点数据，释放内存
 *
 * 策略：
 * - 保留 main-agent 节点
 * - 保留最近 N 个 query 链（query + tools + summary）
 * - 清理已完成的旧 query 链
 *
 * @param nodes 当前 DAG 节点 Map
 * @param keepRecentChains 保留最近的 query 链数量（默认 5）
 * @returns 清理后的节点 Map
 */
export function cleanupDagNodes<T extends { type?: string; parentId?: string; status?: string }>(
  nodes: Map<string, T>,
  keepRecentChains = 5
): Map<string, T> {
  // 收集所有 query 节点，按创建顺序排列
  const queryNodes: Array<{ id: string; node: T }> = [];
  for (const [id, node] of nodes) {
    if (node.type === 'query') {
      queryNodes.push({ id, node });
    }
  }

  // 如果节点数不多，不做清理
  if (queryNodes.length <= keepRecentChains) {
    return nodes;
  }

  // 需要保留的 query ID 集合
  const recentQueries = queryNodes.slice(-keepRecentChains);

  // 收集需要保留的所有节点 ID（query + 其 tools + summary）
  const keepNodeIds = new Set<string>();
  keepNodeIds.add('main-agent');

  for (const q of recentQueries) {
    keepNodeIds.add(q.id);
    // 查找该 query 下的 tool 节点和 summary 节点
    for (const [nid, node] of nodes) {
      if (node.parentId === q.id) {
        keepNodeIds.add(nid);
      }
      // summary 的 endToolIds 引用的 tool 也要保留
      if (node.type === 'summary' && node.parentId === q.id) {
        keepNodeIds.add(nid);
      }
    }
  }

  // 构建新的 Map，只保留需要的节点
  const cleaned = new Map<string, T>();
  for (const [id, node] of nodes) {
    if (keepNodeIds.has(id)) {
      cleaned.set(id, node);
    }
  }

  const removedCount = nodes.size - cleaned.size;
  if (removedCount > 0) {
    console.info(
      `[MemoryManager] DAG 内存清理：移除 ${removedCount} 个旧节点，保留 ${cleaned.size} 个节点`
    );
  }

  return cleaned;
}

// ---------------------------------------------------------------------------
// 内存监控定时器
// ---------------------------------------------------------------------------

let memoryMonitorTimer: ReturnType<typeof setInterval> | null = null;

/**
 * 启动内存监控（定期检查内存使用）
 *
 * @param interval 检查间隔（毫秒），默认 60 秒
 * @param onWarning 内存超限时的回调
 * @returns 停止监控的函数
 */
export function startMemoryMonitoring(
  interval = 60000,
  onWarning?: (usage: number) => void
): () => void {
  if (memoryMonitorTimer) {
    clearInterval(memoryMonitorTimer);
  }

  const check = () => {
    const usage = getCurrentMemoryUsage();
    if (usage > 0 && usage > MEMORY_WARNING_THRESHOLD) {
      emitWarning({
        type: 'memory_high',
        message: `内存使用 (${formatMemorySize(usage)}) 超过警告阈值 (${formatMemorySize(MEMORY_WARNING_THRESHOLD)})`,
        details: { usage, threshold: MEMORY_WARNING_THRESHOLD },
      });
      onWarning?.(usage);
    }
  };

  // 立即检查一次
  check();

  memoryMonitorTimer = setInterval(check, interval);

  return () => {
    if (memoryMonitorTimer) {
      clearInterval(memoryMonitorTimer);
      memoryMonitorTimer = null;
    }
  };
}

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------

/**
 * 格式化内存大小为可读字符串
 */
export function formatMemorySize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${units[i]}`;
}
