/**
 * DAG 渲染性能监控工具
 * 用于测量渲染耗时和帧率
 */

/** 性能监控器 */
export function createPerformanceMonitor() {
  const renderTimes: number[] = [];
  const frameTimes: number[] = [];

  return {
    /** 记录渲染开始时间 */
    startRender(): number {
      return performance.now();
    },

    /** 记录渲染结束时间并返回耗时 (ms) */
    endRender(startTime: number): number {
      const elapsed = performance.now() - startTime;
      renderTimes.push(elapsed);
      // 仅保留最近 100 次记录
      if (renderTimes.length > 100) renderTimes.shift();
      return elapsed;
    },

    /** 计算平均渲染耗时 (ms) */
    getAverageRenderTime(): number {
      if (renderTimes.length === 0) return 0;
      return renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length;
    },

    /** 获取最近一次渲染耗时 (ms) */
    getLastRenderTime(): number {
      return renderTimes.length > 0 ? renderTimes[renderTimes.length - 1] : 0;
    },

    /** 记录帧时间戳并计算 FPS */
    recordFrame(): number {
      const now = performance.now();
      frameTimes.push(now);
      // 仅保留最近 60 帧
      if (frameTimes.length > 60) frameTimes.shift();
      return this.calculateFPS();
    },

    /** 基于已记录帧时间计算 FPS */
    calculateFPS(): number {
      if (frameTimes.length < 2) return 0;
      const duration = frameTimes[frameTimes.length - 1] - frameTimes[0];
      if (duration <= 0) return 0;
      return ((frameTimes.length - 1) / duration) * 1000;
    },

    /** 获取性能摘要 */
    getSummary() {
      return {
        averageRenderTime: this.getAverageRenderTime(),
        lastRenderTime: this.getLastRenderTime(),
        fps: this.calculateFPS(),
        totalSamples: renderTimes.length,
      };
    },

    /** 重置所有记录 */
    reset() {
      renderTimes.length = 0;
      frameTimes.length = 0;
    },
  };
}

export type PerformanceMonitor = ReturnType<typeof createPerformanceMonitor>;

/** 全局单例监控器 */
let globalMonitor: PerformanceMonitor | null = null;

export function getGlobalMonitor(): PerformanceMonitor {
  if (!globalMonitor) {
    globalMonitor = createPerformanceMonitor();
  }
  return globalMonitor;
}

/**
 * 防抖工具函数
 */
export function debounce<T extends (...args: never[]) => void>(
  fn: T,
  delay: number
): T & { cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const debounced = function (...args: Parameters<T>) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn(...args);
      timer = null;
    }, delay);
  } as T & { cancel: () => void };

  debounced.cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  return debounced;
}

/**
 * 类型安全的防抖（用于 ReactFlow 回调）
 */
export function debounceCallback<T extends (...args: never[]) => void>(
  fn: T,
  delay: number
): T {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const debounced = function (...args: Parameters<T>) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn(...args);
      timer = null;
    }, delay);
  } as unknown as T;

  return debounced;
}
