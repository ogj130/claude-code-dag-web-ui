/**
 * V1.4.1 - AttachmentPreviewModal Component
 * 支持多种文档格式的预览渲染：md(ReactMarkdown)、docx(mammoth)、xlsx/csv(xlsx)、ppt/pptx(文本大纲)
 */

import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import * as mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import {
  formatFileSize,
  getFileIcon,
  getFileTypeColor,
  type PendingAttachment,
} from '../../types/attachment';

interface AttachmentPreviewModalProps {
  attachment: PendingAttachment | null;
  onClose: () => void;
}

type DocType = 'markdown' | 'docx' | 'xlsx' | 'csv' | 'ppt' | 'pptx' | 'image' | 'text' | 'unknown';

function detectDocType(mimeType: string, fileName: string): DocType {
  const lower = mimeType.toLowerCase();
  const ext = fileName.toLowerCase().split('.').pop() ?? '';

  if (lower.includes('markdown') || ext === 'md') return 'markdown';
  if (lower.includes('wordprocessingml') || ext === 'docx') return 'docx';
  if (lower.includes('spreadsheetml') || ext === 'xlsx' || ext === 'xls') return 'xlsx';
  if (lower.includes('csv') || ext === 'csv') return 'csv';
  if (lower.includes('presentationml') || ext === 'pptx') return 'pptx';
  if (lower.includes('ms-powerpoint') || ext === 'ppt') return 'ppt';
  if (lower.includes('image/')) return 'image';
  if (lower.includes('text/') || ext === 'txt' || ext === 'log' || ext === 'json' || ext === 'xml') return 'text';
  return 'unknown';
}

