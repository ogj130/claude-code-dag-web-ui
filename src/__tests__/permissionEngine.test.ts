/**
 * permissionEngine 测试
 *
 * 覆盖：6 级权限模型、Token 预算、沙箱、审计日志
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  checkPermission,
  getCurrentLevel,
  setLevel,
  getLevelLabel,
  getAllLevels,
  recommendLevel,
  setTokenBudget,
  consumeTokens,
  getTokenBudget,
  resetTokenUsage,
  getAuditLogs,
  isPathAllowed,
  isCommandBlocked,
  isFileSizeAllowed,
  getSandboxConfig,
  updateSandboxConfig,
  resetPermissionEngine,
  type PermissionLevel,
} from '../services/permissionEngine';

describe('permissionEngine', () => {
  beforeEach(() => {
    resetPermissionEngine();
  });

  // ── 权限等级 ─────────────────────────────────────────────

  describe('permission levels', () => {
    it('默认等级为 L3', () => {
      expect(getCurrentLevel()).toBe(3);
    });

    it('设置权限等级', () => {
      setLevel(5);
      expect(getCurrentLevel()).toBe(5);
    });

    it('getLevelLabel 返回正确标签', () => {
      expect(getLevelLabel(1)).toBe('只读');
      expect(getLevelLabel(2)).toBe('编辑');
      expect(getLevelLabel(3)).toBe('创建删除');
      expect(getLevelLabel(4)).toBe('Shell');
      expect(getLevelLabel(5)).toBe('配置');
      expect(getLevelLabel(6)).toBe('完全访问');
    });

    it('getAllLevels 返回 6 个等级', () => {
      const levels = getAllLevels();
      expect(levels).toHaveLength(6);
      expect(levels[0].level).toBe(1);
      expect(levels[5].level).toBe(6);
    });

    it('L1 只允许 read', () => {
      setLevel(1);
      expect(checkPermission('read', 'file.ts')).toBe(true);
      expect(checkPermission('edit', 'file.ts')).toBe(false);
      expect(checkPermission('delete', 'file.ts')).toBe(false);
      expect(checkPermission('shell', 'cmd')).toBe(false);
      expect(checkPermission('admin', 'system')).toBe(false);
    });

    it('L2 允许 read + edit', () => {
      setLevel(2);
      expect(checkPermission('read', 'file.ts')).toBe(true);
      expect(checkPermission('edit', 'file.ts')).toBe(true);
      expect(checkPermission('create', 'file.ts')).toBe(false);
      expect(checkPermission('shell', 'cmd')).toBe(false);
    });

    it('L3 允许 read + edit + create + delete', () => {
      setLevel(3);
      expect(checkPermission('read', 'file.ts')).toBe(true);
      expect(checkPermission('edit', 'file.ts')).toBe(true);
      expect(checkPermission('create', 'file.ts')).toBe(true);
      expect(checkPermission('delete', 'file.ts')).toBe(true);
      expect(checkPermission('shell', 'cmd')).toBe(false);
    });

    it('L4 允许 shell', () => {
      setLevel(4);
      expect(checkPermission('shell', 'npm test')).toBe(true);
      expect(checkPermission('config', 'setting')).toBe(false);
    });

    it('L5 允许 config', () => {
      setLevel(5);
      expect(checkPermission('config', 'setting')).toBe(true);
      expect(checkPermission('admin', 'system')).toBe(false);
    });

    it('L6 允许所有操作', () => {
      setLevel(6);
      expect(checkPermission('read', 'file.ts')).toBe(true);
      expect(checkPermission('edit', 'file.ts')).toBe(true);
      expect(checkPermission('create', 'file.ts')).toBe(true);
      expect(checkPermission('delete', 'file.ts')).toBe(true);
      expect(checkPermission('shell', 'cmd')).toBe(true);
      expect(checkPermission('config', 'setting')).toBe(true);
      expect(checkPermission('admin', 'system')).toBe(true);
    });
  });

  // ── 权限推荐 ─────────────────────────────────────────────

  describe('recommendLevel', () => {
    it('expert 推荐 L6', () => {
      expect(recommendLevel({ skillLevel: 'expert' })).toBe(6);
    });

    it('advanced 推荐 L5', () => {
      expect(recommendLevel({ skillLevel: 'advanced' })).toBe(5);
    });

    it('intermediate 推荐 L4', () => {
      expect(recommendLevel({ skillLevel: 'intermediate' })).toBe(4);
    });

    it('默认推荐 L3', () => {
      expect(recommendLevel({})).toBe(3);
      expect(recommendLevel({ skillLevel: 'beginner' })).toBe(3);
    });
  });

  // ── Token 预算 ───────────────────────────────────────────

  describe('token budget', () => {
    it('默认 Token 预算为 100000', () => {
      const budget = getTokenBudget();
      expect(budget.total).toBe(100000);
      expect(budget.used).toBe(0);
      expect(budget.remaining).toBe(100000);
      expect(budget.isWarning).toBe(false);
      expect(budget.isPaused).toBe(false);
    });

    it('consumeTokens 正确消耗', () => {
      consumeTokens(50000);
      const budget = getTokenBudget();
      expect(budget.used).toBe(50000);
      expect(budget.remaining).toBe(50000);
      expect(budget.usagePercent).toBeCloseTo(0.5);
    });

    it('80% 触发 warning', () => {
      consumeTokens(80000);
      const budget = getTokenBudget();
      expect(budget.isWarning).toBe(true);
      expect(budget.isPaused).toBe(false);
    });

    it('100% 触发 paused', () => {
      consumeTokens(100000);
      const budget = getTokenBudget();
      expect(budget.isWarning).toBe(true);
      expect(budget.isPaused).toBe(true);
    });

    it('超过 100% 仍然 paused', () => {
      consumeTokens(120000);
      const budget = getTokenBudget();
      expect(budget.isPaused).toBe(true);
      expect(budget.remaining).toBe(0);
    });

    it('setTokenBudget 调整总额', () => {
      consumeTokens(50000);
      setTokenBudget(200000);
      const budget = getTokenBudget();
      expect(budget.total).toBe(200000);
      expect(budget.remaining).toBe(150000);
      expect(budget.usagePercent).toBeCloseTo(0.25);
      expect(budget.isWarning).toBe(false);
    });

    it('resetTokenUsage 清零消耗', () => {
      consumeTokens(90000);
      resetTokenUsage();
      const budget = getTokenBudget();
      expect(budget.used).toBe(0);
      expect(budget.remaining).toBe(100000);
      expect(budget.isWarning).toBe(false);
      expect(budget.isPaused).toBe(false);
    });
  });

  // ── 沙箱 ─────────────────────────────────────────────────

  describe('sandbox', () => {
    it('允许的路径', () => {
      expect(isPathAllowed('/tmp/sandbox/test.ts')).toBe(true);
      expect(isPathAllowed('/workspace/output/result.txt')).toBe(true);
    });

    it('非允许路径被拒绝', () => {
      expect(isPathAllowed('/etc/passwd')).toBe(false);
      expect(isPathAllowed('/home/user/secret.ts')).toBe(false);
    });

    it('阻止危险命令', () => {
      expect(isCommandBlocked('rm -rf /')).toBe(true);
      expect(isCommandBlocked('format C:')).toBe(true);
      expect(isCommandBlocked('mkfs.ext4 /dev/sda')).toBe(true);
      expect(isCommandBlocked('dd if=/dev/zero of=/dev/sda')).toBe(true);
    });

    it('安全命令不被阻止', () => {
      expect(isCommandBlocked('npm test')).toBe(false);
      expect(isCommandBlocked('git status')).toBe(false);
      expect(isCommandBlocked('ls -la')).toBe(false);
    });

    it('文件大小限制', () => {
      expect(isFileSizeAllowed(5 * 1024 * 1024)).toBe(true); // 5MB
      expect(isFileSizeAllowed(10 * 1024 * 1024)).toBe(true); // 10MB 恰好
      expect(isFileSizeAllowed(11 * 1024 * 1024)).toBe(false); // 11MB 超过
    });

    it('getSandboxConfig 返回配置', () => {
      const config = getSandboxConfig();
      expect(config.allowedPaths).toContain('/tmp/sandbox');
      expect(config.blockedCommands).toContain('rm -rf /');
      expect(config.maxFileSize).toBe(10 * 1024 * 1024);
    });

    it('updateSandboxConfig 更新配置', () => {
      updateSandboxConfig({ maxFileSize: 50 * 1024 * 1024 });
      expect(getSandboxConfig().maxFileSize).toBe(50 * 1024 * 1024);
    });
  });

  // ── 审计日志 ─────────────────────────────────────────────

  describe('audit logs', () => {
    it('checkPermission 自动记录日志', () => {
      setLevel(3);
      checkPermission('read', 'file.ts');
      checkPermission('shell', 'cmd');

      const logs = getAuditLogs();
      expect(logs).toHaveLength(2);

      // 验证两条日志都存在（排序同时间戳可能不稳定，不做顺序断言）
      const actions = logs.map((l) => l.action);
      expect(actions).toContain('read');
      expect(actions).toContain('shell');

      const readLog = logs.find((l) => l.action === 'read')!;
      const shellLog = logs.find((l) => l.action === 'shell')!;
      expect(readLog.result).toBe('allowed');
      expect(shellLog.result).toBe('denied');
    });

    it('按 action 过滤', () => {
      setLevel(3);
      checkPermission('read', 'a.ts');
      checkPermission('edit', 'b.ts');
      checkPermission('read', 'c.ts');

      const readLogs = getAuditLogs({ action: 'read' });
      expect(readLogs).toHaveLength(2);
    });

    it('按 result 过滤', () => {
      setLevel(1);
      checkPermission('read', 'a.ts');
      checkPermission('edit', 'b.ts');

      const denied = getAuditLogs({ result: 'denied' });
      expect(denied).toHaveLength(1);
      expect(denied[0].action).toBe('edit');
    });

    it('limit 限制返回数量', () => {
      setLevel(3);
      for (let i = 0; i < 10; i++) {
        checkPermission('read', `file${i}.ts`);
      }

      const logs = getAuditLogs({ limit: 5 });
      expect(logs).toHaveLength(5);
    });

    it('审计日志不超过 1000 条', () => {
      setLevel(6);
      for (let i = 0; i < 1100; i++) {
        checkPermission('read', `file${i}.ts`);
      }

      const allLogs = getAuditLogs({ limit: 2000 });
      expect(allLogs.length).toBeLessThanOrEqual(1000);
    });
  });
});
