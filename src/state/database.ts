import Dexie, { type Table } from 'dexie';
import {
  type AppSettings,
  type EdgeRecord,
  type NodeRecord,
  type SpaceRecord,
  type SpaceViewStateRecord
} from './types';

const schemaVersion = 2;

export class MiCaDatabase extends Dexie {
  spaces!: Table<SpaceRecord, string>;
  nodes!: Table<NodeRecord, string>;
  edges!: Table<EdgeRecord, string>;
  spaceViewState!: Table<SpaceViewStateRecord, string>;
  appSettings!: Table<AppSettings, string>;

  constructor() {
    super('mica');
    this.version(1).stores({
      spaces: 'id, name, updatedAt',
      nodes: 'id, spaceId, title, updatedAt',
      edges: 'id, spaceId, from, to',
      views: 'spaceId'
    });

    this.version(schemaVersion)
      .stores({
        spaces: 'id, name, updatedAt',
        nodes: 'id, spaceId, title, updatedAt',
        edges: 'id, spaceId, from, to',
        spaceViewState: 'spaceId',
        appSettings: 'key'
      })
      .upgrade(async (tx) => {
        const legacyViews = await tx.table('views').toArray();
        if (legacyViews.length > 0) {
          await tx.table('spaceViewState').bulkPut(legacyViews);
        }
        await tx.table('appSettings').put({
          key: 'app',
          schemaVersion,
          lastOpenedSpaceId: undefined
        });
      });
  }
}

export const db = new MiCaDatabase();
export const currentSchemaVersion = schemaVersion;
