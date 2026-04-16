/**
 * qaHistoryExport.ts — 问答历史记录导出服务
 *
 * 支持导出为 Markdown、JSON、HTML 格式
 */
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import type { QAHistoryEntry } from '@/types/qaHistory';

/**
 * 导出选项接口
 */
export interface ExportOptions {
  /** 导出标题（默认使用日期） */
  title?: string;
  /** 是否包含 Token 统计信息（默认 true） */
  includeTokenStats?: boolean;
  /** 是否包含文件变更（默认 true） */
  includeFileChanges?: boolean;
  /** 模型名称（可选） */
  model?: string;
}

/**
 * HTML 导出样式常量
 */
const EXPORT_CSS = `
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    line-height: 1.6;
    max-width: 900px;
    margin: 0 auto;
    padding: 20px;
    color: #333;
  }
  h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
  h2 { color: #34495e; margin-top: 30px; }
  .entry { background: #f9f9f9; border-radius: 8px; padding: 20px; margin: 20px 0; }
  .prompt { background: #e8f4fd; padding: 15px; border-radius: 5px; margin: 10px 0; }
  .answer { background: #f0f8e8; padding: 15px; border-radius: 5px; margin: 10px 0; }
  .stats { color: #7f8c8d; font-size: 0.9em; margin: 10px 0; }
  .stats span { margin-right: 15px; }
  .files { background: #fff8e7; padding: 10px; border-radius: 5px; margin: 10px 0; }
  .files li { margin: 5px 0; }
  .timestamp { color: #95a5a6; font-size: 0.85em; }
  code { background: #ecf0f1; padding: 2px 5px; border-radius: 3px; }
  pre { background: #2c3e50; color: #ecf0f1; padding: 15px; border-radius: 5px; overflow-x: auto; }
  .tag { display: inline-block; background: #3498db; color: white; padding: 2px 8px; border-radius: 10px; font-size: 0.8em; margin: 2px; }
  .create { color: #27ae60; }
  .modify { color: #f39c12; }
  .delete { color: #e74c3c; }
`;

/**
 * 文件变更类型图标映射
 */
const FILE_CHANGE_ICONS: Record<string, string> = {
  create: '+',
  modify: '~',
  delete: '-',
};

/**
 * 将时间戳转换为 ISO 格式字符串
 */
