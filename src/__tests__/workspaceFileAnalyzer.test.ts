import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { EventToolCall } from '@/types/events';
import type { FileChangeRecord } from '@/types/fileChange';
import { analyzeWorkspaceFileData } from '@/services/workspaceFileAnalyzer';

describe('WorkspaceFileAnalyzer', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('T1-1: 从 ToolCall 提取新增文件（Write 操作），过滤非文件操作', () => {
    const toolCalls: EventToolCall[] = [
      { id: '1', tool: 'Write', input: { file_path: '/src/a.ts', content: 'xxx' } },
      { id: '2', tool: 'Read', input: { file_path: '/src/b.ts' } },
      { id: '3', tool: 'Bash', input: { command: 'ls' } },
      { id: '4', tool: 'Write', input: { file_path: '/src/c.tsx' } },
    ] as any;

    const result = analyzeWorkspaceFileData('ws1', 'ws1', toolCalls, [], '');

    expect(result.createdFiles.map(f => f.path)).toEqual(['/src/a.ts', '/src/c.tsx']);
    expect(result.createdFiles).toHaveLength(2);
  });

  it('T1-2: 按扩展名正确分类 codeFiles/docFiles/configFiles', () => {
    const toolCalls: EventToolCall[] = [
      { id: '1', tool: 'Write', input: { file_path: '/src/a.ts' } },
      { id: '2', tool: 'Write', input: { file_path: '/src/b.tsx' } },
      { id: '3', tool: 'Write', input: { file_path: '/docs/guide.md' } },
      { id: '4', tool: 'Write', input: { file_path: '/config/app.json' } },
      { id: '5', tool: 'Write', input: { file_path: '/config/db.yaml' } },
    ] as any;

    const result = analyzeWorkspaceFileData('ws1', 'ws1', toolCalls, [], '');

    expect(result.stats.codeFiles).toBe(2);
    expect(result.stats.docFiles).toBe(1);
    expect(result.stats.configFiles).toBe(2);
  });

  it('T1-3: 合并已修改文件，与新增文件不重叠', () => {
    const toolCalls: EventToolCall[] = [
      { id: '1', tool: 'Write', input: { file_path: '/src/new.ts' } },
    ] as any;
    const fileChanges: FileChangeRecord[] = [
      { id: 'fc1', workspaceId: 'ws1', sessionId: 's1', queryId: 'q1',
        filePath: '/src/existing.ts', changeType: 'modify', timestamp: Date.now() },
      { id: 'fc2', workspaceId: 'ws1', sessionId: 's1', queryId: 'q1',
        filePath: '/src/existing2.ts', changeType: 'modify', timestamp: Date.now() },
    ] as any;

    const result = analyzeWorkspaceFileData('ws1', 'ws1', toolCalls, fileChanges, '');

    expect(result.createdFiles).toHaveLength(1);
    expect(result.modifiedFiles).toHaveLength(2);
    expect(result.createdFiles[0].path).toBe('/src/new.ts');
    expect(result.modifiedFiles.map(f => f.path)).toContain('/src/existing.ts');
  });

  it('T1-4: 正确拼接 AI 总结文本', () => {
    const summaryChunks = ['完成了用户认证模块', '修复了登录漏洞'];
    const result = analyzeWorkspaceFileData('ws1', 'ws1', [], [], summaryChunks.join('\n'));
    expect(result.summary).toBe('完成了用户认证模块\n修复了登录漏洞');
  });

  it('T1-5: 空数据返回零值，不抛错', () => {
    const result = analyzeWorkspaceFileData('ws1', 'ws1', [], [], '');
    expect(result.createdFiles).toHaveLength(0);
    expect(result.modifiedFiles).toHaveLength(0);
    expect(result.stats.totalCreatedFiles).toBe(0);
    expect(result.stats.totalModifiedFiles).toBe(0);
    expect(result.stats.codeFiles).toBe(0);
    expect(result.stats.docFiles).toBe(0);
    expect(result.stats.configFiles).toBe(0);
    expect(result.stats.totalLines).toBe(0);
    expect(result.stats.modifiedLines).toBe(0);
  });

  it('T1-6: 两个工作区数据独立，互不污染', () => {
    const calls1: EventToolCall[] = [{ id: '1', tool: 'Write', input: { file_path: '/ws1/a.ts' } }] as any;
    const calls2: EventToolCall[] = [{ id: '2', tool: 'Write', input: { file_path: '/ws2/b.ts' } }] as any;
    const r1 = analyzeWorkspaceFileData('ws1', 'ws1', calls1, [], '');
    const r2 = analyzeWorkspaceFileData('ws2', 'ws2', calls2, [], '');
    expect(r1.createdFiles.map(f => f.path)).toEqual(['/ws1/a.ts']);
    expect(r2.createdFiles.map(f => f.path)).toEqual(['/ws2/b.ts']);
  });

  it('T1-7: 扩展名大小写不敏感，正确归类', () => {
    const toolCalls: EventToolCall[] = [
      { id: '1', tool: 'Write', input: { file_path: '/src/A.TS' } },
      { id: '2', tool: 'Write', input: { file_path: '/src/B.TSX' } },
      { id: '3', tool: 'Write', input: { file_path: '/src/C.MD' } },
    ] as any;
    const result = analyzeWorkspaceFileData('ws1', 'ws1', toolCalls, [], '');
    expect(result.stats.codeFiles).toBe(2);
    expect(result.stats.docFiles).toBe(1);
  });
});
