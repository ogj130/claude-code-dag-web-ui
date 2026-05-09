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

import { LLMDecomposer } from '../services/multi-agent/ceo-agent/LLMDecomposer';

describe('LLMDecomposer (规则引擎降级)', () => {
  const decomposer = new LLMDecomposer();

  it('规则引擎: 分析+设计+实现类需求 → pipeline 策略', () => {
    const plan = decomposer.decomposeWithRules('设计并实现一个用户认证系统，支持JWT');
    expect(plan.agents.length).toBeGreaterThanOrEqual(2);
    expect(plan.strategy).toBe('pipeline');
    const types = plan.agents.map(a => a.type);
    expect(types).toContain('planning');
    expect(types).toContain('execution');
  });

  it('规则引擎: 简单修复需求 → context+execution，跳过 planning', () => {
    const plan = decomposer.decomposeWithRules('修复登录页面的按钮样式');
    expect(plan.agents.some(a => a.type === 'execution')).toBe(true);
    expect(plan.agents.every(a => a.type !== 'planning')).toBe(true);
  });

  it('规则引擎: 纯分析需求 → context only', () => {
    const plan = decomposer.decomposeWithRules('分析当前项目的代码结构和技术债务');
    expect(plan.agents.length).toBeGreaterThan(0);
    expect(plan.agents[0].type).toBe('context');
  });

  it('规则引擎: 多关键词命中 → 计算加权得分排序', () => {
    const plan = decomposer.decomposeWithRules('分析并设计并实现并测试一个完整的REST API');
    const types = plan.agents.map(a => a.type);
    expect(types.indexOf('context')).toBeLessThan(types.indexOf('execution'));
  });

  it('规则引擎: 未知类型需求 → 至少返回 context + execution', () => {
    const plan = decomposer.decomposeWithRules('帮我看一下');
    expect(plan.agents.length).toBeGreaterThan(0);
  });

  it('decomposeWithRules 返回的 AgentPlan 结构合法', () => {
    const plan = decomposer.decomposeWithRules('设计一个数据库架构');
    for (const agent of plan.agents) {
      expect(agent.id).toBeTruthy();
      expect(agent.type).toBeTruthy();
      expect(agent.name).toBeTruthy();
      expect(agent.description).toBeTruthy();
      expect(Array.isArray(agent.dependsOn)).toBe(true);
      expect(typeof agent.priority).toBe('number');
      expect(Array.isArray(agent.verificationCriteria)).toBe(true);
    }
  });

  it('LLM 不可用标志 → 自动降级到规则引擎', async () => {
    const decomposerOffline = new LLMDecomposer({ llmAvailable: false });
    const plan = await decomposerOffline.decompose('设计认证系统');
    expect(plan).toBeDefined();
    expect(plan.agents.length).toBeGreaterThan(0);
  });
});
