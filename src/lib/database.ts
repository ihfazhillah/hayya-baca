import * as SQLite from "expo-sqlite";

const DB_NAME = "hayyabaca.db";

let db: SQLite.SQLiteDatabase | null = null;
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  if (dbPromise) return dbPromise;
  dbPromise = (async () => {
    const instance = await SQLite.openDatabaseAsync(DB_NAME);
    await initDatabase(instance);
    db = instance;
    return instance;
  })();
  return dbPromise;
}

async function initDatabase(db: SQLite.SQLiteDatabase) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS children (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      avatar_color TEXT NOT NULL DEFAULT '#1A73E8',
      coins INTEGER NOT NULL DEFAULT 0,
      stars INTEGER NOT NULL DEFAULT 0,
      age INTEGER,
      server_id INTEGER DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS reading_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      child_id INTEGER NOT NULL,
      book_id TEXT NOT NULL,
      last_page INTEGER NOT NULL DEFAULT 0,
      completed INTEGER NOT NULL DEFAULT 0,
      completed_count INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (child_id) REFERENCES children(id),
      UNIQUE(child_id, book_id)
    );

    CREATE TABLE IF NOT EXISTS reward_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      child_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('coin', 'star')),
      count INTEGER NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (child_id) REFERENCES children(id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS cached_articles (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reading_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      child_id INTEGER NOT NULL,
      book_id TEXT NOT NULL,
      completed_at TEXT NOT NULL DEFAULT (datetime('now')),
      synced INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (child_id) REFERENCES children(id)
    );

    CREATE TABLE IF NOT EXISTS seen_content (
      child_id INTEGER NOT NULL,
      content_id TEXT NOT NULL,
      seen_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (child_id, content_id)
    );

    CREATE TABLE IF NOT EXISTS game_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      child_id INTEGER NOT NULL,
      game_slug TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      server_session_id INTEGER,
      ended INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (child_id) REFERENCES children(id)
    );
  `);

  // Migration: add server_id column if missing (idempotent)
  try {
    await db.runAsync("ALTER TABLE children ADD COLUMN server_id INTEGER DEFAULT NULL");
  } catch {
    // column already exists — ignore
  }

  // Migration: add synced column to reading_progress (default 1 = existing rows already synced)
  try {
    await db.runAsync("ALTER TABLE reading_progress ADD COLUMN synced INTEGER NOT NULL DEFAULT 1");
  } catch {
    // column already exists — ignore
  }

  // Migration: add idempotency_key column to reward_history
  try {
    await db.runAsync("ALTER TABLE reward_history ADD COLUMN idempotency_key TEXT DEFAULT NULL");
  } catch {
    // column already exists — ignore
  }

  // Migration: remove CHECK constraint on reward_history.type to allow coin_adjustment/star_adjustment
  // SQLite doesn't support ALTER CHECK, so we recreate the table
  try {
    const hasCheck = await db.getFirstAsync<{ sql: string }>(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='reward_history'"
    );
    if (hasCheck?.sql?.includes("CHECK")) {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS reward_history_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          child_id INTEGER NOT NULL,
          type TEXT NOT NULL,
          count INTEGER NOT NULL,
          description TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          synced INTEGER NOT NULL DEFAULT 0,
          idempotency_key TEXT DEFAULT NULL,
          FOREIGN KEY (child_id) REFERENCES children(id)
        );
        INSERT INTO reward_history_new SELECT id, child_id, type, count, description, created_at, synced, idempotency_key FROM reward_history;
        DROP TABLE reward_history;
        ALTER TABLE reward_history_new RENAME TO reward_history;
      `);
    }
  } catch {
    // migration already done or not needed
  }
}

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM settings WHERE key = ?",
    key
  );
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string | null): Promise<void> {
  const db = await getDatabase();
  if (value !== null) {
    await db.runAsync(
      "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
      key,
      value
    );
  } else {
    await db.runAsync("DELETE FROM settings WHERE key = ?", key);
  }
}
