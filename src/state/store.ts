import { create } from 'zustand';
import { db, currentSchemaVersion } from './database';
import { buildTemplates, instantiateTemplate } from '../data/templates';
import { nanoid } from '../utils/nanoid';
import {
  type ContentBlock,
  type AppMode,
  type AppSettings,
  type EdgeRecord,
  type MarkdownBlock,
  type NodeRecord,
  type SearchResult,
  type SpaceRecord,
  type SpaceViewStateRecord,
  type ViewState
} from './types';

interface MiCaState {
  initialized: boolean;
  appMode: AppMode;
  spaces: SpaceRecord[];
  nodes: NodeRecord[];
  edges: EdgeRecord[];
  activeSpaceId?: string;
  selectedNodeId?: string;
  searchQuery: string;
  view: ViewState;
  appSettings: AppSettings;
  hush: number;
  hushTarget: number;
  init: () => Promise<void>;
  setActiveSpace: (spaceId: string) => Promise<void>;
  setAppMode: (mode: AppMode) => void;
  addSpaceFromTemplate: (templateName: string, overrides?: Partial<SpaceRecord>) => Promise<string | undefined>;
  renameSpace: (spaceId: string, name: string) => Promise<void>;
  deleteSpace: (spaceId: string) => Promise<void>;
  createNode: (payload: { parentId?: string; title: string }) => Promise<NodeRecord | undefined>;
  updateNode: (nodeId: string, updates: Partial<NodeRecord>) => Promise<void>;
  deleteNode: (nodeId: string) => Promise<void>;
  linkNodes: (fromId: string, toId: string, relation?: string) => Promise<void>;
  updateView: (view: Partial<ViewState>) => Promise<void>;
  resetView: () => Promise<void>;
  selectNode: (nodeId?: string) => void;
  stepHush: (delta: number) => void;
  search: (query: string) => SearchResult[];
  exportAll: () => Promise<string>;
  exportSpace: (spaceId: string) => Promise<string>;
  importData: (payload: unknown) => Promise<{ addedSpaces: number; addedNodes: number; addedEdges: number } | undefined>;
}

const defaultViewState: ViewState = {
  camera: {
    position: [8, 6, 10],
    target: [0, 0, 0]
  },
  environment: 'dome',
  edgeVisibility: 'neighborhood',
  mode: 'observe'
};

const defaultAppSettings: AppSettings = {
  key: 'app',
  schemaVersion: currentSchemaVersion,
  lastOpenedSpaceId: undefined
};

const isMarkdownBlock = (block: ContentBlock): block is MarkdownBlock =>
  block.type === 'markdown';

