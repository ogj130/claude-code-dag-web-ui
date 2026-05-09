import { describe, it, expect } from 'vitest';
import { RecoveryEngine } from '../services/multi-agent/ceo-agent/RecoveryEngine';

describe('RecoveryEngine', () => {
  const engine = new RecoveryEngine();

  describe('diagnose', () => {
    it('诊断 timeout 错误', () => {
      expect(engine.diagnose('ETIMEDOUT: connection timeout', 'execution')).toBe('timeout');
      expect(engine.diagnose('timeout after 30000ms', 'context')).toBe('timeout');
    });

    it('诊断 permission 错误', () => {
      expect(engine.diagnose('EACCES: permission denied', 'execution')).toBe('permission');
      expect(engine.diagnose('Permission denied: cannot write', 'planning')).toBe('permission');
    });

    it('诊断 syntax_error', () => {
      expect(engine.diagnose('SyntaxError: Unexpected token', 'execution')).toBe('syntax_error');
      expect(engine.diagnose('TypeError: undefined is not a function', 'execution')).toBe('syntax_error');
    });

    it('诊断 tool_error', () => {
      expect(engine.diagnose('command not found: git', 'execution')).toBe('tool_error');
      expect(engine.diagnose('tool execution failed', 'execution')).toBe('tool_error');
    });

    it('未知错误返回 unknown', () => {
      expect(engine.diagnose('something weird happened', 'execution')).toBe('unknown');
    });
  });

  describe('recover', () => {
    it('timeout → split 为子任务', () => {
      const action = engine.recover('timeout', {
        id: 'g1', description: '复杂任务', verified: false, verificationCriteria: [],
      }, { agents: [], strategy: 'parallel', estimatedDuration: 0 });
      expect(action.type).toBe('split');
    });

    it('permission → 换 ReviewAgent 重试', () => {
      const action = engine.recover('permission', {
        id: 'g1', description: '写文件', verified: false, verificationCriteria: [],
      }, { agents: [], strategy: 'parallel', estimatedDuration: 0 });
      expect(action.type).toBe('retry');
      if (action.type === 'retry') {
        expect(action.newAgentType).toBe('review');
      }
    });

    it('unknown → 标记 fail', () => {
      const action = engine.recover('unknown', {
        id: 'g1', description: '坏掉了', verified: false, verificationCriteria: [],
      }, { agents: [], strategy: 'parallel', estimatedDuration: 0 });
      expect(action.type).toBe('fail');
    });
  });
});
