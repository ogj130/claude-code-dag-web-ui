/**
 * mcpConfigStore 测试
 *
 * 覆盖：CRUD、连接状态、工具发现
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  addServer,
  getServer,
  listServers,
  updateServer,
  removeServer,
  updateStatus,
  testConnection,
  discoverTools,
  getAllTools,
  resetMCPConfigStore,
} from '../services/mcpConfigStore';

describe('mcpConfigStore', () => {
  beforeEach(() => {
    resetMCPConfigStore();
  });

  // ── CRUD ─────────────────────────────────────────────────

  describe('CRUD', () => {
    it('添加服务器', () => {
      const state = addServer({ name: 'Test MCP', command: 'npx test' });
      expect(state.config.id).toBeTruthy();
      expect(state.config.name).toBe('Test MCP');
      expect(state.status).toBe('disconnected');
    });

    it('获取服务器', () => {
      const state = addServer({ name: 'A', command: 'cmd' });
      expect(getServer(state.config.id)).not.toBeNull();
    });

    it('列出服务器', () => {
      addServer({ name: 'A', command: 'cmd1' });
      addServer({ name: 'B', command: 'cmd2' });
      expect(listServers()).toHaveLength(2);
    });

    it('更新服务器', () => {
      const state = addServer({ name: 'Old', command: 'cmd' });
      const updated = updateServer(state.config.id, { name: 'New' });
      expect(updated!.config.name).toBe('New');
    });

    it('删除服务器', () => {
      const state = addServer({ name: 'D', command: 'cmd' });
      expect(removeServer(state.config.id)).toBe(true);
      expect(getServer(state.config.id)).toBeNull();
    });
  });

  // ── 连接状态 ─────────────────────────────────────────────

  describe('连接状态', () => {
    it('更新状态', () => {
      const state = addServer({ name: 'S', command: 'cmd' });
      updateStatus(state.config.id, 'connected');

      const updated = getServer(state.config.id);
      expect(updated!.status).toBe('connected');
      expect(updated!.lastConnectedAt).toBeDefined();
    });

    it('错误状态记录错误信息', () => {
      const state = addServer({ name: 'S', command: 'cmd' });
      updateStatus(state.config.id, 'error', 'Connection refused');

      const updated = getServer(state.config.id);
      expect(updated!.lastError).toBe('Connection refused');
    });

    it('testConnection 更新状态', async () => {
      const state = addServer({ name: 'S', command: 'cmd' });
      const result = await testConnection(state.config.id);

      // testConnection 会更新状态
      const updated = getServer(state.config.id);
      expect(['connected', 'error']).toContain(updated!.status);
    });
  });

  // ── 工具发现 ─────────────────────────────────────────────

  describe('工具发现', () => {
    it('已连接服务器可发现工具', async () => {
      const state = addServer({ name: 'MCP', command: 'cmd' });
      updateStatus(state.config.id, 'connected');

      const tools = await discoverTools(state.config.id);
      expect(tools.length).toBeGreaterThan(0);
      expect(tools[0].serverId).toBe(state.config.id);
    });

    it('未连接服务器返回空工具', async () => {
      const state = addServer({ name: 'MCP', command: 'cmd' });
      const tools = await discoverTools(state.config.id);
      expect(tools).toHaveLength(0);
    });

    it('getAllTools 聚合所有工具', async () => {
      const s1 = addServer({ name: 'A', command: 'cmd' });
      const s2 = addServer({ name: 'B', command: 'cmd' });
      updateStatus(s1.config.id, 'connected');
      updateStatus(s2.config.id, 'connected');

      await discoverTools(s1.config.id);
      await discoverTools(s2.config.id);

      const all = getAllTools();
      expect(all.length).toBeGreaterThan(0);
    });
  });
});
