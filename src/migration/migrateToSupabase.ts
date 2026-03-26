import { supabase } from '../lib/supabase';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
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

const PHOTO_BUCKET = 'filament-photos';

async function uploadLocalPhoto(localUri: string, filamentId: string): Promise<string | null> {
  try {
    const compressed = await ImageManipulator.manipulateAsync(
      localUri,
      [{ resize: { width: 1200 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
    );
    const fileName = `filament_${filamentId}_${Date.now()}.jpg`;
    const base64 = await FileSystem.readAsStringAsync(compressed.uri, { encoding: 'base64' as any });
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    const { error } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(fileName, bytes, { contentType: 'image/jpeg', upsert: true });
    if (error) return null;
    return supabase.storage.from(PHOTO_BUCKET).getPublicUrl(fileName).data.publicUrl;
  } catch {
    return null;
  }
}

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

    // Upload photo to Supabase Storage if available
    let photo_url: string | null = null;
    if (f.photo_uri) {
      onProgress(`Uploading photo… (${filamentsDone + 1}/${filaments.length})`);
      photo_url = await uploadLocalPhoto(f.photo_uri, String(filamentsDone));
      if (!photo_url && f.photo_uri) {
        // Upload failed — will be stored as local fallback after we get the Supabase ID
      }
    }

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
        photo_url,
      })
      .select('id')
      .single();

    if (!error && data) {
      setMigrationFilamentSupabaseId(f.id, String(data.id));
      f.supabase_id = String(data.id);
      // If photo upload failed, store local URI as fallback
      if (f.photo_uri && !photo_url) {
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
