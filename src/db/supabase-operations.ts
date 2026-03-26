import { supabase, getCurrentUserId } from '../lib/supabase';
import * as SQLite from 'expo-sqlite';
import { Filament, FilamentSummary, Roll } from '../types';

// SQLite solely for local photo URI storage (photos stay on device)
const db = SQLite.openDatabaseSync('filament.db');
try {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS local_photos (
      filament_id TEXT PRIMARY KEY,
      photo_uri TEXT NOT NULL
    )
  `);
} catch (_) {}

export function getLocalPhotoUri(filamentId: string): string | null {
  const row = db.getFirstSync<{ photo_uri: string }>(
    'SELECT photo_uri FROM local_photos WHERE filament_id = ?', [filamentId]
  );
  return row?.photo_uri ?? null;
}

export function setLocalPhotoUri(filamentId: string, uri: string): void {
  db.runSync(
    'INSERT OR REPLACE INTO local_photos (filament_id, photo_uri) VALUES (?, ?)',
    [filamentId, uri]
  );
}

function deleteLocalPhotoUri(filamentId: string): void {
  db.runSync('DELETE FROM local_photos WHERE filament_id = ?', [filamentId]);
}

// ── Row mappers ────────────────────────────────────────────────────────────────

function mapFilamentSummary(row: any): FilamentSummary {
  const id = String(row.id);
  const rolls: any[] = row.rolls ?? [];
  const active = rolls.filter((r: any) => !r.archived);
  return {
    id,
    manufacturer: row.manufacturer,
    type: row.type,
    color: row.color,
    upc: row.upc ?? '',
    photo_uri: getLocalPhotoUri(id),
    url: row.url ?? null,
    priority: row.priority ?? 'None',
    created_at: row.created_at,
    total_rolls: active.length,
    in_inventory: active.filter((r: any) => !r.is_checked_out).length,
    in_use: active.filter((r: any) => r.is_checked_out).length,
  };
}

function mapRoll(r: any): Roll {
  return {
    id: String(r.id),
    filament_id: String(r.filament_id),
    is_in_use: !!r.is_checked_out,
    archived: !!r.archived,
    created_at: r.created_at,
  };
}

// ── Filaments ──────────────────────────────────────────────────────────────────

export async function getAllFilaments(): Promise<FilamentSummary[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  const { data } = await supabase
    .from('filaments')
    .select('*, rolls(*)')
    .eq('user_id', userId)
    .order('manufacturer', { ascending: true });
  if (!data) return [];
  return data
    .map(mapFilamentSummary)
    .sort((a, b) =>
      a.manufacturer.localeCompare(b.manufacturer) ||
      a.type.localeCompare(b.type) ||
      a.color.localeCompare(b.color)
    );
}

export async function getFilament(id: string): Promise<Filament | null> {
  const { data } = await supabase
    .from('filaments')
    .select('*')
    .eq('id', id)
    .single();
  if (!data) return null;
  const sid = String(data.id);
  return {
    id: sid,
    manufacturer: data.manufacturer,
    type: data.type,
    color: data.color,
    upc: data.upc ?? '',
    photo_uri: getLocalPhotoUri(sid),
    url: data.url ?? null,
    priority: data.priority ?? 'None',
    created_at: data.created_at,
  };
}

export async function getFilamentByUpc(upc: string): Promise<FilamentSummary | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;
  const { data } = await supabase
    .from('filaments')
    .select('*, rolls(*)')
    .eq('user_id', userId)
    .eq('upc', upc)
    .maybeSingle();
  if (!data) return null;
  return mapFilamentSummary(data);
}

export async function getDistinctManufacturers(): Promise<string[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  const { data } = await supabase
    .from('filaments')
    .select('manufacturer')
    .eq('user_id', userId);
  if (!data) return [];
  return [...new Set(data.map((r: any) => r.manufacturer as string))].sort();
}

export async function getDistinctTypes(): Promise<string[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];
  const { data } = await supabase
    .from('filaments')
    .select('type')
    .eq('user_id', userId);
  if (!data) return [];
  return [...new Set(data.map((r: any) => r.type as string))].sort();
}

export async function createFilament(
  manufacturer: string,
  type: string,
  color: string,
  upc: string,
  photo_uri: string | null,
  url: string | null,
  priority: string
): Promise<string | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;
  const { data } = await supabase
    .from('filaments')
    .insert({ user_id: userId, manufacturer, type, color, upc, url, priority, photo_url: null })
    .select('id')
    .single();
  if (!data) return null;
  const sid = String(data.id);
  if (photo_uri) setLocalPhotoUri(sid, photo_uri);
  return sid;
}

export async function updateFilament(
  id: string,
  manufacturer: string,
  type: string,
  color: string,
  upc: string,
  photo_uri: string | null,
  url: string | null,
  priority: string
): Promise<void> {
  await supabase
    .from('filaments')
    .update({ manufacturer, type, color, upc, url, priority })
    .eq('id', id);
  if (photo_uri) {
    setLocalPhotoUri(id, photo_uri);
  } else {
    deleteLocalPhotoUri(id);
  }
}

export async function deleteFilament(id: string): Promise<void> {
  await supabase.from('filaments').delete().eq('id', id);
  deleteLocalPhotoUri(id);
}

export type BulkImportResult = { inserted: number; skipped: number; errors: string[] };

export async function bulkImportFilaments(
  rows: { manufacturer: string; type: string; color: string; upc: string; url: string | null }[]
): Promise<BulkImportResult> {
  const userId = await getCurrentUserId();
  if (!userId) return { inserted: 0, skipped: 0, errors: ['Not signed in'] };

  const result: BulkImportResult = { inserted: 0, skipped: 0, errors: [] };
  for (const row of rows) {
    try {
      if (row.upc) {
        const { data: existing } = await supabase
          .from('filaments')
          .select('id')
          .eq('user_id', userId)
          .eq('upc', row.upc)
          .maybeSingle();
        if (existing) { result.skipped++; continue; }
      }
      const { error } = await supabase
        .from('filaments')
        .insert({ user_id: userId, manufacturer: row.manufacturer, type: row.type, color: row.color, upc: row.upc, url: row.url, priority: 'None', photo_url: null });
      if (error) {
        result.errors.push(`${row.manufacturer} ${row.type} ${row.color}: ${error.message}`);
      } else {
        result.inserted++;
      }
    } catch (e: any) {
      result.errors.push(`${row.manufacturer} ${row.type} ${row.color}: ${e.message}`);
    }
  }
  return result;
}

// ── Rolls ──────────────────────────────────────────────────────────────────────

export async function getRolls(filamentId: string): Promise<Roll[]> {
  const { data } = await supabase
    .from('rolls')
    .select('*')
    .eq('filament_id', filamentId)
    .order('archived', { ascending: true })
    .order('is_checked_out', { ascending: false })
    .order('created_at', { ascending: true });
  if (!data) return [];
  return data.map(mapRoll);
}

export async function createRoll(filamentId: string): Promise<void> {
  await supabase
    .from('rolls')
    .insert({ filament_id: filamentId, is_checked_out: 0, archived: 0 });
}

export async function setRollInUse(id: string): Promise<void> {
  await supabase.from('rolls').update({ is_checked_out: 1 }).eq('id', id);
}

export async function setRollInInventory(id: string): Promise<void> {
  await supabase.from('rolls').update({ is_checked_out: 0 }).eq('id', id);
}

export async function archiveRoll(id: string): Promise<void> {
  await supabase
    .from('rolls')
    .update({ archived: 1, is_checked_out: 0 })
    .eq('id', id);
}

export async function deleteRoll(id: string): Promise<void> {
  await supabase.from('rolls').delete().eq('id', id);
}

// ── Settings ───────────────────────────────────────────────────────────────────

export async function getSetting(key: string, defaultValue: string): Promise<string> {
  const userId = await getCurrentUserId();
  if (!userId) return defaultValue;
  const { data } = await supabase
    .from('filament_settings')
    .select('value')
    .eq('user_id', userId)
    .eq('key', key)
    .maybeSingle();
  return data?.value ?? defaultValue;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;
  await supabase
    .from('filament_settings')
    .upsert({ user_id: userId, key, value }, { onConflict: 'user_id,key' });
}

export async function clearAllData(): Promise<void> {
  const userId = await getCurrentUserId();
  if (!userId) return;
  await supabase.from('filaments').delete().eq('user_id', userId);
  db.execSync('DELETE FROM local_photos');
}
