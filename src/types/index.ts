export type FilamentPriority = 'None' | 'Low' | 'Medium' | 'High';

export interface Filament {
  id: number;
  manufacturer: string;
  type: string;
  color: string;
  upc: string;
  photo_uri: string | null;
  url: string | null;
  priority: FilamentPriority;
  created_at: string;
}

export interface Roll {
  id: number;
  filament_id: number;
  is_in_use: number;  // 0 = Inventory, 1 = In Use
  archived: number;   // 1 = empty spool, excluded from counts
  created_at: string;
}

export interface FilamentSummary extends Filament {
  total_rolls: number;
  in_inventory: number;
  in_use: number;
}

export type RootStackParamList = {
  FilamentList: undefined;
  FilamentDetail: { filamentId: number };
  AddEditFilament: { filamentId?: number; initialUpc?: string };
  AddEditRoll: { filamentId: number };
  Scan: undefined;
  BulkImport: undefined;
  Settings: undefined;
};
