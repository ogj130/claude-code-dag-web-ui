/**
 * SQLite IPC Handlers
 *
 * 注册所有 SQLite 相关的 IPC handler，复用 LanceDB 的 IPC 模式。
 * 渲染进程通过 window.electron.invoke('sqlite:*', params) 调用。
 */

import { ipcMain } from 'electron';
import {
  getDatabase,
  initAllSchemas,
  closeAllDatabases,
  isSQLiteAvailable,
  DB_NAMES,
  type DatabaseName,
} from '../sqlite/SQLiteManager.js';

/**
 * 生成 UUID（使用 crypto.randomUUID）
 */
function generateId(): string {
  return crypto.randomUUID();
}

/**
 * 注册所有 SQLite IPC handlers
 */
export function registerSQLiteHandlers(): void {
  // ── 可用性检查 ──────────────────────────────────────────
  ipcMain.handle('sqlite:isAvailable', () => {
    return isSQLiteAvailable();
  });

  // ── 初始化 ──────────────────────────────────────────────
  ipcMain.handle('sqlite:init', () => {
    try {
      initAllSchemas();
      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  // ── 关闭 ────────────────────────────────────────────────
  ipcMain.handle('sqlite:close', () => {
    try {
      closeAllDatabases();
      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  // ── 情景记忆 CRUD ──────────────────────────────────────
  ipcMain.handle('sqlite:episodes:list', (_event, params: {
    workspaceId: string;
    limit?: number;
    offset?: number;
    type?: string;
  }) => {
    const db = getDatabase(DB_NAMES.MEMORY);
    const { workspaceId, limit = 50, offset = 0, type } = params;

    let query = 'SELECT * FROM episodes WHERE workspace_id = ? AND is_deleted = 0';
    const args: unknown[] = [workspaceId];

    if (type) {
      query += ' AND type = ?';
      args.push(type);
    }

    query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
    args.push(limit, offset);

    return db.prepare(query).all(...args);
  });

  ipcMain.handle('sqlite:episodes:create', (_event, params: {
    workspaceId: string;
    type: string;
    content: string;
    tags?: string[];
    emotionTag?: string;
  }) => {
    const db = getDatabase(DB_NAMES.MEMORY);
    const id = generateId();
    const { workspaceId, type, content, tags = [], emotionTag } = params;

    db.prepare(`
      INSERT INTO episodes (id, workspace_id, type, content, emotion_tag)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, workspaceId, type, content, emotionTag ?? null);

    // 插入标签
    const tagStmt = db.prepare('INSERT INTO episode_tags (episode_id, tag) VALUES (?, ?)');
    for (const tag of tags) {
      tagStmt.run(id, tag);
    }

    // 更新 FTS5 索引
    const row = db.prepare('SELECT rowid FROM episodes WHERE id = ?').get(id) as { rowid: number } | undefined;
    if (row) {
      db.prepare('INSERT INTO episodes_fts (rowid, content) VALUES (?, ?)').run(row.rowid, content);
    }

    return { id, success: true };
  });

  ipcMain.handle('sqlite:episodes:search', (_event, params: {
    query: string;
    workspaceId?: string;
    limit?: number;
  }) => {
    const db = getDatabase(DB_NAMES.MEMORY);
    const { query, workspaceId, limit = 20 } = params;

    let sql = `
      SELECT e.*, snippet(episodes_fts, 0, '<mark>', '</mark>', '...', 32) as snippet,
             rank
      FROM episodes e
      JOIN episodes_fts fts ON e.rowid = fts.rowid
      WHERE episodes_fts MATCH ?
    `;
    const args: unknown[] = [query];

    if (workspaceId) {
      sql += ' AND e.workspace_id = ?';
      args.push(workspaceId);
    }

    sql += ' AND e.is_deleted = 0 ORDER BY rank LIMIT ?';
    args.push(limit);

    return db.prepare(sql).all(...args);
  });

  ipcMain.handle('sqlite:episodes:softDelete', (_event, params: { id: string }) => {
    const db = getDatabase(DB_NAMES.MEMORY);
    db.prepare(`
      UPDATE episodes SET is_deleted = 1, deleted_at = unixepoch(), updated_at = unixepoch()
      WHERE id = ?
    `).run(params.id);
    return { success: true };
  });

  // ── 语义记忆 CRUD ──────────────────────────────────────
  ipcMain.handle('sqlite:patterns:list', (_event, params: {
    domain?: string;
    limit?: number;
  }) => {
    const db = getDatabase(DB_NAMES.MEMORY);
    const { domain, limit = 50 } = params;

    if (domain) {
      return db.prepare('SELECT * FROM patterns WHERE domain = ? ORDER BY confidence DESC LIMIT ?')
        .all(domain, limit);
    }
    return db.prepare('SELECT * FROM patterns ORDER BY confidence DESC LIMIT ?').all(limit);
  });

  ipcMain.handle('sqlite:patterns:create', (_event, params: {
    domain: string;
    pattern: string;
    description: string;
    examples?: string[];
  }) => {
    const db = getDatabase(DB_NAMES.MEMORY);
    const id = generateId();
    const { domain, pattern, description, examples = [] } = params;

    db.prepare(`
      INSERT INTO patterns (id, domain, pattern, description)
      VALUES (?, ?, ?, ?)
    `).run(id, domain, pattern, description);

    const exStmt = db.prepare('INSERT INTO pattern_examples (pattern_id, example, sort_order) VALUES (?, ?, ?)');
    examples.forEach((ex, i) => exStmt.run(id, ex, i));

    return { id, success: true };
  });

  // ── 知识图谱 CRUD ──────────────────────────────────────
  ipcMain.handle('sqlite:entities:create', (_event, params: {
    type: string;
    name: string;
    metadata?: Record<string, unknown>;
    workspaceId?: string;
  }) => {
    const db = getDatabase(DB_NAMES.INTELLIGENCE);
    const id = generateId();
    const { type, name, metadata = {}, workspaceId } = params;

    db.prepare(`
      INSERT OR IGNORE INTO entities (id, type, name, metadata, workspace_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, type, name, JSON.stringify(metadata), workspaceId ?? null);

    return { id, success: true };
  });

  ipcMain.handle('sqlite:relations:create', (_event, params: {
    sourceId: string;
    targetId: string;
    type: string;
    weight?: number;
  }) => {
    const db = getDatabase(DB_NAMES.INTELLIGENCE);
    const { sourceId, targetId, type, weight = 1.0 } = params;

    db.prepare(`
      INSERT OR REPLACE INTO relations (source_id, target_id, type, weight)
      VALUES (?, ?, ?, ?)
    `).run(sourceId, targetId, type, weight);

    return { success: true };
  });

  ipcMain.handle('sqlite:graph:traverse', (_event, params: {
    entityId: string;
    hops: number;
  }) => {
    const db = getDatabase(DB_NAMES.INTELLIGENCE);
    const { entityId, hops } = params;

    const maxHops = Math.min(hops, 3); // 最多 3 跳

    const rows = db.prepare(`
      WITH RECURSIVE graph_walk(id, depth, path) AS (
        SELECT ?, 0, ?
        UNION ALL
        SELECT
          CASE WHEN r.source_id = gw.id THEN r.target_id ELSE r.source_id END,
          gw.depth + 1,
          gw.path || ',' || CASE WHEN r.source_id = gw.id THEN r.target_id ELSE r.source_id END
        FROM graph_walk gw
        JOIN relations r ON (r.source_id = gw.id OR r.target_id = gw.id)
        WHERE gw.depth < ?
          AND CASE WHEN r.source_id = gw.id THEN r.target_id ELSE r.source_id END NOT IN (
            SELECT value FROM json_each('["' || replace(gw.path, ',', '","') || '"]')
          )
      )
      SELECT DISTINCT e.*, gw.depth
      FROM graph_walk gw
      JOIN entities e ON e.id = gw.id
      WHERE gw.id != ?
      ORDER BY gw.depth
    `).all(entityId, entityId, maxHops, entityId);

    return rows;
  });

  // ── 用户画像 ────────────────────────────────────────────
  ipcMain.handle('sqlite:profile:get', (_event, params: { workspaceId: string }) => {
    const db = getDatabase(DB_NAMES.INTELLIGENCE);
    const userPeer = db.prepare('SELECT * FROM user_peer WHERE workspace_id = ?').all(params.workspaceId);
    const aiPeer = db.prepare('SELECT * FROM ai_peer WHERE workspace_id = ?').all(params.workspaceId);
    const workspace = db.prepare('SELECT * FROM workspace_profiles WHERE workspace_id = ?').get(params.workspaceId);
    return { userPeer, aiPeer, workspace };
  });

  ipcMain.handle('sqlite:profile:update', (_event, params: {
    workspaceId: string;
    dimension: string;
    value: string;
    confidence: number;
    isManual?: boolean;
  }) => {
    const db = getDatabase(DB_NAMES.INTELLIGENCE);
    const id = generateId();
    const { workspaceId, dimension, value, confidence, isManual = false } = params;

    db.prepare(`
      INSERT OR REPLACE INTO user_peer (id, workspace_id, dimension, value, confidence, is_manual, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, unixepoch())
    `).run(id, workspaceId, dimension, value, confidence, isManual ? 1 : 0);

    return { success: true };
  });

  // ── Skill CRUD ──────────────────────────────────────────
  ipcMain.handle('sqlite:skills:list', (_event, params: {
    status?: string;
    domain?: string;
    limit?: number;
  }) => {
    const db = getDatabase(DB_NAMES.SKILLS);
    const { status = 'active', domain, limit = 50 } = params;

    let query = 'SELECT * FROM skills WHERE status = ?';
    const args: unknown[] = [status];

    if (domain) {
      query += ' AND domain = ?';
      args.push(domain);
    }

    query += ' ORDER BY usage_count DESC LIMIT ?';
    args.push(limit);

    return db.prepare(query).all(...args);
  });

  ipcMain.handle('sqlite:skills:create', (_event, params: {
    name: string;
    description: string;
    content: string;
    source: string;
    domain?: string;
    tags?: string[];
  }) => {
    const db = getDatabase(DB_NAMES.SKILLS);
    const id = generateId();
    const { name, description, content, source, domain, tags = [] } = params;

    db.prepare(`
      INSERT INTO skills (id, name, description, content, source, domain, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, description, content, source, domain ?? null, JSON.stringify(tags));

    return { id, success: true };
  });

  // ── Hook CRUD ───────────────────────────────────────────
  ipcMain.handle('sqlite:hooks:list', (_event, params: {
    triggerType?: string;
    enabled?: boolean;
  }) => {
    const db = getDatabase(DB_NAMES.AUTOMATION);
    const { triggerType, enabled } = params;

    let query = 'SELECT * FROM hooks WHERE 1=1';
    const args: unknown[] = [];

    if (triggerType) {
      query += ' AND trigger_type = ?';
      args.push(triggerType);
    }
    if (enabled !== undefined) {
      query += ' AND enabled = ?';
      args.push(enabled ? 1 : 0);
    }

    query += ' ORDER BY created_at DESC';
    return db.prepare(query).all(...args);
  });

  ipcMain.handle('sqlite:hooks:create', (_event, params: {
    name: string;
    triggerType: string;
    conditions?: Record<string, unknown>;
    actions?: unknown[];
    workspaceId?: string;
  }) => {
    const db = getDatabase(DB_NAMES.AUTOMATION);
    const id = generateId();
    const { name, triggerType, conditions = {}, actions = [], workspaceId } = params;

    db.prepare(`
      INSERT INTO hooks (id, name, trigger_type, conditions, actions, workspace_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, name, triggerType, JSON.stringify(conditions), JSON.stringify(actions), workspaceId ?? null);

    return { id, success: true };
  });

  // ── FTS5 全文搜索（V3 searchIndex 主路径）────────────────
  ipcMain.handle('sqlite:search:fts5', (_event, params: {
    query: string;
    type?: string | null;
    dateFrom?: number | null;
    dateTo?: number | null;
    tags?: string[] | null;
    limit?: number;
  }) => {
    const db = getDatabase(DB_NAMES.MEMORY);
    const { query, dateFrom, dateTo, tags, limit = 20 } = params;

    // 使用 FTS5 MATCH 搜索 episodes 表
    let sql = `
      SELECT
        e.id, e.type, NULL as title, e.content as question, NULL as answer,
        COALESCE((SELECT json_group_array(t.tag) FROM episode_tags t WHERE t.episode_id = e.id), '[]') as tags,
        e.timestamp as created_at, e.workspace_id as session_id, NULL as tool_names,
        fts.rank,
        snippet(episodes_fts, 0, '<mark>', '</mark>', '...', 32) as snippet_question
      FROM episodes e
      JOIN episodes_fts fts ON e.rowid = fts.rowid
      LEFT JOIN episode_tags et ON e.id = et.episode_id
      WHERE episodes_fts MATCH ?
        AND e.is_deleted = 0
    `;
    const args: unknown[] = [query];

    if (dateFrom) {
      sql += ' AND e.timestamp >= ?';
      args.push(dateFrom);
    }
    if (dateTo) {
      sql += ' AND e.timestamp <= ?';
      args.push(dateTo);
    }
    if (tags && tags.length > 0) {
      sql += ' AND e.id IN (SELECT episode_id FROM episode_tags WHERE tag IN (' + tags.map(() => '?').join(',') + '))';
      args.push(...tags);
    }

    sql += ' GROUP BY e.id ORDER BY fts.rank LIMIT ?';
    args.push(limit);

    try {
      return db.prepare(sql).all(...args);
    } catch {
      // FTS5 不可用或 MATCH 语法错误时返回空数组
      return [];
    }
  });

  // ── 通用查询（降级 / 高级用法）─────────────────────────
  ipcMain.handle('sqlite:raw:query', (_event, params: {
    dbName: DatabaseName;
    sql: string;
    args?: unknown[];
  }) => {
    const db = getDatabase(params.dbName);
    try {
      const stmt = db.prepare(params.sql);
      return { success: true, data: stmt.all(...(params.args ?? [])) };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  });

  console.log('[SQLite] All IPC handlers registered');
}

/**
 * 注销所有 SQLite IPC handlers
 */
export function unregisterSQLiteHandlers(): void {
  const channels = [
    'sqlite:isAvailable', 'sqlite:init', 'sqlite:close',
    'sqlite:episodes:list', 'sqlite:episodes:create', 'sqlite:episodes:search', 'sqlite:episodes:softDelete',
    'sqlite:patterns:list', 'sqlite:patterns:create',
    'sqlite:entities:create', 'sqlite:relations:create', 'sqlite:graph:traverse',
    'sqlite:profile:get', 'sqlite:profile:update',
    'sqlite:skills:list', 'sqlite:skills:create',
    'sqlite:hooks:list', 'sqlite:hooks:create',
    'sqlite:search:fts5',
    'sqlite:raw:query',
  ];

  for (const channel of channels) {
    ipcMain.removeHandler(channel);
  }
}
