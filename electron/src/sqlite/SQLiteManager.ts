/**
 * SQLiteManager — better-sqlite3 单例管理器
 *
 * 管理 4 个 SQLite 数据库连接的生命周期：
 * - cc-web-memory: 情景记忆 + 语义记忆
 * - cc-web-intelligence: 用户画像 + 知识图谱
 * - cc-web-skills: Skill 管理
 * - cc-web-automation: Hook 配置 + 模板
 *
 * 遵循项目原生模块惰性加载模式（参考 LanceDB 单例）。
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';

// 数据库名称常量
export const DB_NAMES = {
  MEMORY: 'cc-web-memory',
  INTELLIGENCE: 'cc-web-intelligence',
  SKILLS: 'cc-web-skills',
  AUTOMATION: 'cc-web-automation',
} as const;

export type DatabaseName = (typeof DB_NAMES)[keyof typeof DB_NAMES];

// 单例连接池
const connections = new Map<DatabaseName, Database.Database>();

/**
 * 获取数据目录路径（Electron app data 目录下的 sqlite 子目录）
 */
function getDataDir(): string {
  const dataDir = path.join(app.getPath('userData'), 'sqlite');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return dataDir;
}

/**
 * 获取或创建数据库连接（惰性初始化）
 */
export function getDatabase(name: DatabaseName): Database.Database {
  const existing = connections.get(name);
  if (existing) return existing;

  const dbPath = path.join(getDataDir(), `${name}.db`);
  const db = new Database(dbPath);

  // 启用 WAL 模式提升并发性能
  db.pragma('journal_mode = WAL');
  // 启用外键约束
  db.pragma('foreign_keys = ON');

  connections.set(name, db);
  return db;
}

/**
 * 初始化指定数据库的 Schema
 */
export function initSchema(name: DatabaseName): void {
  const db = getDatabase(name);

  switch (name) {
    case DB_NAMES.MEMORY:
      initMemorySchema(db);
      break;
    case DB_NAMES.INTELLIGENCE:
      initIntelligenceSchema(db);
      break;
    case DB_NAMES.SKILLS:
      initSkillsSchema(db);
      break;
    case DB_NAMES.AUTOMATION:
      initAutomationSchema(db);
      break;
  }
}

/**
 * cc-web-memory: 情景记忆 + 语义记忆
 */
function initMemorySchema(db: Database.Database): void {
  db.exec(`
    -- 情景记忆
    CREATE TABLE IF NOT EXISTS episodes (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      timestamp INTEGER NOT NULL DEFAULT (unixepoch()),
      type TEXT NOT NULL CHECK(type IN ('bug_fix','feature_impl','config_change','debug_session','code_review','architecture_decision')),
      content TEXT NOT NULL,
      embedding BLOB,
      emotion_tag TEXT CHECK(emotion_tag IN ('success','failure','confusion','satisfaction')),
      confidence REAL NOT NULL DEFAULT 1.0,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      deleted_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    -- 情景记忆标签
    CREATE TABLE IF NOT EXISTS episode_tags (
      episode_id TEXT NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
      tag TEXT NOT NULL,
      PRIMARY KEY (episode_id, tag)
    );

    -- FTS5 全文索引
    CREATE VIRTUAL TABLE IF NOT EXISTS episodes_fts USING fts5(
      content,
      content=episodes,
      content_rowid=rowid
    );

    -- FTS5 同步触发器（插入/更新/删除时自动同步）
    CREATE TRIGGER IF NOT EXISTS episodes_ai AFTER INSERT ON episodes BEGIN
      INSERT INTO episodes_fts (rowid, content) VALUES (new.rowid, new.content);
    END;
    CREATE TRIGGER IF NOT EXISTS episodes_ad AFTER DELETE ON episodes BEGIN
      INSERT INTO episodes_fts (episodes_fts, rowid, content) VALUES ('delete', old.rowid, old.content);
    END;
    CREATE TRIGGER IF NOT EXISTS episodes_au AFTER UPDATE ON episodes BEGIN
      INSERT INTO episodes_fts (episodes_fts, rowid, content) VALUES ('delete', old.rowid, old.content);
      INSERT INTO episodes_fts (rowid, content) VALUES (new.rowid, new.content);
    END;

    -- 语义记忆（从情景记忆压缩生成的结构化知识）
    CREATE TABLE IF NOT EXISTS patterns (
      id TEXT PRIMARY KEY,
      domain TEXT NOT NULL,
      pattern TEXT NOT NULL,
      description TEXT NOT NULL,
      confidence REAL NOT NULL DEFAULT 1.0,
      last_used INTEGER NOT NULL DEFAULT (unixepoch()),
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    -- 语义记忆示例关联
    CREATE TABLE IF NOT EXISTS pattern_examples (
      pattern_id TEXT NOT NULL REFERENCES patterns(id) ON DELETE CASCADE,
      example TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    -- 知识条目
    CREATE TABLE IF NOT EXISTS knowledge_entries (
      id TEXT PRIMARY KEY,
      domain TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      embedding BLOB,
      confidence REAL NOT NULL DEFAULT 1.0,
      last_used INTEGER NOT NULL DEFAULT (unixepoch()),
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    -- FTS5 全文索引（知识条目）
    CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
      title,
      content,
      content=knowledge_entries,
      content_rowid=rowid
    );

    -- FTS5 同步触发器
    CREATE TRIGGER IF NOT EXISTS knowledge_ai AFTER INSERT ON knowledge_entries BEGIN
      INSERT INTO knowledge_fts (rowid, title, content) VALUES (new.rowid, new.title, new.content);
    END;
    CREATE TRIGGER IF NOT EXISTS knowledge_ad AFTER DELETE ON knowledge_entries BEGIN
      INSERT INTO knowledge_fts (knowledge_fts, rowid, title, content) VALUES ('delete', old.rowid, old.title, old.content);
    END;
    CREATE TRIGGER IF NOT EXISTS knowledge_au AFTER UPDATE ON knowledge_entries BEGIN
      INSERT INTO knowledge_fts (knowledge_fts, rowid, title, content) VALUES ('delete', old.rowid, old.title, old.content);
      INSERT INTO knowledge_fts (rowid, title, content) VALUES (new.rowid, new.title, new.content);
    END;

    -- 索引
    CREATE INDEX IF NOT EXISTS idx_episodes_workspace ON episodes(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_episodes_type ON episodes(type);
    CREATE INDEX IF NOT EXISTS idx_episodes_timestamp ON episodes(timestamp);
    CREATE INDEX IF NOT EXISTS idx_episodes_confidence ON episodes(confidence);
    CREATE INDEX IF NOT EXISTS idx_patterns_domain ON patterns(domain);
    CREATE INDEX IF NOT EXISTS idx_knowledge_domain ON knowledge_entries(domain);
  `);
}