export const useMiCa = create<MiCaState>((set, get) => ({
  initialized: false,
  appMode: 'HOME_3D',
  spaces: [],
  nodes: [],
  edges: [],
  activeSpaceId: undefined,
  selectedNodeId: undefined,
  searchQuery: '',
  view: defaultViewState,
  appSettings: defaultAppSettings,
  hush: 1,
  hushTarget: 1,
  init: async () => {
    let appSettings = (await db.appSettings.get('app')) ?? defaultAppSettings;

    const spaceCount = await db.spaces.count();
    if (spaceCount === 0) {
      const payload = buildTemplates();
      await db.transaction('rw', [db.spaces, db.nodes, db.edges, db.spaceViewState, db.appSettings], async () => {
        await db.spaces.bulkAdd(payload.spaces);
        await db.nodes.bulkAdd(payload.nodes);
        await db.edges.bulkAdd(payload.edges);
        await db.spaceViewState.bulkPut(payload.viewStates);
        appSettings = {
          ...defaultAppSettings,
          lastOpenedSpaceId: payload.spaces[0]?.id
        };
        await db.appSettings.put(appSettings);
      });
    }

    if (appSettings.schemaVersion !== currentSchemaVersion) {
      appSettings = { ...appSettings, schemaVersion: currentSchemaVersion };
      await db.appSettings.put(appSettings);
    }

    const spaces = await db.spaces.toArray();
    const activeSpaceId = appSettings.lastOpenedSpaceId && spaces.some((s) => s.id === appSettings.lastOpenedSpaceId)
      ? appSettings.lastOpenedSpaceId
      : spaces[0]?.id;
    const nodes = activeSpaceId ? await db.nodes.where({ spaceId: activeSpaceId }).toArray() : [];
    const edges = activeSpaceId ? await db.edges.where({ spaceId: activeSpaceId }).toArray() : [];
    const viewRecord = activeSpaceId ? await db.spaceViewState.get(activeSpaceId) : undefined;

    const nextSettings: AppSettings = {
      ...appSettings,
      lastOpenedSpaceId: activeSpaceId
    };
    await db.appSettings.put(nextSettings);

    set({
      initialized: true,
      spaces,
      activeSpaceId,
      nodes,
      edges,
      view: viewRecord ?? defaultViewState,
      appMode: 'HOME_3D',
      appSettings: nextSettings,
      hushTarget: (viewRecord ?? defaultViewState).mode === 'observe' ? 1 : 0
    });
  },
  setActiveSpace: async (spaceId) => {
    const nodes = await db.nodes.where({ spaceId }).toArray();
    const edges = await db.edges.where({ spaceId }).toArray();
    const view = (await db.spaceViewState.get(spaceId)) ?? defaultViewState;
    const nextSettings: AppSettings = {
      key: 'app',
      schemaVersion: currentSchemaVersion,
      lastOpenedSpaceId: spaceId
    };
    await db.appSettings.put(nextSettings);
    set({
      activeSpaceId: spaceId,
      nodes,
      edges,
      selectedNodeId: undefined,
      view,
      appSettings: nextSettings,
      hushTarget: (view.mode ?? 'observe') === 'observe' ? 1 : 0
    });
  },
  setAppMode: (mode) => set({ appMode: mode }),
  addSpaceFromTemplate: async (templateName, overrides) => {
    const template = instantiateTemplate(templateName) ?? instantiateTemplate('Blank Space');
    if (!template) return undefined;
    const space = { ...template.space, ...overrides } as SpaceRecord;
    const viewState: SpaceViewStateRecord = { ...(template.viewState ?? template.space.view), spaceId: space.id };
    await db.transaction('rw', [db.spaces, db.nodes, db.edges, db.spaceViewState], async () => {
      await db.spaces.add(space);
      await db.nodes.bulkAdd(template.nodes.map((node) => ({ ...node, spaceId: space.id })));
      await db.edges.bulkAdd(template.edges.map((edge) => ({ ...edge, spaceId: space.id })));
      await db.spaceViewState.put(viewState);
    });
    const spaces = await db.spaces.toArray();
    set({ spaces });
    await get().setActiveSpace(space.id);
    return space.id;
  },
  renameSpace: async (spaceId, name) => {
    await db.spaces.update(spaceId, { name, updatedAt: Date.now() });
    const spaces = await db.spaces.toArray();
    set({ spaces });
  },
  deleteSpace: async (spaceId) => {
    await db.transaction('rw', [db.spaces, db.nodes, db.edges, db.spaceViewState, db.appSettings], async () => {
      await db.spaces.delete(spaceId);
      await db.nodes.where({ spaceId }).delete();
      await db.edges.where({ spaceId }).delete();
      await db.spaceViewState.delete(spaceId);
    });
    const spaces = await db.spaces.toArray();
    const nextActive = spaces[0]?.id;
    const nodes = nextActive ? await db.nodes.where({ spaceId: nextActive }).toArray() : [];
    const edges = nextActive ? await db.edges.where({ spaceId: nextActive }).toArray() : [];
    const view = nextActive
      ? (await db.spaceViewState.get(nextActive)) ?? defaultViewState
      : defaultViewState;
    const nextSettings: AppSettings = {
      key: 'app',
      schemaVersion: currentSchemaVersion,
      lastOpenedSpaceId: nextActive
    };
    await db.appSettings.put(nextSettings);
    set({
      spaces,
      activeSpaceId: nextActive,
      nodes,
      edges,
      selectedNodeId: undefined,
      view,
      appSettings: nextSettings,
      hushTarget: (view.mode ?? 'observe') === 'observe' ? 1 : 0
    });
  },
  createNode: async ({ parentId, title }) => {
    const state = get();
    if (!state.activeSpaceId) return undefined;
    const basePosition = parentId
      ? state.nodes.find((node) => node.id === parentId)?.position ?? { x: 0, y: 0, z: 0 }
      : { x: 0, y: 0, z: 0 };
    const offset = () => (Math.random() - 0.5) * 1.5;
    const node: NodeRecord = {
      id: nanoid(),
      spaceId: state.activeSpaceId,
      title: title.trim() || 'New Thought',
      tags: [],
      importance: 3,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      position: {
        x: basePosition.x + offset(),
        y: basePosition.y + offset(),
        z: basePosition.z + offset()
      },
      blocks: [
        {
          id: nanoid(),
          type: 'markdown',
          text: 'Describe this thought.'
        }
      ]
    };
    await db.nodes.add(node);
    const nodes = await db.nodes.where({ spaceId: state.activeSpaceId }).toArray();
    set({ nodes, selectedNodeId: node.id });
    if (parentId) {
      await get().linkNodes(parentId, node.id, 'child');
    }
    return node;
  },
  updateNode: async (nodeId, updates) => {
    const state = get();
    const existing = state.nodes.find((node) => node.id === nodeId);
    if (!existing) return;
    const nextNode = { ...existing, ...updates, updatedAt: Date.now() } as NodeRecord;
    await db.nodes.put(nextNode);
    const nodes = state.nodes.map((node) => (node.id === nodeId ? nextNode : node));
    set({ nodes });
  },
  deleteNode: async (nodeId) => {
    const state = get();
    if (!state.activeSpaceId) return;
    await db.transaction('rw', [db.nodes, db.edges], async () => {
      await db.nodes.delete(nodeId);
      await db.edges.where({ spaceId: state.activeSpaceId }).filter((edge) => edge.from === nodeId || edge.to === nodeId).delete();
    });
    const nodes = await db.nodes.where({ spaceId: state.activeSpaceId }).toArray();
    const edges = await db.edges.where({ spaceId: state.activeSpaceId }).toArray();
    set({ nodes, edges, selectedNodeId: nodes[0]?.id });
  },
  linkNodes: async (fromId, toId, relation) => {
    const state = get();
    if (!state.activeSpaceId || fromId === toId) return;
    const exists = state.edges.some(
      (edge) => edge.from === fromId && edge.to === toId && edge.relation === relation
    );
    if (exists) return;
    const edge: EdgeRecord = {
      id: nanoid(),
      spaceId: state.activeSpaceId,
      from: fromId,
      to: toId,
      relation
    };
    await db.edges.add(edge);
    const edges = await db.edges.where({ spaceId: state.activeSpaceId }).toArray();
    set({ edges });
  },
  updateView: async (view) => {
    const state = get();
    if (!state.activeSpaceId) return;
    const nextView: ViewState = {
      ...state.view,
      ...view,
      camera: view.camera ?? state.view.camera,
      mode: view.mode ?? state.view.mode ?? 'observe'
    };
    await db.spaceViewState.put({ ...nextView, spaceId: state.activeSpaceId });
    set({ view: nextView, hushTarget: nextView.mode === 'observe' ? 1 : 0 });
  },
  resetView: async () => {
    const state = get();
    if (!state.activeSpaceId) return;
    const fallbackView =
      state.spaces.find((space) => space.id === state.activeSpaceId)?.view ?? defaultViewState;
    await db.spaceViewState.put({ ...fallbackView, spaceId: state.activeSpaceId });
    set({
      view: fallbackView,
      hushTarget: (fallbackView.mode ?? 'observe') === 'observe' ? 1 : 0
    });
  },
  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),
  stepHush: (delta) => {
    const { hush, hushTarget } = get();
    const next = hush + (hushTarget - hush) * Math.min(1, delta * 2.5);
    set({ hush: next });
  },
  search: (query) => {
    set({ searchQuery: query });
    const { nodes, activeSpaceId } = get();
    if (!query.trim() || !activeSpaceId) return [];
    const lower = query.toLowerCase();
    return nodes
      .filter((node) => {
        const matchesTitle = node.title.toLowerCase().includes(lower);
        const matchesContent = node.blocks.some(
          (block) => isMarkdownBlock(block) && block.text.toLowerCase().includes(lower)
        );
        return matchesTitle || matchesContent;
      })
      .slice(0, 8)
      .map((node) => {
        const matchingBlock = node.blocks.find(
          (block): block is MarkdownBlock =>
            isMarkdownBlock(block) && block.text.toLowerCase().includes(lower)
        );
        return {
          id: node.id,
          title: node.title,
          snippet: matchingBlock?.text.slice(0, 120) ?? node.title
        };
      });
  },
  exportAll: async () => {
    const [spaces, nodes, edges, viewStates, appSettings] = await Promise.all([
      db.spaces.toArray(),
      db.nodes.toArray(),
      db.edges.toArray(),
      db.spaceViewState.toArray(),
      db.appSettings.toArray()
    ]);
    return JSON.stringify(
      {
        schemaVersion: currentSchemaVersion,
        exportedAt: Date.now(),
        spaces,
        nodes,
        edges,
        spaceViewState: viewStates,
        appSettings
      },
      null,
      2
    );
  },
  exportSpace: async (spaceId) => {
    const [space, nodes, edges, view] = await Promise.all([
      db.spaces.get(spaceId),
      db.nodes.where({ spaceId }).toArray(),
      db.edges.where({ spaceId }).toArray(),
      db.spaceViewState.get(spaceId)
    ]);
    return JSON.stringify(
      {
        schemaVersion: currentSchemaVersion,
        exportedAt: Date.now(),
        spaces: space ? [space] : [],
        nodes,
        edges,
        spaceViewState: view ? [view] : []
      },
      null,
      2
    );
  },
  importData: async (payload) => {
    if (!payload || typeof payload !== 'object') return undefined;
    const data = payload as {
      spaces?: SpaceRecord[];
      nodes?: NodeRecord[];
      edges?: EdgeRecord[];
      views?: (ViewState & { spaceId: string })[];
      spaceViewState?: SpaceViewStateRecord[];
      appSettings?: AppSettings[];
    };
    const spaces = data.spaces ?? [];
    if (spaces.length === 0) return undefined;

    let addedSpaces = 0;
    let addedNodes = 0;
    let addedEdges = 0;

    await db.transaction('rw', [db.spaces, db.nodes, db.edges, db.spaceViewState, db.appSettings], async () => {
      for (const space of spaces) {
        const newSpaceId = nanoid();
        const nodeMap = new Map<string, string>();
        const clonedSpace: SpaceRecord = {
          ...space,
          id: newSpaceId,
          name: `${space.name} (imported)`,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        await db.spaces.add(clonedSpace);
        addedSpaces += 1;

        const relatedNodes = (data.nodes ?? []).filter((node) => node.spaceId === space.id);
        for (const node of relatedNodes) {
          const newNodeId = nanoid();
          nodeMap.set(node.id, newNodeId);
          const nextNode: NodeRecord = {
            ...node,
            id: newNodeId,
            spaceId: newSpaceId,
            createdAt: Date.now(),
            updatedAt: Date.now()
          };
          await db.nodes.add(nextNode);
          addedNodes += 1;
        }

        const relatedEdges = (data.edges ?? []).filter((edge) => edge.spaceId === space.id);
        for (const edge of relatedEdges) {
          const mappedFrom = nodeMap.get(edge.from);
          const mappedTo = nodeMap.get(edge.to);
          if (!mappedFrom || !mappedTo) continue;
          const nextEdge: EdgeRecord = {
            ...edge,
            id: nanoid(),
            spaceId: newSpaceId,
            from: mappedFrom,
            to: mappedTo
          };
          await db.edges.add(nextEdge);
          addedEdges += 1;
        }

        const view = (data.spaceViewState ?? data.views ?? []).find((entry) => entry.spaceId === space.id);
        await db.spaceViewState.put({ ...(view ?? defaultViewState), spaceId: newSpaceId });
      }
      const incomingSettings = (data.appSettings ?? []).find((entry) => entry.key === 'app');
      const mergedSettings: AppSettings = {
        key: 'app',
        schemaVersion: currentSchemaVersion,
        lastOpenedSpaceId: incomingSettings?.lastOpenedSpaceId
      };
      await db.appSettings.put(mergedSettings);
    });

    const refreshedSpaces = await db.spaces.toArray();
    const nextSettings = (await db.appSettings.get('app')) ?? defaultAppSettings;
    set({ spaces: refreshedSpaces, appSettings: nextSettings });
    return { addedSpaces, addedNodes, addedEdges };
  }
}));
