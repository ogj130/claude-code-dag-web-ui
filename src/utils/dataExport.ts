/**
 * 数据导出工具
 * 支持 JSON 和 Markdown 格式导出历史记录
 */

import { db } from '@/stores/db';
import { decompress } from '@/utils/compression';
import type { DBSession, DBQuery } from '@/types/storage';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExportData {
  version: string;
  exportedAt: number;
  sessions: DBSession[];
  queries: DBQuery[];
}

// ---------------------------------------------------------------------------
// JSON Export
// ---------------------------------------------------------------------------

/**
 * 导出所有历史记录为 JSON 格式
 */
export async function exportAsJSON(): Promise<void> {
  try {
    // 1. 从数据库获取所有数据
    const sessions = await db.sessions
      .where('status')
      .notEqual('deleted')
      .toArray();

    const queries = await db.queries.toArray();

    // 2. 构建导出数据
    const exportData: ExportData = {
      version: '2.0.0',
      exportedAt: Date.now(),
      sessions,
      queries,
    };

    // 3. 生成 JSON 文件
    const jsonString = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    // 4. 触发下载
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `claude-code-history-${timestamp}.json`;
    downloadFile(url, filename);

    console.info('[Export] JSON export completed:', filename);
  } catch (error) {
    console.error('[Export] Failed to export JSON:', error);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Markdown Export
// ---------------------------------------------------------------------------

/**
 * 导出所有历史记录为 Markdown 格式
 */
export async function exportAsMarkdown(): Promise<void> {
  try {
    // 1. 从数据库获取所有数据
    const sessions = await db.sessions
      .where('status')
      .notEqual('deleted')
      .sortBy('createdAt');

    const queries = await db.queries.toArray();

    // 2. 按会话分组查询
    const queriesBySession = new Map<string, DBQuery[]>();
    for (const query of queries) {
      if (!queriesBySession.has(query.sessionId)) {
        queriesBySession.set(query.sessionId, []);
      }
      queriesBySession.get(query.sessionId)!.push(query);
    }

    // 3. 生成 Markdown 内容
    let markdown = `# Claude Code 历史记录\n\n`;
    markdown += `导出时间：${new Date().toLocaleString('zh-CN')}\n\n`;
    markdown += `总会话数：${sessions.length}\n`;
    markdown += `总查询数：${queries.length}\n\n`;
    markdown += `---\n\n`;

    for (const session of sessions) {
      markdown += `## ${session.title}\n\n`;
      markdown += `- **会话 ID**: ${session.id}\n`;
      markdown += `- **创建时间**: ${new Date(session.createdAt).toLocaleString('zh-CN')}\n`;
      markdown += `- **更新时间**: ${new Date(session.updatedAt).toLocaleString('zh-CN')}\n`;
      markdown += `- **查询次数**: ${session.queryCount}\n`;
      markdown += `- **Token 使用**: ${session.tokenUsage}\n`;
      if (session.tags.length > 0) {
        markdown += `- **标签**: ${session.tags.join(', ')}\n`;
      }
      markdown += `\n`;

      if (session.summary) {
        markdown += `**摘要**：${session.summary}\n\n`;
      }

      // 添加该会话的查询记录
      const sessionQueries = queriesBySession.get(session.id) ?? [];
      if (sessionQueries.length > 0) {
        markdown += `### 查询记录\n\n`;

        for (let i = 0; i < sessionQueries.length; i++) {
          const query = sessionQueries[i];
          markdown += `#### 查询 ${i + 1}\n\n`;
          markdown += `**问题**：\n\n${decompress(query.question)}\n\n`;
          markdown += `**回答**：\n\n${decompress(query.answer)}\n\n`;

          if (query.toolCalls.length > 0) {
            markdown += `**工具调用**：\n\n`;
            for (const tool of query.toolCalls) {
              markdown += `- ${tool.name}`;
              if (tool.success) {
                markdown += ` ✓\n`;
              } else {
                markdown += ` ✗ (${tool.error})\n`;
              }
            }
            markdown += `\n`;
          }

          markdown += `- **Token 使用**: ${query.tokenUsage}\n`;
          markdown += `- **执行时长**: ${query.duration}ms\n`;
          markdown += `- **时间**: ${new Date(query.createdAt).toLocaleString('zh-CN')}\n\n`;
          markdown += `---\n\n`;
        }
      }

      markdown += `\n`;
    }

    // 4. 生成 Markdown 文件
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    // 5. 触发下载
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `claude-code-history-${timestamp}.md`;
    downloadFile(url, filename);

    console.info('[Export] Markdown export completed:', filename);
  } catch (error) {
    console.error('[Export] Failed to export Markdown:', error);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

/**
 * 触发文件下载
 */
function downloadFile(url: string, filename: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
