import { supabase } from '../lib/supabase';
import {
  getSetting,
  setSetting,
  getMigrationFilaments,
  getMigrationRolls,
  getMigrationSettings,
  setMigrationFilamentSupabaseId,
  setMigrationRollSupabaseId,
  setMigrationLocalPhoto,
} from '../db/database';

export async function migrateToSupabase(
  userId: string,
  onProgress: (msg: string) => void
): Promise<void> {
  if (getSetting('supabase_migrated', '0') === '1') return;

  onProgress('Reading local data…');

  const filaments = getMigrationFilaments();
  const rolls = getMigrationRolls();
  const settings = getMigrationSettings();

  // ── Migrate filaments ──────────────────────────────────────────────────────
  let filamentsDone = 0;
  for (const f of filaments) {
    if (f.supabase_id) { filamentsDone++; continue; }

    onProgress(`Migrating filaments… (${filamentsDone + 1}/${filaments.length})`);

    const { data, error } = await supabase
      .from('filaments')
      .insert({
        user_id: userId,
        manufacturer: f.manufacturer,
        type: f.type,
        color: f.color,
        upc: f.upc,
        url: f.url,
        priority: f.priority,
        photo_url: null,
      })
      .select('id')
      .single();

    if (!error && data) {
      setMigrationFilamentSupabaseId(f.id, String(data.id));
      f.supabase_id = String(data.id);
      // Preserve local photo URI mapped to Supabase ID
      if (f.photo_uri) {
        setMigrationLocalPhoto(String(data.id), f.photo_uri);
      }
    }
    filamentsDone++;
  }

  // ── Migrate rolls ──────────────────────────────────────────────────────────
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

    const { data, error } = await supabase
      .from('rolls')
      .insert({
        filament_id: supabaseFilamentId,
        is_checked_out: r.is_checked_out,
        archived: r.archived,
      })
      .select('id')
      .single();

    if (!error && data) {
      setMigrationRollSupabaseId(r.id, String(data.id));
    }
    rollsDone++;
  }

  // ── Migrate settings ───────────────────────────────────────────────────────
  onProgress('Syncing settings…');
  for (const s of settings) {
    await supabase
      .from('filament_settings')
      .upsert({ user_id: userId, key: s.key, value: s.value }, { onConflict: 'user_id,key' });
  }

  setSetting('supabase_migrated', '1');
  onProgress('Migration complete!');
}
