import { describe, expect, it } from 'vitest';
import { parsePromptInput } from '@/utils/promptParser';

describe('parsePromptInput', () => {
  it('将单条 query 解析为 single 模式', () => {
    expect(parsePromptInput('实现一个 LRU 缓存类')).toEqual({
      mode: 'single',
      prompts: [{ prompt: '实现一个 LRU 缓存类' }],
    });
  });

  it('将多行文本解析为 list 模式并忽略空行', () => {
    expect(parsePromptInput('问题1\n\n问题2\n  \n问题3')).toEqual({
      mode: 'list',
      prompts: [
        { prompt: '问题1' },
        { prompt: '问题2' },
        { prompt: '问题3' },
      ],
    });
  });

  it('对全空输入抛出明确错误', () => {
    expect(() => parsePromptInput('  \n \n')).toThrowError('Prompt input is empty');
  });
});
