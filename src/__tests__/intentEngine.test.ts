/**
 * IntentEngine 单元测试
 *
 * 覆盖关键词降级解析的 10+ 场景，
 * 验证意图类型识别、置信度计算、实体提取。
 */

import { describe, it, expect } from 'vitest';
import { parseIntent } from '@/services/intentEngine';

// 不传 LLM config，走关键词降级路径
const fallbackParse = (input: string) => parseIntent(input);

describe('IntentEngine — 关键词降级解析', () => {
  // ── 意图类型识别 ─────────────────────────────────────────

  it('识别 create 意图 — 中文关键词', async () => {
    const result = await fallbackParse('帮我创建一个用户管理模块');
    expect(result.type).toBe('create');
    expect(result.confidence).toBeGreaterThan(0.3);
  });

  it('识别 create 意图 — 英文关键词', async () => {
    const result = await fallbackParse('build a new React component');
    expect(result.type).toBe('create');
  });

  it('识别 fix 意图 — 中文关键词', async () => {
    const result = await fallbackParse('修复登录页面的 bug');
    expect(result.type).toBe('fix');
  });

  it('识别 fix 意图 — 英文关键词', async () => {
    const result = await fallbackParse('debug the authentication error');
    expect(result.type).toBe('fix');
  });

  it('识别 refactor 意图 — 中文关键词', async () => {
    const result = await fallbackParse('重构这个组件的代码结构');
    expect(result.type).toBe('refactor');
  });

  it('识别 refactor 意图 — 英文关键词', async () => {
    const result = await fallbackParse('optimize the database query performance');
    expect(result.type).toBe('refactor');
  });

  it('识别 deploy 意图 — 中文关键词', async () => {
    const result = await fallbackParse('部署这个服务到生产环境');
    expect(result.type).toBe('deploy');
  });

  it('识别 deploy 意图 — 英文关键词', async () => {
    const result = await fallbackParse('release the latest version');
    expect(result.type).toBe('deploy');
  });

  it('识别 query 意图 — 中文关键词', async () => {
    const result = await fallbackParse('搜索一下项目的依赖关系');
    expect(result.type).toBe('query');
  });

  it('识别 query 意图 — 英文关键词', async () => {
    const result = await fallbackParse('find all unused imports');
    expect(result.type).toBe('query');
  });

  // ── 默认行为 ─────────────────────────────────────────────

  it('无匹配关键词时默认为 query', async () => {
    const result = await fallbackParse('今天天气怎么样');
    expect(result.type).toBe('query');
    expect(result.confidence).toBeGreaterThanOrEqual(0.3);
    expect(result.confidence).toBeLessThanOrEqual(0.8);
  });

  // ── 置信度计算 ───────────────────────────────────────────

  it('多个关键词匹配时置信度更高', async () => {
    const single = await fallbackParse('创建一个文件');
    const multi = await fallbackParse('新建一个创建一个新的文件');
    expect(multi.confidence).toBeGreaterThanOrEqual(single.confidence);
  });

  it('置信度上限为 0.8', async () => {
    const result = await fallbackParse('创建新建搭建开发做一个create build new make');
    expect(result.confidence).toBeLessThanOrEqual(0.8);
  });

  // ── 实体提取 ─────────────────────────────────────────────

  it('提取文件名实体 — TypeScript', async () => {
    const result = await fallbackParse('修复 App.tsx 中的渲染问题');
    expect(result.entities.file).toBe('App.tsx');
  });

  it('提取文件名实体 — Python', async () => {
    const result = await fallbackParse('优化 utils.py 的性能');
    expect(result.entities.file).toBe('utils.py');
  });

  it('提取文件名实体 — Go', async () => {
    const result = await fallbackParse('检查 main.go 的错误处理');
    expect(result.entities.file).toBe('main.go');
  });

  it('无文件名时 entities 为空对象', async () => {
    const result = await fallbackParse('创建一个新功能');
    expect(result.entities).toEqual({});
  });

  // ── 混合语言 ─────────────────────────────────────────────

  it('中英混合输入正确识别', async () => {
    const result = await fallbackParse('fix 这个组件的 bug');
    expect(result.type).toBe('fix');
  });

  // ── source 字段 ──────────────────────────────────────────

  it('返回原始输入作为 source', async () => {
    const input = '创建一个新的 React 组件';
    const result = await fallbackParse(input);
    expect(result.source).toBe(input);
  });
});
