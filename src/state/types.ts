export type BlockType = 'markdown' | 'image' | 'link' | 'embed';

export interface ContentBlockBase {
  id: string;
  type: BlockType;
}

export interface MarkdownBlock extends ContentBlockBase {
  type: 'markdown';
  text: string;
}

export interface ImageBlock extends ContentBlockBase {
  type: 'image';
  url: string;
  alt?: string;
}

export interface LinkBlock extends ContentBlockBase {
  type: 'link';
  url: string;
  label?: string;
}

export interface EmbedBlock extends ContentBlockBase {
  type: 'embed';
  url: string;
  provider: 'youtube' | 'vimeo' | 'figma' | 'unknown';
}

export type ContentBlock = MarkdownBlock | ImageBlock | LinkBlock | EmbedBlock;

export interface Node3DPosition {
  x: number;
  y: number;
  z: number;
}

export interface NodeRecord {
  id: string;
  spaceId: string;
  title: string;
  tags: string[];
  importance: 1 | 2 | 3 | 4 | 5;
  createdAt: number;
  updatedAt: number;
  position: Node3DPosition;
  blocks: ContentBlock[];
}

export interface EdgeRecord {
  id: string;
  spaceId: string;
  from: string;
  to: string;
  relation?: string;
}

export interface ViewState {
  focusNodeId?: string;
  camera: {
    position: [number, number, number];
    target: [number, number, number];
  };
  environment: 'white-room' | 'dome';
  edgeVisibility: 'neighborhood' | 'two-hop' | 'all';
}

export interface SpaceRecord {
  id: string;
  name: string;
  icon: string;
  createdAt: number;
  updatedAt: number;
  view: ViewState;
}

export interface SearchResult {
  id: string;
  title: string;
  snippet: string;
}
