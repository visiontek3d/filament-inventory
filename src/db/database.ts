import * as SQLite from 'expo-sqlite';
import { Filament, FilamentSummary, Roll } from '../types';
import {
  syncCreateFilament, syncUpdateFilament, syncDeleteFilament,
  syncCreateRoll, syncUpdateRoll, syncDeleteRoll, syncSetting,
} from './sync';

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

// ── Filaments ──────────────────────────────────────────────────────────────────

export function getAllFilaments(): FilamentSummary[] {
  return db.getAllSync<FilamentSummary>(`
    SELECT
      f.*,
      COUNT(r.id) AS total_rolls,
      SUM(CASE WHEN r.is_checked_out = 0 AND r.archived = 0 THEN 1 ELSE 0 END) AS in_inventory,
      SUM(CASE WHEN r.is_checked_out = 1 AND r.archived = 0 THEN 1 ELSE 0 END) AS in_use
    FROM filaments f
    LEFT JOIN rolls r ON r.filament_id = f.id
    GROUP BY f.id
    ORDER BY f.manufacturer ASC, f.type ASC, f.color ASC
  `);
}

export function getDistinctManufacturers(): string[] {
  return db.getAllSync<{ manufacturer: string }>(
    'SELECT DISTINCT manufacturer FROM filaments ORDER BY manufacturer ASC'
  ).map(r => r.manufacturer);
}

export function getDistinctTypes(): string[] {
  return db.getAllSync<{ type: string }>(
    'SELECT DISTINCT type FROM filaments ORDER BY type ASC'
  ).map(r => r.type);
}

export function getFilament(id: number): Filament | null {
  return db.getFirstSync<Filament>('SELECT * FROM filaments WHERE id = ?', [id]) ?? null;
}

export function getFilamentByUpc(upc: string): FilamentSummary | null {
  return db.getFirstSync<FilamentSummary>(`
    SELECT
      f.*,
      COUNT(r.id) AS total_rolls,
      SUM(CASE WHEN r.is_checked_out = 0 AND r.archived = 0 THEN 1 ELSE 0 END) AS in_inventory,
      SUM(CASE WHEN r.is_checked_out = 1 AND r.archived = 0 THEN 1 ELSE 0 END) AS in_use
    FROM filaments f
    LEFT JOIN rolls r ON r.filament_id = f.id
    WHERE f.upc = ?
    GROUP BY f.id
  `, [upc]) ?? null;
}

export function searchFilaments(query: string): FilamentSummary[] {
  const like = `%${query}%`;
  return db.getAllSync<FilamentSummary>(`
    SELECT
      f.*,
      COUNT(r.id) AS total_rolls,
      SUM(CASE WHEN r.is_checked_out = 0 AND r.archived = 0 THEN 1 ELSE 0 END) AS in_inventory,
      SUM(CASE WHEN r.is_checked_out = 1 AND r.archived = 0 THEN 1 ELSE 0 END) AS in_use
    FROM filaments f
    LEFT JOIN rolls r ON r.filament_id = f.id
    WHERE f.manufacturer LIKE ? OR f.type LIKE ? OR f.color LIKE ? OR f.upc LIKE ?
    GROUP BY f.id
    ORDER BY f.manufacturer ASC, f.type ASC, f.color ASC
  `, [like, like, like, like]);
}

export function createFilament(
  manufacturer: string,
  type: string,
  color: string,
  upc: string,
  photo_uri: string | null,
  url: string | null,
  priority: string
): number {
  const result = db.runSync(
    'INSERT INTO filaments (manufacturer, type, color, upc, photo_uri, url, priority) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [manufacturer, type, color, upc, photo_uri, url, priority]
  );
  const localId = result.lastInsertRowId;
  syncCreateFilament(localId, { manufacturer, type, color, upc, url, priority }).catch(() => {});
  return localId;
}

export function updateFilament(
  id: number,
  manufacturer: string,
  type: string,
  color: string,
  upc: string,
  photo_uri: string | null,
  url: string | null,
  priority: string
): void {
  db.runSync(
    'UPDATE filaments SET manufacturer = ?, type = ?, color = ?, upc = ?, photo_uri = ?, url = ?, priority = ? WHERE id = ?',
    [manufacturer, type, color, upc, photo_uri, url, priority, id]
  );
  const row = db.getFirstSync<{ supabase_id: string | null }>('SELECT supabase_id FROM filaments WHERE id = ?', [id]);
  if (row?.supabase_id) {
    syncUpdateFilament(row.supabase_id, { manufacturer, type, color, upc, url, priority }).catch(() => {});
  }
}

export function updateFilamentPhoto(id: number, photo_uri: string): void {
  db.runSync('UPDATE filaments SET photo_uri = ? WHERE id = ?', [photo_uri, id]);
}