/**
 * cc-web-intelligence: 用户画像 + 知识图谱
 */
function initIntelligenceSchema(db: Database.Database): void {
  db.exec(`
    -- 用户画像 Peer
    CREATE TABLE IF NOT EXISTS user_peer (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      dimension TEXT NOT NULL,
      value TEXT NOT NULL,
      confidence REAL NOT NULL DEFAULT 0.0,
      is_manual INTEGER NOT NULL DEFAULT 0,
      source TEXT,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    -- AI Peer
    CREATE TABLE IF NOT EXISTS ai_peer (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      dimension TEXT NOT NULL,
      value TEXT NOT NULL,
      confidence REAL NOT NULL DEFAULT 0.0,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    -- 工作区画像（聚合视图基础数据）
    CREATE TABLE IF NOT EXISTS workspace_profiles (
      workspace_id TEXT PRIMARY KEY,
      skill_level TEXT DEFAULT 'intermediate',
      preferred_languages TEXT DEFAULT '[]',
      preferred_frameworks TEXT DEFAULT '[]',
      coding_style TEXT DEFAULT '{}',
      last_inference_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    -- 知识图谱：实体
    CREATE TABLE IF NOT EXISTS entities (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK(type IN ('file','function','concept','pattern','module','error')),
      name TEXT NOT NULL,
      metadata TEXT DEFAULT '{}',
      workspace_id TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    -- 知识图谱：关系（邻接表模式）
    CREATE TABLE IF NOT EXISTS relations (
      source_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
      target_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK(type IN ('depends_on','implements','contains','related_to','calls','imports')),
      weight REAL NOT NULL DEFAULT 1.0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (source_id, target_id, type)
    );

    -- 索引
    CREATE INDEX IF NOT EXISTS idx_user_peer_workspace ON user_peer(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_ai_peer_workspace ON ai_peer(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);
    CREATE INDEX IF NOT EXISTS idx_entities_workspace ON entities(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_relations_source ON relations(source_id);
    CREATE INDEX IF NOT EXISTS idx_relations_target ON relations(target_id);
    CREATE INDEX IF NOT EXISTS idx_relations_type ON relations(type);
  `);
}

/**
 * cc-web-skills: Skill 管理
 */
