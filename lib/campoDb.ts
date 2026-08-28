import Dexie, { type Table } from 'dexie';

export interface LocalCaptura {
  local_id: string;
  mision_id: string;
  tipo: 'foto' | 'audio' | 'texto' | 'muestra';
  latitud: number | null;
  longitud: number | null;
  notas: string;
  campos_datos: Record<string, unknown>;
  content_url: string | null;
  timestamp: string;
  synced: boolean;
  created_at: number;
}

class CampoDatabase extends Dexie {
  capturas!: Table<LocalCaptura, string>;

  constructor() {
    super('CampoDB');
    this.version(1).stores({
      capturas: 'local_id, mision_id, synced, created_at',
    });
  }
}

export const campoDb = new CampoDatabase();

export async function getPendingCount(): Promise<number> {
  return campoDb.capturas.filter((c) => !c.synced).count();
}

export async function getPendingCapturas(): Promise<LocalCaptura[]> {
  return campoDb.capturas.filter((c) => !c.synced).toArray();
}

export async function saveCaptura(captura: Omit<LocalCaptura, 'local_id' | 'created_at' | 'synced'>): Promise<string> {
  const local_id = `cap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await campoDb.capturas.add({ ...captura, local_id, synced: false, created_at: Date.now() });
  return local_id;
}

export async function markSynced(local_id: string): Promise<void> {
  await campoDb.capturas.update(local_id, { synced: true });
}
