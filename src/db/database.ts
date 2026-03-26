import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('filament.db');

db.execSync(`
  CREATE TABLE IF NOT EXISTS filaments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    manufacturer TEXT NOT NULL,
    type TEXT NOT NULL,
    color TEXT NOT NULL,
    upc TEXT NOT NULL DEFAULT '',
    photo_uri TEXT,
    url TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS rolls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filament_id INTEGER NOT NULL REFERENCES filaments(id) ON DELETE CASCADE,
    location TEXT NOT NULL,
    is_checked_out INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    checked_out_at TEXT
  );

  CREATE TABLE IF NOT EXISTS list_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    value TEXT NOT NULL,
    UNIQUE(category, value)
  );

  PRAGMA foreign_keys = ON;
`);

// Migrate existing databases
try { db.execSync('ALTER TABLE filaments ADD COLUMN url TEXT'); } catch (_) {}
try { db.execSync("ALTER TABLE filaments ADD COLUMN priority TEXT NOT NULL DEFAULT 'Medium'"); } catch (_) {}
try { db.execSync('ALTER TABLE rolls ADD COLUMN archived INTEGER NOT NULL DEFAULT 0'); } catch (_) {}
try { db.execSync('ALTER TABLE filaments ADD COLUMN supabase_id TEXT'); } catch (_) {}
try { db.execSync('ALTER TABLE rolls ADD COLUMN supabase_id TEXT'); } catch (_) {}
try {
  db.execSync(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
  db.execSync(`
    INSERT OR IGNORE INTO settings (key, value) VALUES
      ('threshold_Low', '0'),
      ('threshold_Medium', '1'),
      ('threshold_High', '4')
  `);
} catch (_) {}
try {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS local_photos (
      filament_id TEXT PRIMARY KEY,
      photo_uri TEXT NOT NULL
    )
  `);
} catch (_) {}

// ── Local settings (used for migration flag only) ──────────────────────────────

export function getSetting(key: string, defaultValue: string): string {
  const row = db.getFirstSync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
  return row?.value ?? defaultValue;
}

export function setSetting(key: string, value: string): void {
  db.runSync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
}

// ── Migration read helpers (used by migrateToSupabase.ts) ─────────────────────

export function getMigrationFilaments(): {
  id: number; manufacturer: string; type: string; color: string;
  upc: string; url: string | null; priority: string;
  photo_uri: string | null; supabase_id: string | null;
}[] {
  return db.getAllSync(
    'SELECT id, manufacturer, type, color, upc, url, priority, photo_uri, supabase_id FROM filaments'
  );
}

export function getMigrationRolls(): {
  id: number; filament_id: number;
  is_checked_out: number; archived: number;
  supabase_id: string | null;
}[] {
  return db.getAllSync(
    'SELECT id, filament_id, is_checked_out, archived, supabase_id FROM rolls'
  );
}

export function getMigrationSettings(): { key: string; value: string }[] {
  return db.getAllSync('SELECT key, value FROM settings');
}

export function setMigrationFilamentSupabaseId(localId: number, supabaseId: string): void {
  db.runSync('UPDATE filaments SET supabase_id = ? WHERE id = ?', [supabaseId, localId]);
}

export function setMigrationRollSupabaseId(localId: number, supabaseId: string): void {
  db.runSync('UPDATE rolls SET supabase_id = ? WHERE id = ?', [supabaseId, localId]);
}

// Store local photo URI for a migrated filament (keyed by Supabase UUID)
export function setMigrationLocalPhoto(supabaseId: string, photoUri: string): void {
  db.runSync(
    'INSERT OR REPLACE INTO local_photos (filament_id, photo_uri) VALUES (?, ?)',
    [supabaseId, photoUri]
  );
}
