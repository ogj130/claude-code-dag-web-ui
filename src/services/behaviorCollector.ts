/**
 * behaviorCollector — 行为收集器
 *
 * 记录编码风格、调试习惯、框架偏好等行为事件，
 * 为用户画像推理提供原始数据。
 *
 * 使用方式：
 *   import { behaviorCollector } from '@/services/behaviorCollector';
 *   behaviorCollector.record({ type: 'file_create', data: { ext: '.tsx' } });
 */

// ── 类型定义 ────────────────────────────────────────────────

export type BehaviorEventType =
  | 'file_create'      // 创建文件
  | 'file_edit'        // 编辑文件
  | 'file_delete'      // 删除文件
  | 'command_run'      // 运行命令
  | 'model_switch'     // 切换模型
  | 'debug_action'     // 调试操作
  | 'test_run'         // 运行测试
  | 'commit'           // 代码提交
  | 'refactor'         // 重构操作
  | 'search'           // 搜索操作
  | 'preference_set';  // 手动设置偏好

export interface BehaviorEvent {
  id: string;
  type: BehaviorEventType;
  timestamp: number;
  workspaceId: string;
  data: Record<string, unknown>;
}

export interface BehaviorSummary {
  totalEvents: number;
  byType: Record<string, number>;
  languageDistribution: Record<string, number>;
  frameworkHints: string[];
  recentPatterns: string[];
}

// ── 配置 ────────────────────────────────────────────────────

const COLLECTOR_CONFIG = {
  /** 最多保留的事件数 */
  maxEvents: 1000,
  /** 摘要分析的最大回溯事件数 */
  summaryWindow: 200,
} as const;

// ── 存储 ────────────────────────────────────────────────────

const _events: BehaviorEvent[] = [];

function generateId(): string {
  return `beh_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── 核心 API ────────────────────────────────────────────────

/**
 * 记录一个行为事件
 */
export function record(event: Omit<BehaviorEvent, 'id' | 'timestamp'>): string {
  const id = generateId();
  _events.push({
    ...event,
    id,
    timestamp: Date.now(),
  });

  // 超出上限时淘汰最旧的
  if (_events.length > COLLECTOR_CONFIG.maxEvents) {
    _events.splice(0, _events.length - COLLECTOR_CONFIG.maxEvents);
  }

  return id;
}

/**
 * 获取工作区的行为事件
 */
export function getEvents(workspaceId: string, limit?: number): BehaviorEvent[] {
  const filtered = _events.filter((e) => e.workspaceId === workspaceId);
  if (limit) {
    return filtered.slice(-limit);
  }
  return filtered;
}

/**
 * 按类型过滤行为事件
 */
export function getEventsByType(workspaceId: string, type: BehaviorEventType): BehaviorEvent[] {
  return _events.filter((e) => e.workspaceId === workspaceId && e.type === type);
}

// ── 分析 ────────────────────────────────────────────────────

/**
 * 生成行为摘要（用于 LLM 推理输入）
 */
export function summarize(workspaceId: string): BehaviorSummary {
  const events = _events
    .filter((e) => e.workspaceId === workspaceId)
    .slice(-COLLECTOR_CONFIG.summaryWindow);

  const byType: Record<string, number> = {};
  const langDist: Record<string, number> = {};
  const frameworks = new Set<string>();
  const patterns: string[] = [];

  for (const event of events) {
    byType[event.type] = (byType[event.type] ?? 0) + 1;

    // 提取语言分布
    if (event.type === 'file_create' || event.type === 'file_edit') {
      const ext = (event.data.ext as string) ?? '';
      const lang = extToLanguage(ext);
      if (lang) langDist[lang] = (langDist[lang] ?? 0) + 1;
    }

    // 提取框架线索
    if (event.type === 'file_create') {
      const name = (event.data.fileName as string) ?? '';
      if (name.includes('Component') || name.includes('.tsx')) frameworks.add('React');
      if (name.includes('.vue')) frameworks.add('Vue');
      if (name.includes('.svelte')) frameworks.add('Svelte');
      if (name.includes('page') && name.includes('.ts')) frameworks.add('Next.js');
    }

    if (event.type === 'command_run') {
      const cmd = (event.data.command as string) ?? '';
      if (cmd.includes('vitest') || cmd.includes('jest')) frameworks.add('Vitest/Jest');
      if (cmd.includes('docker')) frameworks.add('Docker');
      if (cmd.includes('npm') || cmd.includes('pnpm')) frameworks.add('Node.js');
    }

    // 提取调试模式
    if (event.type === 'debug_action') {
      const action = (event.data.action as string) ?? '';
      patterns.push(`debug:${action}`);
    }
  }

  return {
    totalEvents: events.length,
    byType,
    languageDistribution: langDist,
    frameworkHints: [...frameworks],
    recentPatterns: [...new Set(patterns)].slice(-10),
  };
}

/**
 * 扩展名 → 语言映射
 */
function extToLanguage(ext: string): string | null {
  const map: Record<string, string> = {
    '.ts': 'TypeScript',
    '.tsx': 'TypeScript',
    '.js': 'JavaScript',
    '.jsx': 'JavaScript',
    '.py': 'Python',
    '.go': 'Go',
    '.rs': 'Rust',
    '.java': 'Java',
    '.cpp': 'C++',
    '.c': 'C',
    '.rb': 'Ruby',
    '.swift': 'Swift',
    '.kt': 'Kotlin',
  };
  return map[ext] ?? null;
}

/**
 * 重置收集器（测试用）
 */
export function resetCollector(): void {
  _events.length = 0;
}