export function AttachmentPreviewModal({ attachment, onClose }: AttachmentPreviewModalProps) {
  const [docHtml, setDocHtml] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (attachment) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [attachment]);

  // 解析文档内容
  useEffect(() => {
    if (!attachment) return;
    setDocHtml('');
    setError('');
    setLoading(true);

    const docType = detectDocType(attachment.mimeType, attachment.fileName);

    const parseDoc = async () => {
      try {
        switch (docType) {
          case 'docx': {
            // V1.4.1: docx 从 rawData(base64) 解析
            const raw = attachment.rawData;
            if (!raw) { setError('无文档数据'); break; }
            const binaryStr = atob(raw);
            const bytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
            const result = await mammoth.convertToHtml({ arrayBuffer: bytes.buffer as ArrayBuffer });
            setDocHtml(result.value);
            if (result.messages.length > 0) console.warn('[Docx preview]', result.messages);
            break;
          }
          case 'xlsx': {
            // V1.4.1: xlsx 从 rawData(base64) 解析，转换为 CSV 表格
            const raw = attachment.rawData;
            if (!raw) { setError('无文档数据'); break; }
            const binaryStr = atob(raw);
            const bytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
            const wb = XLSX.read(bytes, { type: 'array' });
            const firstSheet = wb.Sheets[wb.SheetNames[0]];
            const csv = XLSX.utils.sheet_to_csv(firstSheet);
            const data = parseCSV(csv);
            setDocHtml(makeTableHtml(data));
            break;
          }
          case 'csv': {
            if (!attachment.textContent) { setError('无文档内容'); break; }
            const data = parseCSV(attachment.textContent);
            setDocHtml(makeTableHtml(data));
            break;
          }
          case 'ppt':
          case 'pptx': {
            // V1.4.1: PPT/PPTX 显示为结构化文本大纲
            const text = attachment.textContent ?? '';
            const slides = extractPPTXText(text);
            setDocHtml(makePPOutlineHtml(slides));
            break;
          }
          default:
            setLoading(false);
            return;
        }
      } catch (err) {
        console.error('[Doc preview]', err);
        setError(err instanceof Error ? err.message : '解析失败');
      } finally {
        setLoading(false);
      }
    };

    parseDoc();
  }, [attachment]);

  if (!attachment) return null;

  const docType = detectDocType(attachment.mimeType, attachment.fileName);
  const typeColor = getFileTypeColor(attachment.type);

  return (
    <div className="attachment-preview-modal" onClick={onClose}>
      <div
        className="attachment-preview-content"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="preview-header">
          <div className="preview-title">
            <span className="preview-icon" style={{ backgroundColor: `${typeColor}15` }}>
              {getFileIcon(attachment.type, attachment.mimeType)}
            </span>
            <div>
              <div className="preview-filename">{attachment.fileName}</div>
              <div className="preview-meta">
                <span style={{ color: typeColor }}>{getTypeLabel(docType)}</span>
                <span>·</span>
                <span>{formatFileSize(attachment.fileSize)}</span>
              </div>
            </div>
          </div>
          <button className="preview-close" onClick={onClose} title="关闭 (Esc)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="preview-body">
          {/* 图片 */}
          {docType === 'image' && attachment.imageData && (
            <img src={attachment.imageData} alt={attachment.fileName} className="preview-image" />
          )}

          {/* Markdown */}
          {docType === 'markdown' && attachment.textContent && (
            <div className="preview-markdown">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {attachment.textContent}
              </ReactMarkdown>
            </div>
          )}

          {/* Word / Excel / PPT 渲染 */}
          {['docx', 'xlsx', 'csv', 'ppt', 'pptx'].includes(docType) && (
            loading ? (
              <div className="preview-loading">
                <span>正在解析文档...</span>
              </div>
            ) : error ? (
              <div className="preview-error">
                <span>解析失败：{error}</span>
                {attachment.textContent && (
                  <pre className="preview-text">{attachment.textContent.slice(0, 2000)}</pre>
                )}
              </div>
            ) : docHtml ? (
              <div
                className="preview-doc-html"
                dangerouslySetInnerHTML={{ __html: docHtml }}
              />
            ) : null
          )}

          {/* 纯文本 fallback */}
          {!['image', 'markdown', 'docx', 'xlsx', 'csv', 'ppt', 'pptx'].includes(docType) &&
           attachment.textContent && (
            <pre className="preview-text">{attachment.textContent}</pre>
          )}

          {/* 空状态 */}
          {!attachment.imageData && !attachment.textContent && !docHtml && (
            <div className="preview-empty">
              <span>无法预览此文件</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="preview-footer">
          <span className="preview-hint">按 Esc 关闭</span>
          <span className="preview-hint">点击遮罩区域关闭</span>
        </div>
      </div>

      <style>{`
        .attachment-preview-modal {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          animation: fadeIn 0.15s ease-out;
          padding: 20px;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .attachment-preview-content {
          background: var(--bg-card, #1e1e2e);
          border: 1px solid var(--border, #2a2a3a);
          border-radius: 12px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
          overflow: hidden;
          width: 100%;
          max-width: 900px;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          animation: slideUp 0.2s ease-out;
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(10px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .preview-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: var(--bg-bar, #13132a);
          border-bottom: 1px solid var(--border, #2a2a3a);
          flex-shrink: 0;
        }
        .preview-title {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .preview-icon {
          width: 40px;
          height: 40px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
        }
        .preview-filename {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary, #e2e2ef);
          font-family: 'JetBrains Mono', monospace;
        }
        .preview-meta {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          color: var(--text-muted, #6b6b7e);
          margin-top: 2px;
        }
        .preview-close {
          width: 32px;
          height: 32px;
          border-radius: 6px;
          border: none;
          background: transparent;
          color: var(--text-muted, #6b6b7e);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s;
        }
        .preview-close:hover {
          background: rgba(255, 255, 255, 0.1);
          color: var(--text-primary, #e2e2ef);
        }
        .preview-body {
          flex: 1;
          overflow: auto;
          background: var(--bg-terminal, #050508);
          padding: 16px;
        }
        .preview-image {
          max-width: 100%;
          max-height: calc(90vh - 140px);
          object-fit: contain;
          border-radius: 4px;
          margin: 0 auto;
          display: block;
        }
        .preview-text {
          margin: 0;
          padding: 16px;
          background: rgba(255,255,255,0.03);
          border: 1px solid var(--term-border, #1a1a2a);
          border-radius: 6px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          line-height: 1.6;
          color: var(--text-secondary, #8b8b9e);
          white-space: pre-wrap;
          word-break: break-all;
          max-height: calc(90vh - 140px);
          overflow: auto;
        }
        .preview-markdown {
          color: var(--text-secondary, #8b8b9e);
          font-size: 13px;
          line-height: 1.7;
          max-height: calc(90vh - 140px);
          overflow: auto;
          padding: 4px;
        }
        .preview-markdown h1 { font-size: 18px; font-weight: 700; color: var(--text-primary); margin: 16px 0 8px; border-bottom: 1px solid var(--border); padding-bottom: 6px; }
        .preview-markdown h2 { font-size: 15px; font-weight: 600; color: var(--text-primary); margin: 14px 0 6px; }
        .preview-markdown h3 { font-size: 13px; font-weight: 600; color: var(--text-primary); margin: 12px 0 4px; }
        .preview-markdown p { margin: 8px 0; }
        .preview-markdown code {
          background: rgba(255,255,255,0.08);
          border-radius: 3px;
          padding: 1px 5px;
          font-size: 11px;
          font-family: 'JetBrains Mono', monospace;
        }
        .preview-markdown pre {
          background: rgba(0,0,0,0.3);
          border-radius: 6px;
          padding: 12px;
          overflow-x: auto;
          margin: 10px 0;
        }
        .preview-markdown pre code { background: transparent; padding: 0; }
        .preview-markdown table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 12px; }
        .preview-markdown th, .preview-markdown td { border: 1px solid var(--border); padding: 6px 10px; }
        .preview-markdown th { background: rgba(99,102,241,0.1); font-weight: 600; color: var(--text-primary); }
        .preview-markdown blockquote { border-left: 3px solid var(--success); padding-left: 12px; margin: 8px 0; color: var(--text-muted); }
        .preview-markdown ul, .preview-markdown ol { padding-left: 20px; margin: 6px 0; }
        .preview-doc-html {
          color: var(--text-secondary, #8b8b9e);
          font-size: 13px;
          line-height: 1.7;
          max-height: calc(90vh - 140px);
          overflow: auto;
        }
        .preview-doc-html table {
          width: 100%;
          border-collapse: collapse;
          margin: 10px 0;
          font-size: 12px;
        }
        .preview-doc-html th, .preview-doc-html td {
          border: 1px solid rgba(255,255,255,0.1);
          padding: 6px 10px;
          text-align: left;
        }
        .preview-doc-html th {
          background: rgba(99,102,241,0.1);
          font-weight: 600;
          color: var(--text-primary);
        }
        .preview-doc-html h1, .preview-doc-html h2, .preview-doc-html h3 {
          color: var(--text-primary);
          margin: 12px 0 6px;
        }
        .preview-doc-html p { margin: 6px 0; }
        .preview-doc-html ul, .preview-doc-html ol { padding-left: 20px; margin: 6px 0; }
        .preview-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          font-size: 13px;
          padding: 40px;
        }
        .preview-error {
          color: var(--error, #e74c3c);
          font-size: 13px;
          padding: 12px 0;
        }
        .preview-empty {
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted, #6b6b7e);
          font-size: 14px;
          padding: 40px;
        }
        .preview-footer {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 20px;
          padding: 10px 16px;
          background: var(--bg-bar, #13132a);
          border-top: 1px solid var(--border, #2a2a3a);
          flex-shrink: 0;
        }
        .preview-hint { font-size: 10px; color: var(--text-dim, #4a4a5e); }
      `}</style>
    </div>
  );
}

function getTypeLabel(docType: DocType): string {
  switch (docType) {
    case 'markdown': return 'Markdown 文档';
    case 'docx': return 'Word 文档';
    case 'xlsx': return 'Excel 工作表';
    case 'csv': return 'CSV 文件';
    case 'ppt': return 'PowerPoint 演示';
    case 'pptx': return 'PowerPoint 演示';
    case 'image': return '图片';
    case 'text': return '文本文件';
    default: return '未知文件';
  }
}

// ── CSV 解析 ──────────────────────────────────────────────
function parseCSV(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  return lines.map(line => {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        cells.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    cells.push(current.trim());
    return cells;
  });
}

// ── CSV/XLSX → HTML Table ──────────────────────────────────
function makeTableHtml(data: string[][]): string {
  if (data.length === 0) return '<p style="color:var(--text-muted)">文档为空</p>';
  const maxCols = Math.max(...data.map(r => r.length));
  const headers = data[0] ?? [];
  const rows = data.slice(1);

  let html = '<table>';
  html += '<thead><tr>';
  for (let c = 0; c < maxCols; c++) {
    html += `<th>${escapeHtml(headers[c] ?? '')}</th>`;
  }
  html += '</tr></thead><tbody>';
  for (const row of rows) {
    html += '<tr>';
    for (let c = 0; c < maxCols; c++) {
      html += `<td>${escapeHtml(row[c] ?? '')}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  return html;
}

// ── PPT/PPTX 文本大纲提取 ──────────────────────────────────
interface PptSlide { title: string; bullets: string[]; }

function extractPPTXText(textContent: string): PptSlide[] {
  if (!textContent) return [];
  // textContent 可能是换行分隔的文本，每段视为一个点
  const paragraphs = textContent.split(/\r?\n\n+/).filter(p => p.trim());
  const slides: PptSlide[] = [];
  let current: PptSlide = { title: '', bullets: [] };

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;
    // 短行（<50字）视为标题
    if (!current.title && trimmed.length < 60) {
      current.title = trimmed;
    } else {
      // 长文本按句子拆分
      const sentences = trimmed.split(/[.。!！?？]/).filter(s => s.trim());
      for (const s of sentences) {
        const clean = s.trim();
        if (clean.length > 3) current.bullets.push(clean);
      }
    }
    // 每 6 个点视为新幻灯片
    if (current.bullets.length >= 6) {
      if (current.title || current.bullets.length > 0) {
        if (!current.title) current.title = `幻灯片 ${slides.length + 1}`;
        slides.push(current);
      }
      current = { title: '', bullets: [] };
    }
  }
  if (current.title || current.bullets.length > 0) {
    if (!current.title) current.title = `幻灯片 ${slides.length + 1}`;
    slides.push(current);
  }
  return slides;
}

function makePPOutlineHtml(slides: PptSlide[]): string {
  if (slides.length === 0) return '<p style="color:var(--text-muted)">无法提取幻灯片内容</p>';
  let html = '';
  slides.forEach((slide, i) => {
    html += `<div style="margin-bottom:16px;padding:12px;background:rgba(255,255,255,0.03);border-radius:8px;border-left:3px solid #6366F1;">`;
    html += `<div style="font-size:13px;font-weight:700;color:var(--text-primary);margin-bottom:8px;">`;
    html += `<span style="color:#6366F1;font-size:11px;margin-right:6px;">幻灯片 ${i + 1}</span>${escapeHtml(slide.title)}`;
    html += '</div>';
    if (slide.bullets.length > 0) {
      html += '<ul style="margin:0;padding-left:18px;color:var(--text-secondary);font-size:12px;line-height:1.8;">';
      slide.bullets.forEach(b => { html += `<li>${escapeHtml(b)}</li>`; });
      html += '</ul>';
    }
    html += '</div>';
  });
  return html;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
