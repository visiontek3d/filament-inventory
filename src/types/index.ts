export type FilamentPriority = 'None' | 'Low' | 'Medium' | 'High';

export interface Filament {
  id: string;  // Supabase UUID
  manufacturer: string;
  type: string;
  color: string;
  upc: string;
  photo_uri: string | null;  // local device path
  url: string | null;
  priority: FilamentPriority;
  created_at: string;
}

export interface Roll {
  id: string;  // Supabase UUID
  filament_id: string;
  is_in_use: boolean;
  archived: boolean;
  created_at: string;
}

export interface FilamentSummary extends Filament {
  total_rolls: number;
  in_inventory: number;
  in_use: number;
}

export type RootStackParamList = {
  FilamentList: undefined;
  FilamentDetail: { filamentId: string };
  AddEditFilament: { filamentId?: string; initialUpc?: string };
  AddEditRoll: { filamentId: string };
  Scan: undefined;
  BulkImport: undefined;
  Settings: undefined;
};
