import type { EventToolCall } from '@/types/events';
import type { FileChangeRecord } from '@/types/fileChange';
import type {
  WorkspaceFileData,
  FileEntry,
  FileStats,
} from '@/types/globalAgent';

// ── 扩展名 → 文件类型映射 ───────────────────────────────────────────────────
const EXTENSION_TYPES: Record<string, 'code' | 'doc' | 'config'> = {
  // Code
  '.ts': 'code', '.tsx': 'code', '.js': 'code', '.jsx': 'code',
  '.py': 'code', '.java': 'code', '.go': 'code', '.rs': 'code',
  '.cpp': 'code', '.c': 'code', '.rb': 'code', '.php': 'code',
  // Doc
  '.md': 'doc', '.txt': 'doc', '.rst': 'doc', '.adoc': 'doc',
  // Config
  '.json': 'config', '.yaml': 'config', '.yml': 'config',
  '.toml': 'config', '.ini': 'config', '.cfg': 'config',
};

function classifyFile(ext: string): 'code' | 'doc' | 'config' {
  return EXTENSION_TYPES[ext.toLowerCase()] ?? 'code';
}

function getExtension(filePath: string): string {
  const lastDot = filePath.lastIndexOf('.');
  return lastDot >= 0 ? filePath.slice(lastDot) : '';
}

function getFileName(filePath: string): string {
  const lastSlash = filePath.lastIndexOf('/');
  return lastSlash >= 0 ? filePath.slice(lastSlash + 1) : filePath;
}

export function analyzeWorkspaceFileData(
  workspaceId: string,
  workspaceName: string,
  toolCalls: EventToolCall[],
  fileChanges: FileChangeRecord[],
  summary: string,
): WorkspaceFileData {
  // 从 ToolCall 提取新增文件（Write 操作）
  const createdFiles: FileEntry[] = [];
  for (const call of toolCalls) {
    if (call.tool === 'Write' && call.input?.file_path) {
      const path = call.input.file_path as string;
      const ext = getExtension(path);
      createdFiles.push({ path, name: getFileName(path), extension: ext });
    }
  }

  // 从 fileChangeStorage 获取修改文件
  const modifiedFiles: FileEntry[] = fileChanges.map(fc => ({
    path: fc.filePath,
    name: getFileName(fc.filePath),
    extension: getExtension(fc.filePath),
  }));

  // 分类统计
  const allFiles = [...createdFiles, ...modifiedFiles];
  let codeFiles = 0, docFiles = 0, configFiles = 0;
  for (const f of allFiles) {
    const type = classifyFile(f.extension);
    if (type === 'code') codeFiles++;
    else if (type === 'doc') docFiles++;
    else if (type === 'config') configFiles++;
  }

  const stats: FileStats = {
    totalCreatedFiles: createdFiles.length,
    totalModifiedFiles: modifiedFiles.length,
    codeFiles,
    docFiles,
    configFiles,
    totalLines: 0,
    modifiedLines: 0,
    avgFileSize: 0,
  };

  return { workspaceId, workspaceName, createdFiles, modifiedFiles, summary, stats };
}
