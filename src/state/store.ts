import { create } from 'zustand';
import { db } from './database';
import { buildTemplates } from '../data/templates';
import { nanoid } from '../utils/nanoid';
import {
  type EdgeRecord,
  type NodeRecord,
  type SearchResult,
  type SpaceRecord,
  type ViewState
} from './types';

interface MiCaState {
  initialized: boolean;
  spaces: SpaceRecord[];
  nodes: NodeRecord[];
  edges: EdgeRecord[];
  activeSpaceId?: string;
  selectedNodeId?: string;
  searchQuery: string;
  view: ViewState;
  init: () => Promise<void>;
  setActiveSpace: (spaceId: string) => Promise<void>;
  addSpaceFromTemplate: (templateName: string) => Promise<void>;
  updateView: (view: Partial<ViewState>) => Promise<void>;
  selectNode: (nodeId?: string) => void;
  search: (query: string) => SearchResult[];
}

const defaultViewState: ViewState = {
  camera: {
    position: [8, 6, 10],
    target: [0, 0, 0]
  },
  environment: 'dome',
  edgeVisibility: 'neighborhood'
};

export const useMiCa = create<MiCaState>((set, get) => ({
  initialized: false,
  spaces: [],
  nodes: [],
  edges: [],
  activeSpaceId: undefined,
  selectedNodeId: undefined,
  searchQuery: '',
  view: defaultViewState,
  init: async () => {
    const spaceCount = await db.spaces.count();
    if (spaceCount === 0) {
      const payload = buildTemplates();
      await db.transaction('rw', [db.spaces, db.nodes, db.edges, db.views], async () => {
        await db.spaces.bulkAdd(payload.spaces);
        await db.nodes.bulkAdd(payload.nodes);
        await db.edges.bulkAdd(payload.edges);
        await Promise.all(
          payload.spaces.map((space) =>
            db.views.put({ ...space.view, spaceId: space.id })
          )
        );
      });
    }
    const spaces = await db.spaces.toArray();
    const activeSpaceId = spaces[0]?.id;
    const nodes = activeSpaceId ? await db.nodes.where({ spaceId: activeSpaceId }).toArray() : [];
    const edges = activeSpaceId ? await db.edges.where({ spaceId: activeSpaceId }).toArray() : [];
    const viewRecord = activeSpaceId ? await db.views.get(activeSpaceId) : undefined;
    set({
      initialized: true,
      spaces,
      activeSpaceId,
      nodes,
      edges,
      view: viewRecord ?? defaultViewState
    });
  },
  setActiveSpace: async (spaceId) => {
    const nodes = await db.nodes.where({ spaceId }).toArray();
    const edges = await db.edges.where({ spaceId }).toArray();
    const view = (await db.views.get(spaceId)) ?? defaultViewState;
    set({ activeSpaceId: spaceId, nodes, edges, selectedNodeId: undefined, view });
  },
  addSpaceFromTemplate: async (templateName) => {
    const spaceId = nanoid();
    const timestamp = Date.now();
    const space: SpaceRecord = {
      id: spaceId,
      name: templateName,
      icon: '🌌',
      createdAt: timestamp,
      updatedAt: timestamp,
      view: { ...defaultViewState }
    };
    await db.spaces.add(space);
    await db.views.put({ ...space.view, spaceId });
    const spaces = await db.spaces.toArray();
    set({ spaces });
    await get().setActiveSpace(spaceId);
  },
  updateView: async (view) => {
    const state = get();
    if (!state.activeSpaceId) return;
    const nextView: ViewState = {
      ...state.view,
      ...view,
      camera: view.camera ?? state.view.camera
    };
    await db.views.put({ ...nextView, spaceId: state.activeSpaceId });
    set({ view: nextView });
  },
  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),
  search: (query) => {
    set({ searchQuery: query });
    const { nodes, activeSpaceId } = get();
    if (!query.trim() || !activeSpaceId) return [];
    const lower = query.toLowerCase();
    return nodes
      .filter((node) => node.title.toLowerCase().includes(lower) ||
        node.blocks.some((block) => block.type === 'markdown' && block.text.toLowerCase().includes(lower)))
      .slice(0, 8)
      .map((node) => ({
        id: node.id,
        title: node.title,
        snippet: node.title
      }));
  }
}));
