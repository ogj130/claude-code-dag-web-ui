/**
 * V1.4.1 - File Upload Hook
 * Custom hook for handling file uploads (images and text files)
 * 上传后自动索引文本内容到 RAG 向量数据库
 */

import { useCallback } from 'react';
import { useAttachmentStore } from '../stores/useAttachmentStore';
import { processImage } from '../utils/imageProcessor';
import { validateAttachmentFile, type PendingAttachment } from '../types/attachment';
import { generateAttachmentId } from '../utils/textFileReader';
import { indexAttachmentChunks } from '../stores/vectorStorage';
import { useSessionStore } from '../stores/useSessionStore';
import { markWorkspaceIndexed, getIndexedWorkspaces } from '../stores/localVectorStorage';
import * as mammoth from 'mammoth';
import * as XLSX from 'xlsx';

const MAX_FILES = 10;

/**
 * File upload hook
 */
export function useFileUpload() {
  const { addPendingAttachment, updatePendingAttachment, removePendingAttachment, clearPendingAttachments } =
    useAttachmentStore();

  /**
   * Handle file selection from input
   */
  const handleFileSelect = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      const fileArray = Array.from(files);
      const currentCount = useAttachmentStore.getState().pendingAttachments.length;
      const remainingSlots = MAX_FILES - currentCount;

      if (remainingSlots <= 0) {
        console.warn('[FileUpload] Maximum file limit reached');
        return;
      }

      // Limit files to remaining slots
      const filesToProcess = fileArray.slice(0, remainingSlots);

      for (const file of filesToProcess) {
        // Validate file
        const validation = validateAttachmentFile(file);
        if (!validation.valid) {
          console.warn('[FileUpload] Invalid file:', validation.error);
          continue;
        }

        const id = generateAttachmentId();

        // Add pending attachment immediately with processing status
        addPendingAttachment({
          id,
          type: file.type.startsWith('image/') ? 'image' : 'text',
          mimeType: file.type || 'text/plain',
          fileName: file.name,
          fileSize: file.size,
          status: 'processing',
          createdAt: Date.now(),
        });

        try {
          // 获取当前会话的 workspacePath
          const workspacePath = useSessionStore.getState()
            .sessions.find(s => s.isActive)?.projectPath ?? '/Users/ouguangji/2026/cc-web-ui';
          const sessionId = useSessionStore.getState().activeSessionId;

          const ext = file.name.toLowerCase().split('.').pop() ?? '';
          const isImage = file.type.startsWith('image/') || /\.(png|jpg|jpeg|webp|gif)$/i.test(file.name);
          const isBinaryDoc = ['docx', 'xlsx', 'xls', 'pptx', 'ppt'].includes(ext);

          if (isImage) {
            const processed = await processImage(file);
            updatePendingAttachment(id, {
              type: 'image',
              mimeType: processed.mimeType,
              fileSize: processed.processedSize,
              thumbnailData: processed.thumbnailData,
              imageData: processed.imageData,
              status: 'ready',
            });
            // 图片不做 RAG 索引
          } else if (isBinaryDoc) {
            // V1.4.1: 二进制文档存原始数据（预览用），同时提取文本入 RAG
            const buffer = await file.arrayBuffer();
            const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
            const mimeStr = file.type || 'application/octet-stream';

            // 提取纯文本（用于 RAG）
            const textContent = await _extractTextFromBinaryDoc(ext, buffer);
            const preview = textContent.slice(0, 200).trim();

            updatePendingAttachment(id, {
              type: 'text',
              mimeType: mimeStr,
              fileSize: file.size,
              rawData: base64,
              textContent: textContent || undefined,
              textPreview: preview,
              status: 'ready',
            });

            // 自动索引到 RAG
            if (textContent) {
              await _indexAttachment(id, file.name, mimeStr, textContent, workspacePath, sessionId);
            }
          } else {
            // 普通文本文件
            const text = await file.text();
            const preview = text.slice(0, 200).trim();
            const mimeStr = file.type || 'text/plain';

            updatePendingAttachment(id, {
              type: 'text',
              mimeType: mimeStr,
              fileSize: file.size,
              textContent: text,
              textPreview: preview,
              status: 'ready',
            });

            // 自动索引到 RAG
            await _indexAttachment(id, file.name, mimeStr, text, workspacePath, sessionId);
          }
        } catch (error) {
          console.error('[FileUpload] Failed to process file:', error);
          updatePendingAttachment(id, {
            status: 'error',
            error: error instanceof Error ? error.message : '处理失败',
          });
        }
      }
    },
    [addPendingAttachment, updatePendingAttachment]
  );

  /**
   * Handle dropped files
   */
  const handleFileDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const files = e.dataTransfer.files;
      await handleFileSelect(files);
    },
    [handleFileSelect]
  );

  /**
   * Remove a pending attachment
   */
  const handleRemoveAttachment = useCallback(
    (id: string) => {
      removePendingAttachment(id);
    },
    [removePendingAttachment]
  );

  /**
   * Clear all pending attachments
   */
  const handleClearAll = useCallback(() => {
    clearPendingAttachments();
  }, [clearPendingAttachments]);

  /**
   * Get all ready attachments for sending
   */
  const getReadyAttachments = useCallback((): PendingAttachment[] => {
    const attachments = useAttachmentStore.getState().pendingAttachments;
    return attachments.filter((a) => a.status === 'ready');
  }, []);

  // ── V1.4.1: 辅助函数 ─────────────────────────────────────────────

  /**
   * 从二进制文档（docx/xlsx/pptx）提取纯文本
   */
  async function _extractTextFromBinaryDoc(ext: string, buffer: ArrayBuffer): Promise<string> {
    try {
      if (ext === 'docx') {
        const result = await mammoth.extractRawText({ arrayBuffer: buffer });
        return result.value;
      }
      if (ext === 'xlsx' || ext === 'xls') {
        const wb = XLSX.read(new Uint8Array(buffer), { type: 'array' });
        const texts: string[] = [];
        for (const sheetName of wb.SheetNames) {
          const sheet = wb.Sheets[sheetName];
          const csv = XLSX.utils.sheet_to_csv(sheet);
          texts.push(csv);
        }
        return texts.join('\n');
      }
      if (ext === 'pptx' || ext === 'ppt') {
        // PPT 提取纯文本：先读 XML，提取所有 <a:t> 文本
        const xmlText = await mammoth.extractRawText({ arrayBuffer: buffer });
        return xmlText.value;
      }
      return '';
    } catch (err) {
      console.warn('[FileUpload] Failed to extract text from binary doc:', err);
      return '';
    }
  }

  /**
   * 自动将附件索引到 RAG 向量数据库
   */
  async function _indexAttachment(
    attachmentId: string,
    fileName: string,
    mimeType: string,
    textContent: string,
    workspacePath: string,
    sessionId: string,
  ): Promise<void> {
    try {
      const ids = await indexAttachmentChunks(
        attachmentId,
        fileName,
        mimeType,
        textContent,
        workspacePath,
        sessionId,
      );
      console.log(`[FileUpload] Indexed ${ids.length} chunks for ${fileName}`);

      // 如果该工作路径尚未注册到 RAG 面板，注册它
      const existing = getIndexedWorkspaces();
      if (!existing.some(w => w.workspacePath === workspacePath)) {
        markWorkspaceIndexed(workspacePath, ids.length, 1);
      }
    } catch (err) {
      // RAG 索引失败不影响附件使用
      console.warn('[FileUpload] Failed to index attachment to RAG:', err);
    }
  }

  return {
    handleFileSelect,
    handleFileDrop,
    handleRemoveAttachment,
    handleClearAll,
    getReadyAttachments,
    maxFiles: MAX_FILES,
  };
}
