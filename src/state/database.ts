import Dexie, { type Table } from 'dexie';
import { type EdgeRecord, type NodeRecord, type SpaceRecord, type ViewState } from './types';

const schemaVersion = 1;

export class MiCaDatabase extends Dexie {
  spaces!: Table<SpaceRecord, string>;
  nodes!: Table<NodeRecord, string>;
  edges!: Table<EdgeRecord, string>;
  views!: Table<ViewState & { spaceId: string }, string>;

  constructor() {
    super('mica');
    this.version(schemaVersion).stores({
      spaces: 'id, name, updatedAt',
      nodes: 'id, spaceId, title, updatedAt',
      edges: 'id, spaceId, from, to',
      views: 'spaceId'
    });
  }
}

export const db = new MiCaDatabase();
export const currentSchemaVersion = schemaVersion;
