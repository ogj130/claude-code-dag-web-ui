/**
 * voiceCommandMapper 测试
 *
 * 覆盖：中英文命令识别、置信度、参数提取、空输入
 */

import { describe, it, expect } from 'vitest';
import {
  mapVoiceCommand,
  hasVoiceCommand,
  getAvailableCommands,
  type VoiceAction,
} from '../services/voiceCommandMapper';

describe('voiceCommandMapper', () => {
  // ── 基础功能 ─────────────────────────────────────────────

  describe('mapVoiceCommand', () => {
    it('空字符串返回 unknown', () => {
      const cmd = mapVoiceCommand('');
      expect(cmd.action).toBe('unknown');
      expect(cmd.confidence).toBe(0);
    });

    it('纯空白返回 unknown', () => {
      const cmd = mapVoiceCommand('   ');
      expect(cmd.action).toBe('unknown');
    });

    it('无法识别的文本返回 unknown', () => {
      const cmd = mapVoiceCommand('今天天气不错');
      expect(cmd.action).toBe('unknown');
    });
  });

  // ── 中文命令 ─────────────────────────────────────────────

  describe('中文命令识别', () => {
    const cases: Array<[string, VoiceAction, number]> = [
      ['修复这个bug', 'fix_bug', 0.9],
      ['修复这个错误', 'fix_bug', 0.9],
      ['修一下', 'fix_bug', 0.9],
      ['切换模型', 'switch_model', 0.95],
      ['换个模型', 'switch_model', 0.95],
      ['重构', 'refactor', 0.85],
      ['优化一下代码', 'refactor', 0.85],
      ['运行测试', 'run_tests', 0.9],
      ['跑一下测试', 'run_tests', 0.9],
      ['提交代码', 'commit_code', 0.9],
      ['解释一下这段代码', 'explain_code', 0.85],
      ['创建一个新文件', 'create_file', 0.9],
      ['删除这个文件', 'delete_file', 0.9],
      ['搜索', 'search', 0.8],
      ['撤销', 'undo', 0.95],
      ['重做', 'redo', 0.95],
      ['格式化代码', 'format_code', 0.9],
      ['打开终端', 'open_terminal', 0.9],
      ['切换侧边栏', 'toggle_sidebar', 0.9],
    ];

    cases.forEach(([input, expectedAction, minConfidence]) => {
      it(`"${input}" → ${expectedAction}`, () => {
        const cmd = mapVoiceCommand(input);
        expect(cmd.action).toBe(expectedAction);
        expect(cmd.confidence).toBeGreaterThanOrEqual(minConfidence);
      });
    });
  });

  // ── 英文命令 ─────────────────────────────────────────────

  describe('英文命令识别', () => {
    const cases: Array<[string, VoiceAction]> = [
      ['fix the bug', 'fix_bug'],
      ['fix bug', 'fix_bug'],
      ['debug this', 'fix_bug'],
      ['switch model', 'switch_model'],
      ['refactor this', 'refactor'],
      ['clean up', 'refactor'],
      ['run tests', 'run_tests'],
      ['run the test', 'run_tests'],
      ['commit code', 'commit_code'],
      ['commit', 'commit_code'],
      ['explain this', 'explain_code'],
      ['create a new file', 'create_file'],
      ['delete the file', 'delete_file'],
      ['undo', 'undo'],
      ['redo', 'redo'],
      ['format code', 'format_code'],
      ['open the terminal', 'open_terminal'],
      ['toggle sidebar', 'toggle_sidebar'],
    ];

    cases.forEach(([input, expectedAction]) => {
      it(`"${input}" → ${expectedAction}`, () => {
        const cmd = mapVoiceCommand(input);
        expect(cmd.action).toBe(expectedAction);
      });
    });
  });

  // ── 参数提取 ─────────────────────────────────────────────

  describe('参数提取', () => {
    it('create file 可提取文件名', () => {
      const cmd = mapVoiceCommand('create a new file utils.ts');
      expect(cmd.action).toBe('create_file');
      expect(cmd.params).toContain('utils.ts');
    });

    it('search 可提取搜索词', () => {
      const cmd = mapVoiceCommand('search for useState hook');
      expect(cmd.action).toBe('search');
      expect(cmd.params).toContain('useState');
    });
  });

  // ── 辅助函数 ─────────────────────────────────────────────

  describe('hasVoiceCommand', () => {
    it('有命令时返回 true', () => {
      expect(hasVoiceCommand('fix bug')).toBe(true);
      expect(hasVoiceCommand('修复这个错误')).toBe(true);
    });

    it('无命令时返回 false', () => {
      expect(hasVoiceCommand('你好世界')).toBe(false);
      expect(hasVoiceCommand('')).toBe(false);
    });
  });

  describe('getAvailableCommands', () => {
    it('返回非空列表', () => {
      const cmds = getAvailableCommands();
      expect(cmds.length).toBeGreaterThan(10);
    });

    it('每个命令都有 action 和 examples', () => {
      const cmds = getAvailableCommands();
      for (const cmd of cmds) {
        expect(cmd.action).toBeTruthy();
        expect(cmd.examples.length).toBeGreaterThan(0);
      }
    });
  });
});