export function deleteFilament(id: number): void {
  const row = db.getFirstSync<{ supabase_id: string | null }>('SELECT supabase_id FROM filaments WHERE id = ?', [id]);
  db.runSync('DELETE FROM filaments WHERE id = ?', [id]);
  if (row?.supabase_id) syncDeleteFilament(row.supabase_id).catch(() => {});
}

export type BulkImportResult = { inserted: number; skipped: number; errors: string[] };

export function bulkImportFilaments(
  rows: { manufacturer: string; type: string; color: string; upc: string; url: string | null }[]
): BulkImportResult {
  const result: BulkImportResult = { inserted: 0, skipped: 0, errors: [] };
  for (const row of rows) {
    try {
      const existing = row.upc
        ? db.getFirstSync('SELECT id FROM filaments WHERE upc = ?', [row.upc])
        : null;
      if (existing) {
        result.skipped++;
        continue;
      }
      db.runSync(
        'INSERT INTO filaments (manufacturer, type, color, upc, url) VALUES (?, ?, ?, ?, ?)',
        [row.manufacturer, row.type, row.color, row.upc, row.url]
      );
      result.inserted++;
    } catch (e: any) {
      result.errors.push(`${row.manufacturer} ${row.type} ${row.color}: ${e.message}`);
    }
  }
  return result;
}

// ── Rolls ──────────────────────────────────────────────────────────────────────

export function getRolls(filamentId: number): Roll[] {
  return db.getAllSync<Roll>(
    'SELECT id, filament_id, is_checked_out AS is_in_use, archived, created_at FROM rolls WHERE filament_id = ? ORDER BY archived ASC, is_checked_out DESC, created_at ASC',
    [filamentId]
  );
}

export function createRoll(filamentId: number): void {
  const result = db.runSync(
    "INSERT INTO rolls (filament_id, location, is_checked_out) VALUES (?, '', 0)",
    [filamentId]
  );
  syncCreateRoll(result.lastInsertRowId, filamentId).catch(() => {});
}

export function setRollInUse(id: number): void {
  db.runSync('UPDATE rolls SET is_checked_out = 1 WHERE id = ?', [id]);
  const row = db.getFirstSync<{ supabase_id: string | null }>('SELECT supabase_id FROM rolls WHERE id = ?', [id]);
  if (row?.supabase_id) syncUpdateRoll(row.supabase_id, { is_checked_out: 1 }).catch(() => {});
}

export function setRollInInventory(id: number): void {
  db.runSync('UPDATE rolls SET is_checked_out = 0 WHERE id = ?', [id]);
  const row = db.getFirstSync<{ supabase_id: string | null }>('SELECT supabase_id FROM rolls WHERE id = ?', [id]);
  if (row?.supabase_id) syncUpdateRoll(row.supabase_id, { is_checked_out: 0 }).catch(() => {});
}

export function archiveRoll(id: number): void {
  db.runSync('UPDATE rolls SET archived = 1 WHERE id = ?', [id]);
  const row = db.getFirstSync<{ supabase_id: string | null }>('SELECT supabase_id FROM rolls WHERE id = ?', [id]);
  if (row?.supabase_id) syncUpdateRoll(row.supabase_id, { archived: 1, is_checked_out: 0 }).catch(() => {});
}

export function deleteRoll(id: number): void {
  const row = db.getFirstSync<{ supabase_id: string | null }>('SELECT supabase_id FROM rolls WHERE id = ?', [id]);
  db.runSync('DELETE FROM rolls WHERE id = ?', [id]);
  if (row?.supabase_id) syncDeleteRoll(row.supabase_id).catch(() => {});
}


// ── List Items (manufacturers, types, locations) ───────────────────────────────

export type ListCategory = 'manufacturer' | 'type' | 'location';

export function getListItems(category: ListCategory): string[] {
  return db.getAllSync<{ value: string }>(
    'SELECT value FROM list_items WHERE category = ? ORDER BY value ASC', [category]
  ).map(r => r.value);
}

export function addListItem(category: ListCategory, value: string): void {
  db.runSync(
    'INSERT OR IGNORE INTO list_items (category, value) VALUES (?, ?)', [category, value.trim()]
  );
}

export function deleteListItem(category: ListCategory, value: string): void {
  db.runSync('DELETE FROM list_items WHERE category = ? AND value = ?', [category, value]);
}

export function clearAllData(): void {
  db.execSync('DELETE FROM rolls; DELETE FROM filaments;');
}

// ── Settings ───────────────────────────────────────────────────────────────────

export function getSetting(key: string, defaultValue: string): string {
  const row = db.getFirstSync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
  return row?.value ?? defaultValue;
}

export function setSetting(key: string, value: string): void {
  db.runSync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
  syncSetting(key, value).catch(() => {});
}