function formatDate(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

/**
 * 将时间戳转换为 YYYY-MM-DD 格式
 */
function formatDateShort(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

/**
 * 格式化文件变更类型图标
 */
function formatFileChangeIcon(type: 'create' | 'modify' | 'delete'): string {
  return FILE_CHANGE_ICONS[type] || ' ';
}

/**
 * 导出为 Markdown 格式
 *
 * @param entries - QA 历史记录数组
 * @param options - 导出选项
 * @returns Markdown 格式字符串
 */
export function exportToMarkdown(
  entries: QAHistoryEntry[],
  options: ExportOptions = {}
): string {
  const {
    title = `QA Export ${formatDateShort(Date.now())}`,
    includeTokenStats = true,
    includeFileChanges = true,
    model,
  } = options;

  const lines: string[] = ['---'];
  lines.push(`title: "${title}"`);
  lines.push(`date: "${formatDate(Date.now())}"`);

  if (model) {
    lines.push(`model: ${model}`);
  }

  if (entries.length > 0) {
    lines.push(`workspaceId: ${entries[0].workspaceId}`);
    const allTags = new Set<string>();
    entries.forEach(e => e.tags.forEach(t => allTags.add(t)));
    if (allTags.size > 0) {
      lines.push('tags:');
      Array.from(allTags).sort().forEach(tag => {
        lines.push(`  - ${tag}`);
      });
    }
  }

  lines.push('---');
  lines.push('');

  if (entries.length === 0) {
    lines.push('*No entries to export*');
    return lines.join('\n');
  }

  entries.forEach((entry, index) => {
    const num = index + 1;
    lines.push(`## Q${num}`);
    lines.push('');
    lines.push(`**Prompt:**`);
    lines.push(entry.prompt);
    lines.push('');
    lines.push(`**Answer:**`);
    lines.push(entry.answer);
    lines.push('');

    if (includeTokenStats) {
      lines.push(`**Token:** ${entry.tokenUsage}`);
      lines.push(`**Cost:** $${entry.cost.toFixed(4)}`);
      lines.push(`**Latency:** ${entry.latency}ms`);
      lines.push('');
    }

    if (includeFileChanges && entry.fileChanges.length > 0) {
      lines.push('**Files:**');
      entry.fileChanges.forEach(fc => {
        const icon = formatFileChangeIcon(fc.type);
        lines.push(`  ${icon} ${fc.type.padEnd(7)} ${fc.path}${fc.size ? ` (${fc.size} bytes)` : ''}`);
      });
      lines.push('');
    }

    lines.push(`*${formatDate(entry.createdAt)}*`);
    lines.push('');
  });

  return lines.join('\n');
}

/**
 * 导出为 JSON 格式
 *
 * @param entries - QA 历史记录数组
 * @param options - 导出选项
 * @returns JSON 格式字符串（pretty print）
 */
export function exportToJSON(
  entries: QAHistoryEntry[],
  options: ExportOptions = {}
): string {
  const { title = `QA Export ${formatDateShort(Date.now())}` } = options;

  const exportData = {
    title,
    exportedAt: formatDate(Date.now()),
    totalCount: entries.length,
    entries: entries.map(entry => ({
      id: entry.id,
      workspaceId: entry.workspaceId,
      sessionId: entry.sessionId,
      queryId: entry.queryId,
      prompt: entry.prompt,
      answer: entry.answer,
      tokenUsage: entry.tokenUsage,
      cost: entry.cost,
      latency: entry.latency,
      toolCalls: entry.toolCalls,
      fileChanges: entry.fileChanges,
      status: entry.status,
      tags: entry.tags,
      rating: entry.rating,
      notes: entry.notes,
      createdAt: entry.createdAt,
    })),
  };

  return JSON.stringify(exportData, null, 2);
}

/**
 * 导出为 HTML 格式
 *
 * @param entries - QA 历史记录数组
 * @param options - 导出选项
 * @returns HTML 格式字符串
 */
export async function exportToHTML(
  entries: QAHistoryEntry[],
  options: ExportOptions = {}
): Promise<string> {
  const {
    title = `QA Export ${formatDateShort(Date.now())}`,
    includeTokenStats = true,
    includeFileChanges = true,
    model,
  } = options;

  const css = EXPORT_CSS;

  const tagsHtml = entries.length > 0
    ? Array.from(new Set(entries.flatMap(e => e.tags))).sort()
        .map(tag => `<span class="tag">${DOMPurify.sanitize(tag)}</span>`).join(' ')
    : '';

  const entriesHtml: string[] = [];

  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index];
    const num = index + 1;

    // 使用 marked 渲染 Markdown 并用 DOMPurify 净化（防止 XSS）
    const promptHtml = DOMPurify.sanitize(await marked(entry.prompt));
    const answerHtml = DOMPurify.sanitize(await marked(entry.answer));

    let statsHtml = '';
    if (includeTokenStats) {
      statsHtml = `
        <div class="stats">
          <span>Token: <strong>${entry.tokenUsage}</strong></span>
          <span>Cost: <strong>$${entry.cost.toFixed(4)}</strong></span>
          <span>Latency: <strong>${entry.latency}ms</strong></span>
          ${entry.rating > 0 ? `<span>Rating: <strong>${entry.rating}/5</strong></span>` : ''}
        </div>
      `;
    }

    let filesHtml = '';
    if (includeFileChanges && entry.fileChanges.length > 0) {
      const filesList = entry.fileChanges.map(fc => {
        const icon = formatFileChangeIcon(fc.type);
        return `<li class="${fc.type}">${icon} ${fc.type} <code>${fc.path}</code>${fc.size ? ` (${fc.size} bytes)` : ''}</li>`;
      }).join('');
      filesHtml = `<div class="files"><strong>Files:</strong><ul>${filesList}</ul></div>`;
    }

    entriesHtml.push(`
      <div class="entry">
        <h2>#${num} ${entry.status.toUpperCase()}</h2>
        <div class="prompt">
          <strong>Prompt:</strong>
          ${promptHtml}
        </div>
        <div class="answer">
          <strong>Answer:</strong>
          ${answerHtml}
        </div>
        ${statsHtml}
        ${filesHtml}
        ${entry.notes ? `<p><em>Notes: ${entry.notes}</em></p>` : ''}
        <p class="timestamp">Created: ${formatDate(entry.createdAt)}</p>
      </div>
    `);
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>${css}</style>
</head>
<body>
  <h1>${title}</h1>
  ${model ? `<p><strong>Model:</strong> ${DOMPurify.sanitize(model)}</p>` : ''}
  ${tagsHtml ? `<div>${tagsHtml}</div>` : ''}
  <p><strong>Total Entries:</strong> ${entries.length}</p>
  <p><strong>Exported:</strong> ${formatDate(Date.now())}</p>
  <hr>
  ${entriesHtml.length > 0 ? entriesHtml.join('\n') : '<p><em>No entries to export</em></p>'}
</body>
</html>`;
}
