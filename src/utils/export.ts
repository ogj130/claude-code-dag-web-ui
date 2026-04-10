/**
 * 数据导出工具
 * 支持 JSON 和 Markdown 格式导出会话数据
 */
import type { SessionRecord, QueryRecord } from '../lib/db';

// ---------------------------------------------------------------------------
// 类型定义
// ---------------------------------------------------------------------------

export interface ExportOptions {
  /** 包含会话元数据 */
  includeMetadata?: boolean;
  /** 包含问答详情 */
  includeQueries?: boolean;
  /** 包含 token 统计 */
  includeTokenStats?: boolean;
  /** 日期格式化 */
  dateFormat?: 'iso' | 'local' | 'timestamp';
}

export interface ExportResult {
  success: boolean;
  content: string;
  filename: string;
  mimeType: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// 辅助函数
// ---------------------------------------------------------------------------

/**
 * 格式化日期
 */
function formatDate(timestamp: number, format: ExportOptions['dateFormat'] = 'iso'): string {
  switch (format) {
    case 'iso':
      return new Date(timestamp).toISOString();
    case 'local':
      return new Date(timestamp).toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    case 'timestamp':
      return String(timestamp);
    default:
      return new Date(timestamp).toISOString();
  }
}

// ---------------------------------------------------------------------------
// JSON 导出
// ---------------------------------------------------------------------------

export interface JSONExportData {
  exportedAt: string;
  version: string;
  totalSessions: number;
  totalQueries: number;
  totalTokenUsage: number;
  sessions: SessionExportData[];
}

export interface SessionExportData {
  id: string;
  name: string;
  projectPath: string;
  createdAt: string;
  updatedAt: string;
  queryCount: number;
  tokenCount: number;
  queries: QueryExportData[];
  metadata?: string;
}

export interface QueryExportData {
  id: string;
  query: string;
  summary?: string;
  analysis?: string;
  timestamp: string;
  tokenCount: number;
  toolCount: number;
  metadata?: string;
}

/**
 * 导出为 JSON 格式
 */
export async function exportToJSON(
  sessions: SessionRecord[],
  queriesMap: Map<string, QueryRecord[]>,
  options: ExportOptions = {}
): Promise<ExportResult> {
  try {
    const totalQueries = sessions.reduce((sum, s) => sum + s.queryCount, 0);
    const totalTokenUsage = sessions.reduce((sum, s) => sum + s.tokenCount, 0);

    const sessionData: SessionExportData[] = sessions.map(session => {
      const sessionQueries = queriesMap.get(session.id) || [];

      const queryData: QueryExportData[] = sessionQueries.map(q => ({
        id: q.id,
        query: q.query,
        summary: q.summary,
        analysis: q.analysis,
        timestamp: formatDate(q.timestamp, options.dateFormat),
        tokenCount: q.tokenCount,
        toolCount: q.toolCount,
        metadata: options.includeMetadata ? q.metadata : undefined,
      }));

      return {
        id: session.id,
        name: session.name,
        projectPath: session.projectPath,
        createdAt: formatDate(session.createdAt, options.dateFormat),
        updatedAt: formatDate(session.updatedAt, options.dateFormat),
        queryCount: session.queryCount,
        tokenCount: session.tokenCount,
        queries: queryData,
        metadata: options.includeMetadata ? session.metadata : undefined,
      };
    });

    const exportData: JSONExportData = {
      exportedAt: new Date().toISOString(),
      version: '1.0.0',
      totalSessions: sessions.length,
      totalQueries,
      totalTokenUsage,
      sessions: sessionData,
    };

    const content = JSON.stringify(exportData, null, 2);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `cc_web_export_${timestamp}.json`;

    return {
      success: true,
      content,
      filename,
      mimeType: 'application/json;charset=utf-8',
    };
  } catch (error) {
    return {
      success: false,
      content: '',
      filename: '',
      mimeType: 'application/json',
      error: error instanceof Error ? error.message : '导出失败',
    };
  }
}

// ---------------------------------------------------------------------------
// Markdown 导出
// ---------------------------------------------------------------------------

/**
 * 导出为 Markdown 格式
 */
export async function exportToMarkdown(
  sessions: SessionRecord[],
  queriesMap: Map<string, QueryRecord[]>,
  options: ExportOptions = {}
): Promise<ExportResult> {
  try {
    const totalTokenUsage = sessions.reduce((sum, s) => sum + s.tokenCount, 0);
    const totalQueries = sessions.reduce((sum, s) => sum + s.queryCount, 0);

    const lines: string[] = [];

    // 标题
    lines.push('# Claude Code Web 会话导出');
    lines.push('');
    lines.push(`> 导出时间: ${formatDate(Date.now(), 'local')}`);
    lines.push('');

    // 概览
    lines.push('## 概览');
    lines.push('');
    lines.push(`- 会话总数: ${sessions.length}`);
    lines.push(`- 问答总数: ${totalQueries}`);
    lines.push(`- Token 总消耗: ${totalTokenUsage.toLocaleString()}`);
    lines.push('');

    // 会话列表
    for (const session of sessions) {
      lines.push('---');
      lines.push('');
      lines.push(`## Session: ${session.name}`);
      lines.push('');

      // 会话元信息
      lines.push('| 属性 | 值 |');
      lines.push('|------|-----|');
      lines.push(`| 会话ID | \`${session.id}\` |`);
      lines.push(`| 创建时间 | ${formatDate(session.createdAt, options.dateFormat)} |`);
      lines.push(`| 更新时间 | ${formatDate(session.updatedAt, options.dateFormat)} |`);
      lines.push(`| 项目路径 | \`${session.projectPath}\` |`);
      lines.push(`| 问答次数 | ${session.queryCount} |`);
      if (options.includeTokenStats !== false) {
        lines.push(`| Token 消耗 | ${session.tokenCount.toLocaleString()} |`);
      }
      lines.push('');

      // 问答详情
      if (options.includeQueries !== false) {
        const sessionQueries = queriesMap.get(session.id) || [];

        for (const query of sessionQueries) {
          lines.push(`### Q: ${query.query}`);
          lines.push('');

          if (query.summary) {
            lines.push('**摘要:**');
            lines.push('');
            lines.push(query.summary);
            lines.push('');
          }

          if (query.analysis) {
            lines.push('**分析:**');
            lines.push('');
            lines.push(query.analysis);
            lines.push('');
          }

          lines.push('<details>');
          lines.push('<summary>详情</summary>');
          lines.push('');
          lines.push(`- 问答ID: \`${query.id}\``);
          lines.push(`- 时间: ${formatDate(query.timestamp, options.dateFormat)}`);
          lines.push(`- Token 消耗: ${query.tokenCount.toLocaleString()}`);
          lines.push(`- 工具调用: ${query.toolCount}`);
          lines.push('</details>');
          lines.push('');
        }
      }
    }

    // 页脚
    lines.push('---');
    lines.push('');
    lines.push('> Generated by Claude Code Web UI');

    const content = lines.join('\n');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `cc_web_export_${timestamp}.md`;

    return {
      success: true,
      content,
      filename,
      mimeType: 'text/markdown;charset=utf-8',
    };
  } catch (error) {
    return {
      success: false,
      content: '',
      filename: '',
      mimeType: 'text/markdown',
      error: error instanceof Error ? error.message : '导出失败',
    };
  }
}

// ---------------------------------------------------------------------------
// 通用下载函数
// ---------------------------------------------------------------------------

/**
 * 触发文件下载
 */
export function downloadFile(result: ExportResult): boolean {
  if (!result.success || !result.content) {
    console.error('[Export] 下载失败:', result.error);
    return false;
  }

  try {
    const blob = new Blob([result.content], { type: result.mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = result.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  } catch (error) {
    console.error('[Export] 下载触发失败:', error);
    return false;
  }
}

/**
 * 复制到剪贴板
 */
export async function copyToClipboard(content: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(content);
    return true;
  } catch {
    // 降级方案
    const textarea = document.createElement('textarea');
    textarea.value = content;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  }
}