function initSkillsSchema(db: Database.Database): void {
  db.exec(`
    -- Skill 定义
    CREATE TABLE IF NOT EXISTS skills (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      content TEXT NOT NULL,
      source TEXT NOT NULL CHECK(source IN ('manual','auto-generated','mcp','template')),
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived','pending_review')),
      domain TEXT,
      tags TEXT DEFAULT '[]',
      usage_count INTEGER NOT NULL DEFAULT 0,
      success_count INTEGER NOT NULL DEFAULT 0,
      total_tokens INTEGER NOT NULL DEFAULT 0,
      last_used_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    -- Skill 版本
    CREATE TABLE IF NOT EXISTS skill_versions (
      id TEXT PRIMARY KEY,
      skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
      version INTEGER NOT NULL,
      content TEXT NOT NULL,
      changelog TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    -- Skill 评分
    CREATE TABLE IF NOT EXISTS skill_ratings (
      id TEXT PRIMARY KEY,
      skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
      rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
      feedback TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    -- FTS5 全文索引（Skill 搜索）
    CREATE VIRTUAL TABLE IF NOT EXISTS skills_fts USING fts5(
      name,
      description,
      content,
      tags,
      content=skills,
      content_rowid=rowid
    );

    -- FTS5 同步触发器
    CREATE TRIGGER IF NOT EXISTS skills_ai AFTER INSERT ON skills BEGIN
      INSERT INTO skills_fts (rowid, name, description, content, tags) VALUES (new.rowid, new.name, new.description, new.content, new.tags);
    END;
    CREATE TRIGGER IF NOT EXISTS skills_ad AFTER DELETE ON skills BEGIN
      INSERT INTO skills_fts (skills_fts, rowid, name, description, content, tags) VALUES ('delete', old.rowid, old.name, old.description, old.content, old.tags);
    END;
    CREATE TRIGGER IF NOT EXISTS skills_au AFTER UPDATE ON skills BEGIN
      INSERT INTO skills_fts (skills_fts, rowid, name, description, content, tags) VALUES ('delete', old.rowid, old.name, old.description, old.content, old.tags);
      INSERT INTO skills_fts (rowid, name, description, content, tags) VALUES (new.rowid, new.name, new.description, new.content, new.tags);
    END;

    -- 索引
    CREATE INDEX IF NOT EXISTS idx_skills_status ON skills(status);
    CREATE INDEX IF NOT EXISTS idx_skills_source ON skills(source);
    CREATE INDEX IF NOT EXISTS idx_skills_domain ON skills(domain);
    CREATE INDEX IF NOT EXISTS idx_skill_versions_skill ON skill_versions(skill_id);
  `);
}

/**
 * cc-web-automation: Hook 配置 + 模板
 */
function initAutomationSchema(db: Database.Database): void {
  db.exec(`
    -- Hook 配置
    CREATE TABLE IF NOT EXISTS hooks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      trigger_type TEXT NOT NULL CHECK(trigger_type IN (
        'session_start','pre_tool_use','post_tool_use','task_complete',
        'error_detected','context_low','cost_alert','skill_matched'
      )),
      conditions TEXT NOT NULL DEFAULT '{}',
      actions TEXT NOT NULL DEFAULT '[]',
      enabled INTEGER NOT NULL DEFAULT 1,
      workspace_id TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    -- Hook 执行日志
    CREATE TABLE IF NOT EXISTS hook_logs (
      id TEXT PRIMARY KEY,
      hook_id TEXT NOT NULL REFERENCES hooks(id) ON DELETE CASCADE,
      trigger_time INTEGER NOT NULL DEFAULT (unixepoch()),
      execution_duration INTEGER,
      result TEXT NOT NULL CHECK(result IN ('success','failure','skipped')),
      error_message TEXT,
      context TEXT DEFAULT '{}'
    );

    -- 模板
    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL DEFAULT 'general',
      content TEXT NOT NULL,
      is_builtin INTEGER NOT NULL DEFAULT 0,
      usage_count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    -- 模板使用记录
    CREATE TABLE IF NOT EXISTS template_usage (
      id TEXT PRIMARY KEY,
      template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
      workspace_id TEXT,
      used_at INTEGER NOT NULL DEFAULT (unixepoch()),
      success INTEGER NOT NULL DEFAULT 1
    );

    -- 索引
    CREATE INDEX IF NOT EXISTS idx_hooks_trigger ON hooks(trigger_type);
    CREATE INDEX IF NOT EXISTS idx_hooks_workspace ON hooks(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_hook_logs_hook ON hook_logs(hook_id);
    CREATE INDEX IF NOT EXISTS idx_hook_logs_time ON hook_logs(trigger_time);
    CREATE INDEX IF NOT EXISTS idx_templates_category ON templates(category);
  `);
}

/**
 * 初始化所有数据库 Schema
 */
export function initAllSchemas(): void {
  for (const name of Object.values(DB_NAMES)) {
    initSchema(name);
  }
}

/**
 * 关闭指定数据库连接
 */
export function closeDatabase(name: DatabaseName): void {
  const db = connections.get(name);
  if (db) {
    db.close();
    connections.delete(name);
  }
}

/**
 * 关闭所有数据库连接（应用退出时调用）
 */
export function closeAllDatabases(): void {
  for (const [name] of connections) {
    closeDatabase(name);
  }
}

/**
 * 检查 SQLite 是否可用（降级方案判断）
 */
export function isSQLiteAvailable(): boolean {
  try {
    const testDb = new Database(':memory:');
    testDb.close();
    return true;
  } catch {
    return false;
  }
}
