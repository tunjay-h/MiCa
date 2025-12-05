import { nanoid } from '../utils/nanoid';
import { type EdgeRecord, type NodeRecord, type SpaceRecord, type ViewState } from '../state/types';

interface TemplatePayload {
  spaces: SpaceRecord[];
  nodes: NodeRecord[];
  edges: EdgeRecord[];
}

const defaultView = (): ViewState => ({
  camera: {
    position: [8, 6, 10],
    target: [0, 0, 0]
  },
  environment: 'dome',
  edgeVisibility: 'neighborhood'
});

const createNode = (
  spaceId: string,
  title: string,
  position: [number, number, number],
  blocks: NodeRecord['blocks'],
  tags: string[] = [],
  importance: NodeRecord['importance'] = 3
): NodeRecord => {
  const id = nanoid();
  const timestamp = Date.now();
  return {
    id,
    spaceId,
    title,
    tags,
    importance,
    createdAt: timestamp,
    updatedAt: timestamp,
    position: { x: position[0], y: position[1], z: position[2] },
    blocks
  };
};

const connect = (spaceId: string, from: NodeRecord, to: NodeRecord, relation?: string): EdgeRecord => ({
  id: nanoid(),
  spaceId,
  from: from.id,
  to: to.id,
  relation
});

export const buildTemplates = (): TemplatePayload => {
  const spaces: SpaceRecord[] = [];
  const nodes: NodeRecord[] = [];
  const edges: EdgeRecord[] = [];

  const templates = [
    { key: 'blank', name: 'Blank Space', icon: '🌀' },
    { key: 'research', name: 'Research Brain', icon: '🔬' },
    { key: 'life', name: 'Life OS', icon: '🌿' },
    { key: 'startup', name: 'Startup Map', icon: '🚀' }
  ];

  templates.forEach((template, idx) => {
    const spaceId = nanoid();
    const view = defaultView();
    const space: SpaceRecord = {
      id: spaceId,
      name: template.name,
      icon: template.icon,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      view
    };
    spaces.push(space);

    const center = createNode(spaceId, `${template.name} Core`, [0, 0, 0], [
      { id: nanoid(), type: 'markdown', text: 'Capture thoughts, links, and connections here.' }
    ]);

    const nodesForTemplate = [center];

    const satellites = [
      createNode(spaceId, 'Ideas', [2, 1, -2], [{ id: nanoid(), type: 'markdown', text: 'Quick capture zone.' }], ['ideas'], 4),
      createNode(spaceId, 'Resources', [-2, 1.2, 2], [
        { id: nanoid(), type: 'link', url: 'https://threejs.org', label: 'Three.js' }
      ],
      ['resources']),
      createNode(spaceId, 'Next Actions', [0.5, -1, 2.5], [
        { id: nanoid(), type: 'markdown', text: 'Lightweight tasks to keep momentum.' }
      ],
      ['actions'],
      5)
    ];

    nodesForTemplate.push(...satellites);

    if (template.key === 'research') {
      nodesForTemplate.push(
        createNode(spaceId, 'Hypotheses', [-1.5, 1.4, -2], [
          { id: nanoid(), type: 'markdown', text: 'Track questions and early answers.' }
        ],
        ['research']),
        createNode(spaceId, 'Sources', [1.8, -1.3, -1.6], [
          { id: nanoid(), type: 'markdown', text: 'Papers, datasets, interviews.' }
        ],
        ['sources'])
      );
    }

    if (template.key === 'life') {
      nodesForTemplate.push(
        createNode(spaceId, 'Wellness', [1.2, 1.6, -2.8], [
          { id: nanoid(), type: 'markdown', text: 'Habits, reflection, gratitude.' }
        ],
        ['life', 'health'],
        4),
        createNode(spaceId, 'Journal', [-2.5, -0.8, -0.4], [
          { id: nanoid(), type: 'markdown', text: 'Daily snapshots of mood + learnings.' }
        ],
        ['journal'])
      );
    }

    if (template.key === 'startup') {
      nodesForTemplate.push(
        createNode(spaceId, 'Customers', [2.6, -0.2, -1.2], [
          { id: nanoid(), type: 'markdown', text: 'Personas, interviews, pains.' }
        ],
        ['customers']),
        createNode(spaceId, 'Product', [-2.4, 0.4, 1.8], [
          { id: nanoid(), type: 'markdown', text: 'Opportunities, experiments, roadmap.' }
        ],
        ['product']),
        createNode(spaceId, 'Metrics', [0.4, -1.6, -2.2], [
          { id: nanoid(), type: 'markdown', text: 'North star, weekly pulse.' }
        ],
        ['metrics'])
      );
    }

    nodesForTemplate.forEach((node) => nodes.push(node));

    nodesForTemplate.forEach((node) => {
      if (node.id !== center.id) {
        edges.push(connect(spaceId, center, node, 'related'));
      }
    });

    if (idx === 0) {
      center.blocks.push({
        id: nanoid(),
        type: 'embed',
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        provider: 'youtube'
      });
    }
  });

  return { spaces, nodes, edges };
};
