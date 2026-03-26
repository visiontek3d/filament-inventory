/**
 * Background sync helpers — fire-and-forget Supabase writes.
 * These are called after every local SQLite mutation.
 * Failures are silently swallowed so the app always stays functional offline.
 */
import { supabase, getCurrentUserId } from '../lib/supabase';
import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('filament.db');

// ── Filaments ─────────────────────────────────────────────────────────────────

export async function syncCreateFilament(localId: number, data: {
  manufacturer: string; type: string; color: string;
  upc: string; url: string | null; priority: string;
}): Promise<void> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return;
    const { data: row, error } = await supabase.from('filaments')
      .insert({ user_id: userId, ...data, photo_url: null })
      .select('id').single();
    if (!error && row) {
      db.runSync('UPDATE filaments SET supabase_id = ? WHERE id = ?', [String(row.id), localId]);
    }
  } catch (_) {}
}

export async function syncUpdateFilament(supabaseId: string, data: {
  manufacturer: string; type: string; color: string;
  upc: string; url: string | null; priority: string;
}): Promise<void> {
  try {
    await supabase.from('filaments').update(data).eq('id', supabaseId);
  } catch (_) {}
}

export async function syncDeleteFilament(supabaseId: string): Promise<void> {
  try {
    await supabase.from('filaments').delete().eq('id', supabaseId);
  } catch (_) {}
}

// ── Rolls ─────────────────────────────────────────────────────────────────────

export async function syncCreateRoll(localId: number, localFilamentId: number): Promise<void> {
  try {
    const filament = db.getFirstSync<{ supabase_id: string | null }>(
      'SELECT supabase_id FROM filaments WHERE id = ?', [localFilamentId]
    );
    if (!filament?.supabase_id) return;
    const { data: row, error } = await supabase.from('rolls')
      .insert({ filament_id: parseInt(filament.supabase_id), is_checked_out: 0, archived: 0 })
      .select('id').single();
    if (!error && row) {
      db.runSync('UPDATE rolls SET supabase_id = ? WHERE id = ?', [String(row.id), localId]);
    }
  } catch (_) {}
}

export async function syncUpdateRoll(supabaseId: string, data: {
  is_checked_out?: number; archived?: number;
}): Promise<void> {
  try {
    await supabase.from('rolls').update(data).eq('id', supabaseId);
  } catch (_) {}
}

export async function syncDeleteRoll(supabaseId: string): Promise<void> {
  try {
    await supabase.from('rolls').delete().eq('id', supabaseId);
  } catch (_) {}
}

// ── Settings ──────────────────────────────────────────────────────────────────

export async function syncSetting(key: string, value: string): Promise<void> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return;
    await supabase.from('filament_settings')
      .upsert({ user_id: userId, key, value }, { onConflict: 'user_id,key' });
  } catch (_) {}
}
