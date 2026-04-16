import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportMarkdown, exportHtml } from '@/utils/exportReport';
import type { ComparisonResult } from '@/types/globalAgent';

// jsdom Blob 缺少 text() 方法，需要 polyfill
if (typeof Blob.prototype.text !== 'function') {
  Blob.prototype.text = function (): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(this);
    });
  };
}

const mockCreateObjectURL = vi.fn().mockReturnValue('blob:mock-url');
const mockRevokeObjectURL = vi.fn();
vi.stubGlobal('URL', { createObjectURL: mockCreateObjectURL, revokeObjectURL: mockRevokeObjectURL });

const mockResult: ComparisonResult = {
  dimensionRankings: [{
    dimension: 'fileQuantity',
    rankings: [
      { workspaceId: 'ws1', workspaceName: '前端', score: 9, rank: 1 },
      { workspaceId: 'ws2', workspaceName: '后端', score: 7, rank: 2 },
    ],
    topWinner: 'ws1',
  }],
  compositeRanking: [
    { workspaceId: 'ws1', workspaceName: '前端', totalScore: 8.5, rank: 1, strengths: [], weaknesses: [] },
    { workspaceId: 'ws2', workspaceName: '后端', totalScore: 7.0, rank: 2, strengths: [], weaknesses: [] },
  ],
  heatmapData: {
    ws1: { fileQuantity: 9 },
    ws2: { fileQuantity: 7 },
  },
  radarData: { ws1: [], ws2: [] },
  generatedAt: 1713340800000,
};

describe('exportReport', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('T10-1: exportMarkdown 生成 blob 类型为 text/markdown', () => {
    exportMarkdown(mockResult);
    const blob = mockCreateObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toMatch(/^text\/markdown/);
  });

  it('T10-2: Markdown 内容包含工作区和维度数据', async () => {
    exportMarkdown(mockResult);
    const blob = mockCreateObjectURL.mock.calls[0][0] as Blob;
    const text = await blob.text();
    expect(text).toContain('前端');
    expect(text).toContain('后端');
    expect(text).toContain('9');
  });

  it('T10-3: Markdown 包含维度排名详情', async () => {
    exportMarkdown(mockResult);
    const blob = mockCreateObjectURL.mock.calls[0][0] as Blob;
    const text = await blob.text();
    expect(text).toContain('文件数量');
    expect(text).toContain('前端');
  });

  it('T10-4: exportHtml 生成的 HTML 包含 style 属性', async () => {
    exportHtml(mockResult);
    const blob = mockCreateObjectURL.mock.calls[0][0] as Blob;
    const text = await blob.text();
    expect(text).toContain('<html');
    expect(text).toContain('style');
  });

  it('T10-5: 报告包含 generatedAt 时间', async () => {
    exportMarkdown(mockResult);
    const blob = mockCreateObjectURL.mock.calls[0][0] as Blob;
    const text = await blob.text();
    expect(text).toContain('2024');
  });
});
