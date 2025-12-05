import { create } from 'zustand';
import { db, currentSchemaVersion } from './database';
import { buildTemplates, instantiateTemplate } from '../data/templates';
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
  renameSpace: (spaceId: string, name: string) => Promise<void>;
  deleteSpace: (spaceId: string) => Promise<void>;
  createNode: (payload: { parentId?: string; title: string }) => Promise<NodeRecord | undefined>;
  updateNode: (nodeId: string, updates: Partial<NodeRecord>) => Promise<void>;
  deleteNode: (nodeId: string) => Promise<void>;
  linkNodes: (fromId: string, toId: string, relation?: string) => Promise<void>;
  updateView: (view: Partial<ViewState>) => Promise<void>;
  selectNode: (nodeId?: string) => void;
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
    const template = instantiateTemplate(templateName) ?? instantiateTemplate('Blank Space');
    if (!template) return;
    await db.transaction('rw', [db.spaces, db.nodes, db.edges, db.views], async () => {
      await db.spaces.add(template.space);
      await db.nodes.bulkAdd(template.nodes);
      await db.edges.bulkAdd(template.edges);
      await db.views.put({ ...template.space.view, spaceId: template.space.id });
    });
    const spaces = await db.spaces.toArray();
    set({ spaces });
    await get().setActiveSpace(template.space.id);
  },
  renameSpace: async (spaceId, name) => {
    await db.spaces.update(spaceId, { name, updatedAt: Date.now() });
    const spaces = await db.spaces.toArray();
    set({ spaces });
  },
  deleteSpace: async (spaceId) => {
    await db.transaction('rw', [db.spaces, db.nodes, db.edges, db.views], async () => {
      await db.spaces.delete(spaceId);
      await db.nodes.where({ spaceId }).delete();
      await db.edges.where({ spaceId }).delete();
      await db.views.delete(spaceId);
    });
    const spaces = await db.spaces.toArray();
    const nextActive = spaces[0]?.id;
    const nodes = nextActive ? await db.nodes.where({ spaceId: nextActive }).toArray() : [];
    const edges = nextActive ? await db.edges.where({ spaceId: nextActive }).toArray() : [];
    const view = nextActive ? (await db.views.get(nextActive)) ?? defaultViewState : defaultViewState;
    set({ spaces, activeSpaceId: nextActive, nodes, edges, selectedNodeId: undefined, view });
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
      .filter(
        (node) =>
          node.title.toLowerCase().includes(lower) ||
          node.blocks.some((block) => block.type === 'markdown' && block.text.toLowerCase().includes(lower))
      )
      .slice(0, 8)
      .map((node) => ({
        id: node.id,
        title: node.title,
        snippet: node.blocks.find((block) => block.type === 'markdown' && block.text.toLowerCase().includes(lower))?.
          text.slice(0, 120) ?? node.title
      }));
  },
  exportAll: async () => {
    const [spaces, nodes, edges, views] = await Promise.all([
      db.spaces.toArray(),
      db.nodes.toArray(),
      db.edges.toArray(),
      db.views.toArray()
    ]);
    return JSON.stringify(
      {
        schemaVersion: currentSchemaVersion,
        exportedAt: Date.now(),
        spaces,
        nodes,
        edges,
        views
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
      db.views.get(spaceId)
    ]);
    return JSON.stringify(
      {
        schemaVersion: currentSchemaVersion,
        exportedAt: Date.now(),
        spaces: space ? [space] : [],
        nodes,
        edges,
        views: view ? [view] : []
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
    };
    const spaces = data.spaces ?? [];
    if (spaces.length === 0) return undefined;

    let addedSpaces = 0;
    let addedNodes = 0;
    let addedEdges = 0;

    await db.transaction('rw', [db.spaces, db.nodes, db.edges, db.views], async () => {
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

        const view = (data.views ?? []).find((entry) => entry.spaceId === space.id);
        await db.views.put({ ...(view ?? defaultViewState), spaceId: newSpaceId });
      }
    });

    const refreshedSpaces = await db.spaces.toArray();
    set({ spaces: refreshedSpaces });
    return { addedSpaces, addedNodes, addedEdges };
  }
}));
