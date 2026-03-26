import * as SQLite from 'expo-sqlite';
import { supabase } from '../lib/supabase';
import { getSetting, setSetting } from '../db/database';

const db = SQLite.openDatabaseSync('filament.db');

export type MigrationStatus =
  | { state: 'idle' }
  | { state: 'running'; progress: string }
  | { state: 'done' }
  | { state: 'error'; message: string };

export async function migrateToSupabase(
  userId: string,
  onProgress: (msg: string) => void
): Promise<void> {
  // Already migrated — skip
  if (getSetting('supabase_migrated', '0') === '1') return;

  onProgress('Reading local data…');

  const filaments = db.getAllSync<{
    id: number; manufacturer: string; type: string; color: string;
    upc: string; url: string | null; priority: string;
    supabase_id: string | null;
  }>('SELECT id, manufacturer, type, color, upc, url, priority, supabase_id FROM filaments');

  const rolls = db.getAllSync<{
    id: number; filament_id: number;
    is_checked_out: number; archived: number;
    supabase_id: string | null;
  }>('SELECT id, filament_id, is_checked_out, archived, supabase_id FROM rolls');

  const settings = db.getAllSync<{ key: string; value: string }>(
    'SELECT key, value FROM settings'
  );

  // ── Migrate filaments ──────────────────────────────────────────────────────
  let filamentsDone = 0;
  for (const f of filaments) {
    if (f.supabase_id) { filamentsDone++; continue; } // already synced

    onProgress(`Migrating filaments… (${filamentsDone + 1}/${filaments.length})`);

    const { data, error } = await supabase.from('filaments')
      .insert({
        user_id: userId,
        manufacturer: f.manufacturer,
        type: f.type,
        color: f.color,
        upc: f.upc,
        url: f.url,
        priority: f.priority,
        photo_url: null, // local file paths can't be synced
      })
      .select('id').single();

    if (!error && data) {
      db.runSync('UPDATE filaments SET supabase_id = ? WHERE id = ?', [String(data.id), f.id]);
      f.supabase_id = String(data.id); // update in-memory for roll migration below
    }
    filamentsDone++;
  }

  // ── Migrate rolls ──────────────────────────────────────────────────────────
  // Build local→supabase filament id map
  const filamentIdMap = new Map<number, string>();
  for (const f of filaments) {
    if (f.supabase_id) filamentIdMap.set(f.id, f.supabase_id);
  }

  let rollsDone = 0;
  for (const r of rolls) {
    if (r.supabase_id) { rollsDone++; continue; }

    const supabaseFilamentId = filamentIdMap.get(r.filament_id);
    if (!supabaseFilamentId) { rollsDone++; continue; }

    onProgress(`Migrating rolls… (${rollsDone + 1}/${rolls.length})`);

    const { data, error } = await supabase.from('rolls')
      .insert({
        filament_id: parseInt(supabaseFilamentId),
        is_checked_out: r.is_checked_out,
        archived: r.archived,
      })
      .select('id').single();

    if (!error && data) {
      db.runSync('UPDATE rolls SET supabase_id = ? WHERE id = ?', [String(data.id), r.id]);
    }
    rollsDone++;
  }

  // ── Migrate settings ───────────────────────────────────────────────────────
  onProgress('Syncing settings…');
  for (const s of settings) {
    await supabase.from('filament_settings')
      .upsert({ user_id: userId, key: s.key, value: s.value }, { onConflict: 'user_id,key' });
  }

  // ── Done ───────────────────────────────────────────────────────────────────
  setSetting('supabase_migrated', '1');
  onProgress('Migration complete!');
}
