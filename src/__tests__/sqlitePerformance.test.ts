/**
 * SQLite 性能测试 — FTS5 搜索 + 图遍历
 *
 * 验证性能目标：
 * - FTS5 全文搜索 < 50ms（1000 条数据）
 * - 3-hop 图遍历 < 50ms（100 个实体 + 300 条关系）
 *
 * 注意：这些测试需要 better-sqlite3 原生模块。
 * 在 jsdom 测试环境中自动跳过（describe.skip），
 * 在 Electron 主进程或 Node.js 原生环境中运行。
 *
 * 手动运行：npx vitest run src/__tests__/sqlitePerformance.test.ts --environment node
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// better-sqlite3 是原生模块，在 jsdom/浏览器环境中不可用
// 使用条件编译：尝试 require，失败则跳过所有测试
let isAvailable = false;
let BetterSqlite3: any = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  BetterSqlite3 = require('better-sqlite3');
  const testDb = new BetterSqlite3(':memory:');
  testDb.close();
  isAvailable = true;
} catch {
  isAvailable = false;
}

const describeIfAvailable = isAvailable ? describe : describe.skip;

describeIfAvailable('SQLite Performance — FTS5 搜索', () => {
  let db: any;

  beforeAll(() => {
    db = new BetterSqlite3(':memory:');
    db.pragma('journal_mode = WAL');

    // 创建 episodes 表 + FTS5
    db.exec(`
      CREATE TABLE episodes (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL DEFAULT (unixepoch()),
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        confidence REAL NOT NULL DEFAULT 1.0,
        is_deleted INTEGER NOT NULL DEFAULT 0
      );

      CREATE VIRTUAL TABLE episodes_fts USING fts5(
        content,
        content=episodes,
        content_rowid=rowid
      );

      CREATE TRIGGER episodes_ai AFTER INSERT ON episodes BEGIN
        INSERT INTO episodes_fts (rowid, content) VALUES (new.rowid, new.content);
      END;
    `);

    // 插入 1000 条测试数据
    const insert = db.prepare(
      'INSERT INTO episodes (id, workspace_id, type, content) VALUES (?, ?, ?, ?)'
    );
    const types = ['bug_fix', 'feature_impl', 'config_change', 'debug_session'];
    for (let i = 0; i < 1000; i++) {
      const type = types[i % types.length];
      const content = `Episode ${i}: 处理了 ${type} 相关的任务，修复了一个关于用户认证模块的 bug，调整了数据库查询性能优化策略`;
      insert.run(`ep-${i}`, 'ws-perf', type, content);
    }
  });

  afterAll(() => {
    db.close();
  });

  it('FTS5 搜索 1000 条数据 < 50ms', () => {
    const start = performance.now();
    const results = db.prepare(`
      SELECT e.*, rank
      FROM episodes e
      JOIN episodes_fts fts ON e.rowid = fts.rowid
      WHERE episodes_fts MATCH '认证'
      ORDER BY rank
      LIMIT 20
    `).all();
    const elapsed = performance.now() - start;

    expect(results.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(50);
    console.log(`[Perf] FTS5 search: ${elapsed.toFixed(2)}ms, ${results.length} results`);
  });

  it('FTS5 snippet 生成 < 50ms', () => {
    const start = performance.now();
    const results = db.prepare(`
      SELECT e.id, snippet(episodes_fts, 0, '<mark>', '</mark>', '...', 32) as snippet, rank
      FROM episodes e
      JOIN episodes_fts fts ON e.rowid = fts.rowid
      WHERE episodes_fts MATCH '性能优化'
      ORDER BY rank
      LIMIT 20
    `).all();
    const elapsed = performance.now() - start;

    expect(results.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(50);
    console.log(`[Perf] FTS5 snippet: ${elapsed.toFixed(2)}ms, ${results.length} results`);
  });

  it('FTS5 多关键词搜索 < 50ms', () => {
    const start = performance.now();
    const results = db.prepare(`
      SELECT e.*, rank
      FROM episodes e
      JOIN episodes_fts fts ON e.rowid = fts.rowid
      WHERE episodes_fts MATCH '用户 OR 数据库'
      ORDER BY rank
      LIMIT 20
    `).all();
    const elapsed = performance.now() - start;

    expect(results.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(50);
    console.log(`[Perf] FTS5 multi-keyword: ${elapsed.toFixed(2)}ms, ${results.length} results`);
  });
});

describeIfAvailable('SQLite Performance — 图遍历 (Recursive CTE)', () => {
  let db: any;

  beforeAll(() => {
    db = new BetterSqlite3(':memory:');
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    db.exec(`
      CREATE TABLE entities (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        name TEXT NOT NULL
      );

      CREATE TABLE relations (
        source_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
        target_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        weight REAL NOT NULL DEFAULT 1.0,
        PRIMARY KEY (source_id, target_id, type)
      );

      CREATE INDEX idx_rel_source ON relations(source_id);
      CREATE INDEX idx_rel_target ON relations(target_id);
    `);

    // 插入 100 个实体
    const insertEntity = db.prepare('INSERT INTO entities (id, type, name) VALUES (?, ?, ?)');
    for (let i = 0; i < 100; i++) {
      insertEntity.run(`ent-${i}`, i % 3 === 0 ? 'file' : i % 3 === 1 ? 'function' : 'module', `Entity_${i}`);
    }

    // 插入 ~300 条关系（网状结构，每个节点连接 ~3 个邻居）
    const insertRelation = db.prepare(
      'INSERT OR IGNORE INTO relations (source_id, target_id, type, weight) VALUES (?, ?, ?, ?)'
    );
    const relTypes = ['depends_on', 'implements', 'calls', 'imports'];
    for (let i = 0; i < 100; i++) {
      for (let j = 1; j <= 3; j++) {
        const target = (i + j) % 100;
        if (target !== i) {
          insertRelation.run(`ent-${i}`, `ent-${target}`, relTypes[j % relTypes.length], 1.0);
        }
      }
    }
  });

  afterAll(() => {
    db.close();
  });

  it('1-hop 图遍历 < 50ms', () => {
    const start = performance.now();
    const results = db.prepare(`
      WITH RECURSIVE graph_walk(id, depth, path) AS (
        SELECT ?, 0, ?
        UNION ALL
        SELECT
          CASE WHEN r.source_id = gw.id THEN r.target_id ELSE r.source_id END,
          gw.depth + 1,
          gw.path || ',' || CASE WHEN r.source_id = gw.id THEN r.target_id ELSE r.source_id END
        FROM graph_walk gw
        JOIN relations r ON (r.source_id = gw.id OR r.target_id = gw.id)
        WHERE gw.depth < 1
          AND CASE WHEN r.source_id = gw.id THEN r.target_id ELSE r.source_id END NOT IN (
            SELECT value FROM json_each('["' || replace(gw.path, ',', '","') || '"]')
          )
      )
      SELECT DISTINCT e.*, gw.depth
      FROM graph_walk gw
      JOIN entities e ON e.id = gw.id
      WHERE gw.id != ?
      ORDER BY gw.depth
    `).all('ent-0', 'ent-0', 'ent-0');
    const elapsed = performance.now() - start;

    expect(results.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(50);
    console.log(`[Perf] 1-hop traversal: ${elapsed.toFixed(2)}ms, ${results.length} entities`);
  });

  it('2-hop 图遍历 < 50ms', () => {
    const start = performance.now();
    const results = db.prepare(`
      WITH RECURSIVE graph_walk(id, depth, path) AS (
        SELECT ?, 0, ?
        UNION ALL
        SELECT
          CASE WHEN r.source_id = gw.id THEN r.target_id ELSE r.source_id END,
          gw.depth + 1,
          gw.path || ',' || CASE WHEN r.source_id = gw.id THEN r.target_id ELSE r.source_id END
        FROM graph_walk gw
        JOIN relations r ON (r.source_id = gw.id OR r.target_id = gw.id)
        WHERE gw.depth < 2
          AND CASE WHEN r.source_id = gw.id THEN r.target_id ELSE r.source_id END NOT IN (
            SELECT value FROM json_each('["' || replace(gw.path, ',', '","') || '"]')
          )
      )
      SELECT DISTINCT e.*, gw.depth
      FROM graph_walk gw
      JOIN entities e ON e.id = gw.id
      WHERE gw.id != ?
      ORDER BY gw.depth
    `).all('ent-0', 'ent-0', 'ent-0');
    const elapsed = performance.now() - start;

    expect(results.length).toBeGreaterThan(3);
    expect(elapsed).toBeLessThan(50);
    console.log(`[Perf] 2-hop traversal: ${elapsed.toFixed(2)}ms, ${results.length} entities`);
  });

  it('3-hop 图遍历 < 50ms', () => {
    const start = performance.now();
    const results = db.prepare(`
      WITH RECURSIVE graph_walk(id, depth, path) AS (
        SELECT ?, 0, ?
        UNION ALL
        SELECT
          CASE WHEN r.source_id = gw.id THEN r.target_id ELSE r.source_id END,
          gw.depth + 1,
          gw.path || ',' || CASE WHEN r.source_id = gw.id THEN r.target_id ELSE r.source_id END
        FROM graph_walk gw
        JOIN relations r ON (r.source_id = gw.id OR r.target_id = gw.id)
        WHERE gw.depth < 3
          AND CASE WHEN r.source_id = gw.id THEN r.target_id ELSE r.source_id END NOT IN (
            SELECT value FROM json_each('["' || replace(gw.path, ',', '","') || '"]')
          )
      )
      SELECT DISTINCT e.*, gw.depth
      FROM graph_walk gw
      JOIN entities e ON e.id = gw.id
      WHERE gw.id != ?
      ORDER BY gw.depth
    `).all('ent-0', 'ent-0', 'ent-0');
    const elapsed = performance.now() - start;

    expect(results.length).toBeGreaterThan(5);
    expect(elapsed).toBeLessThan(50);
    console.log(`[Perf] 3-hop traversal: ${elapsed.toFixed(2)}ms, ${results.length} entities`);
  });
});
