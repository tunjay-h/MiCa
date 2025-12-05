import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Float, GradientTexture, Html, Line, OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { nanoid } from './utils/nanoid';
import { useMiCa } from './state/store';
import { type ContentBlock, type NodeRecord } from './state/types';
import { ResilientImage } from './components/ResilientImage';
import './index.css';

const DomeEnvironment = ({ hush }: { hush: number }) => (
  <mesh scale={[90, 60, 90]}>
    <sphereGeometry args={[1, 64, 64]} />
    <meshBasicMaterial side={1} transparent opacity={0.9 - hush * 0.08}>
      <GradientTexture stops={[0, 0.5, 1]} colors={['#0b1224', '#0e1a33', '#0b1224']} size={512} />
    </meshBasicMaterial>
  </mesh>
);

const WhiteRoomEnvironment = ({ hush }: { hush: number }) => (
  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -5, 0]}>
    <planeGeometry args={[160, 160]} />
    <meshBasicMaterial transparent opacity={0.74 - hush * 0.12}>
      <GradientTexture stops={[0, 1]} colors={['#0d1021', '#0a0c18']} size={256} />
    </meshBasicMaterial>
  </mesh>
);

const HushFog = ({ hush }: { hush: number }) => {
  const { scene } = useThree();
  const fogRef = useRef<THREE.Fog | null>(null);

  useEffect(() => {
    const fog = fogRef.current ?? new THREE.Fog('#0a1024', 12, 52);
    fogRef.current = fog;
    const previousFog = scene.fog;
    scene.fog = fog;
    return () => {
      scene.fog = previousFog;
    };
  }, [scene]);

  useEffect(() => {
    const fog = fogRef.current;
    if (!fog) return;
    fog.color.set('#0a1024');
    fog.near = 12 + hush * 3.5;
    fog.far = Math.max(fog.near + 12, 52 - hush * 12);
  }, [hush]);

  return null;
};

const SpaceCard = ({
  index,
  total,
  space,
  selected,
  onSelect,
  onEnter
}: {
  index: number;
  total: number;
  space: { id: string; name: string; icon: string; updatedAt: number };
  selected: boolean;
  onSelect: () => void;
  onEnter: () => void;
}) => {
  const angle = (index / total) * Math.PI * 1.2 - Math.PI * 0.6;
  const radius = 6;
  const x = Math.sin(angle) * radius;
  const z = Math.cos(angle) * radius;
  return (
    <Float speed={1} rotationIntensity={0.1} position={[x, 0.4, -z]}>
      <mesh
        onClick={(event) => {
          event.stopPropagation();
          onSelect();
        }}
        onDoubleClick={(event) => {
          event.stopPropagation();
          onEnter();
        }}
        scale={selected ? 1.2 : 1.05}
        castShadow
        receiveShadow
        rotation={[0, -angle, 0]}
      >
        <planeGeometry args={[2.7, 3.6]} />
        <meshStandardMaterial
          color={selected ? '#1a2a4f' : '#10172b'}
          transparent
          opacity={selected ? 1 : 0.88}
          emissive={selected ? '#4ad3e8' : '#000'}
          emissiveIntensity={selected ? 0.15 : 0}
        />
        <Html
          transform
          occlude
          position={[0, 0, 0.05]}
          className="pointer-events-auto select-none"
        >
          <div
            className={`w-40 space-y-2 rounded-2xl border p-4 text-sand shadow-lg ${
              selected ? 'border-aurora/80 bg-aurora/10' : 'border-white/10 bg-white/5'
            }`}
          >
            <div className="text-3xl">{space.icon}</div>
            <div className="font-semibold leading-tight">{space.name}</div>
            <p className="text-xs text-slate-400">
              Updated {new Date(space.updatedAt).toLocaleDateString()}
            </p>
            <button
              className="w-full rounded-full bg-aurora/20 px-3 py-1 text-sm text-aurora hover:bg-aurora/30"
              onClick={onEnter}
            >
              Enter
            </button>
          </div>
        </Html>
      </mesh>
    </Float>
  );
};

const HomeWorld = () => {
  const { spaces, addSpaceFromTemplate, setActiveSpace, setAppMode, importData, exportAll } = useMiCa();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newSpaceOpen, setNewSpaceOpen] = useState(false);
  const [name, setName] = useState('New Space');
  const [icon, setIcon] = useState('🪐');
  const [template, setTemplate] = useState('Blank Space');
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (spaces.length === 0) {
      setSelectedSpaceId(undefined);
      return;
    }
    if (!selectedSpaceId || !spaces.find((space) => space.id === selectedSpaceId)) {
      setSelectedSpaceId(spaces[0].id);
    }
  }, [spaces, selectedSpaceId]);

  const triggerImport = () => {
    fileInputRef.current?.click();
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const payload = JSON.parse(text);
      await importData(payload);
    } catch (error) {
      console.error('Import failed', error);
    }
  };

  const handleEnter = async (id?: string) => {
    const targetId = id ?? selectedSpaceId ?? spaces[0]?.id;
    if (!targetId) return;
    await setActiveSpace(targetId);
    setAppMode('SPACE_3D');
  };

  return (
    <group>
      <DomeEnvironment hush={1} />
      <group position={[0, -2.6, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[12, 64]} />
          <meshBasicMaterial color="#0b1224" opacity={0.5} transparent />
        </mesh>
      </group>
      {spaces.length === 0 && (
        <Float position={[0, 0.8, -3]}>
          <Html
            center
            className="pointer-events-auto select-none rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-center text-sand shadow-lg"
          >
            <p className="text-sm text-slate-300">No spaces yet.</p>
            <p className="text-xs text-slate-400">Create one to see it appear in the dome.</p>
          </Html>
        </Float>
      )}
      {spaces.map((space, index) => (
        <SpaceCard
          key={space.id}
          index={index}
          total={Math.max(spaces.length, 4)}
          space={space}
          selected={selectedSpaceId === space.id}
          onSelect={() => setSelectedSpaceId(space.id)}
          onEnter={() => handleEnter(space.id)}
        />
      ))}
      <Float position={[0, 2.4, -3]}>
        <Html center className="pointer-events-auto w-[360px] rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
          <div className="flex flex-col gap-3 text-sand">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-aurora">MiCa / Dome Lobby</p>
              <p className="text-lg font-semibold">Choose a space to enter its mind world.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className="rounded-full bg-aurora/20 px-4 py-2 text-sm text-aurora hover:bg-aurora/30 disabled:opacity-40"
                onClick={() => handleEnter()}
                disabled={!selectedSpaceId}
              >
                Enter
              </button>
              <button
                className="rounded-full bg-aurora/20 px-4 py-2 text-sm text-aurora hover:bg-aurora/30"
                onClick={() => setNewSpaceOpen(true)}
              >
                New Space
              </button>
              <button
                className="rounded-full border border-white/10 px-4 py-2 text-sm hover:border-aurora/60"
                onClick={triggerImport}
              >
                Import Backup
              </button>
              <button
                className="rounded-full border border-white/10 px-4 py-2 text-sm hover:border-aurora/60"
                onClick={async () => {
                  const data = await exportAll();
                  const blob = new Blob([data], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = 'mica-backup.json';
                  link.click();
                  URL.revokeObjectURL(url);
                }}
              >
                Export All
              </button>
            </div>
          </div>
          {newSpaceOpen && (
            <div className="mt-4 space-y-3 rounded-2xl border border-white/10 bg-black/40 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-200">Create a new space</p>
                <button className="text-xs text-slate-400" onClick={() => setNewSpaceOpen(false)}>
                  Close
                </button>
              </div>
              <div className="space-y-2 text-sm">
                <label className="flex items-center gap-2">
                  <span className="text-slate-300">Name</span>
                  <input
                    className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sand"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
                <label className="flex items-center gap-2">
                  <span className="text-slate-300">Icon</span>
                  <input
                    className="w-20 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-center text-xl"
                    value={icon}
                    onChange={(e) => setIcon(e.target.value)}
                  />
                </label>
                <div className="space-y-1">
                  <p className="text-slate-300">Template</p>
                  <div className="flex flex-wrap gap-2">
                    {['Blank Space', 'Research', 'Life OS', 'Startup'].map((preset) => (
                      <button
                        key={preset}
                        className={`rounded-full px-3 py-1 text-xs ${
                          template === preset ? 'bg-aurora/20 text-aurora' : 'bg-white/5 text-sand'
                        }`}
                        onClick={() => setTemplate(preset)}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  className="w-full rounded-full bg-aurora/30 px-4 py-2 text-sm font-semibold text-aurora"
                  onClick={async () => {
                    const createdId = await addSpaceFromTemplate(template, { name, icon });
                    setNewSpaceOpen(false);
                    setName('New Space');
                    setIcon('🪐');
                    if (createdId) {
                      setSelectedSpaceId(createdId);
                    }
                  }}
                >
                  Create
                </button>
              </div>
            </div>
          )}
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleImport} />
        </Html>
      </Float>
    </group>
  );
};

const NodeInstances = ({
  nodes,
  selectedNodeId,
  onSelect,
  onFocus,
  hush,
  linkingFromId,
  tagFilteredSet
}: {
  nodes: NodeRecord[];
  selectedNodeId?: string;
  onSelect: (id: string) => void;
  onFocus: (id: string) => void;
  hush: number;
  linkingFromId?: string;
  tagFilteredSet: Set<string>;
}) => {
  const [spawnedAt, setSpawnedAt] = useState<Record<string, number>>({});

  useEffect(() => {
    const now = performance.now();
    setSpawnedAt((prev) => {
      const next = { ...prev } as Record<string, number>;
      nodes.forEach((node) => {
        if (!next[node.id]) {
          next[node.id] = now;
        }
      });
      Object.keys(next).forEach((id) => {
        if (!nodes.some((node) => node.id === id)) {
          delete next[id];
        }
      });
      return next;
    });
  }, [nodes]);

  return (
    <group>
      {nodes.map((node, index) => {
        const wobble =
          Math.sin((Date.now() * 0.001 + index) * 0.6) * (0.12 - hush * 0.06);
        const selected = selectedNodeId === node.id;
        const matchesFilter = tagFilteredSet.has(node.id);
        const born = spawnedAt[node.id];
        const age = born ? Math.min((performance.now() - born) / 800, 1) : 1;
        const growth = (born ? 0.7 + 0.35 * Math.sin((age * Math.PI) / 2) : 1) * (matchesFilter ? 1 : 0.85);
        const linkSource = linkingFromId === node.id;
        const linkable = linkingFromId && linkingFromId !== node.id;
        const baseScale = (selected ? 1.1 : 1) * growth;

        return (
          <Float
            key={node.id}
            speed={1.2}
            floatIntensity={0.1}
            position={[node.position.x, node.position.y + wobble, node.position.z]}
            scale={baseScale}
          >
            <mesh
              onClick={(event) => {
                event.stopPropagation();
                onSelect(node.id);
              }}
              onDoubleClick={(event) => {
                event.stopPropagation();
                onFocus(node.id);
              }}
              onPointerDown={(event) => {
                if (event.detail === 2) {
                  event.stopPropagation();
                  onFocus(node.id);
                }
              }}
            >
              <sphereGeometry args={[0.25, 28, 28]} />
              <meshStandardMaterial
                color={linkSource ? '#f5c97a' : selected ? '#c2ddff' : matchesFilter ? '#9fb4ff' : '#566185'}
                emissive={linkable ? '#7af6ff' : matchesFilter ? '#4ad3e8' : '#2c3350'}
                emissiveIntensity={(0.7 - hush * 0.25 + (selected ? 0.15 : 0) + (linkable ? 0.15 : 0)) * (matchesFilter ? 1 : 0.4)}
                transparent
                opacity={(0.85 - hush * 0.25 + 0.15 * age) * (matchesFilter ? 1 : 0.45)}
              />
            </mesh>
          </Float>
        );
      })}
    </group>
  );
};

const SelectionHalo = ({ node, hush }: { node?: NodeRecord; hush: number }) => {
  const ref = useRef<THREE.Group>(null);
  const { camera } = useThree();

  useFrame(() => {
    if (!ref.current || !node) return;
    const target = new THREE.Vector3(node.position.x, node.position.y, node.position.z);
    ref.current.position.lerp(target, 0.3);
    ref.current.quaternion.slerp(camera.quaternion, 0.2);
  });

  if (!node) return null;

  return (
    <group ref={ref}>
      <mesh>
        <ringGeometry args={[0.36, 0.6, 48]} />
        <meshBasicMaterial color="#4ad3e8" transparent opacity={0.52 - hush * 0.22} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.3, 0.5, 48]} />
        <meshBasicMaterial color="#7af6ff" transparent opacity={0.4 - hush * 0.18} />
      </mesh>
    </group>
  );
};

const Edges = ({
  nodes,
  edges,
  visibleSet,
  hush,
  tagFilteredSet,
  selectedNodeId
}: {
  nodes: NodeRecord[];
  edges: { id: string; from: string; to: string }[];
  visibleSet: Set<string>;
  hush: number;
  tagFilteredSet: Set<string>;
  selectedNodeId?: string;
}) => {
  const lookup = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n])), [nodes]);
  return (
    <group>
      {edges
        .filter((edge) => visibleSet.has(edge.from) || visibleSet.has(edge.to))
        .map((edge) => {
          const from = lookup[edge.from];
          const to = lookup[edge.to];
          if (!from || !to) return null;
          const passesTagFilter = tagFilteredSet.has(from.id) || tagFilteredSet.has(to.id);
          if (!passesTagFilter) return null;
          const dimmed = !tagFilteredSet.has(from.id) || !tagFilteredSet.has(to.id);
          const focused = selectedNodeId && (edge.from === selectedNodeId || edge.to === selectedNodeId);
          const hushFade = 0.7 - hush * 0.35 + (focused ? 0.15 : 0);
          return (
            <Line
              key={edge.id}
              points={[
                [from.position.x, from.position.y, from.position.z],
                [to.position.x, to.position.y, to.position.z]
              ]}
              color={focused ? '#7fc9ff' : dimmed ? '#2f364f' : '#4c597a'}
              linewidth={1}
              transparent
              opacity={hushFade * (dimmed && !focused ? 0.55 : 1)}
            />
          );
        })}
    </group>
  );
};

const Toolbelt = ({
  hush,
  onOpenSearch,
  availableTags,
  activeTags,
  onToggleTag,
  onClearTags
}: {
  hush: number;
  onOpenSearch: () => void;
  availableTags: string[];
  activeTags: string[];
  onToggleTag: (tag: string) => void;
  onClearTags: () => void;
}) => {
  const { view, updateView, resetView, setAppMode, nodes } = useMiCa();
  const group = useRef<THREE.Group>(null);
  const { camera } = useThree();

  useFrame(() => {
    if (!group.current) return;
    const offset = 1.6;
    const dir = camera.getWorldDirection(new THREE.Vector3()).normalize();
    const pos = camera.position.clone().add(dir.multiplyScalar(3.3));
    pos.y -= 1.2;
    group.current.position.lerp(pos, 0.25);
    group.current.quaternion.slerp(camera.quaternion, 0.2);
  });

  return (
    <group ref={group}>
      <Html
        transform
        occlude
        position={[0, 0, 0]}
        className="pointer-events-auto"
      >
        <div
          className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-black/50 px-3 py-2 text-xs text-sand shadow-lg backdrop-blur"
          style={{
            opacity: 0.95 - hush * 0.35,
            filter: `saturate(${1 - hush * 0.1}) contrast(${1 - hush * 0.2})`
          }}
        >
          <div className="flex flex-wrap gap-2">
            <button
              className={`rounded-full px-3 py-1 ${view.environment === 'dome' ? 'bg-aurora/20 text-aurora' : 'bg-white/10'}`}
              onClick={() => updateView({ environment: 'dome' })}
            >
              Dome
            </button>
            <button
              className={`rounded-full px-3 py-1 ${
                view.environment === 'white-room' ? 'bg-aurora/20 text-aurora' : 'bg-white/10'
              }`}
              onClick={() => updateView({ environment: 'white-room' })}
            >
              White Room
            </button>
            {(['neighborhood', 'two-hop', 'all'] as const).map((mode) => {
              const label = mode === 'all' && nodes.length > 30 ? 'all (heavy)' : mode;
              return (
                <button
                  key={mode}
                  className={`rounded-full px-3 py-1 capitalize ${
                    view.edgeVisibility === mode ? 'bg-white/15 text-sand' : 'bg-white/5 text-slate-300'
                  }`}
                  title={mode === 'all' ? 'May be cluttered on large graphs' : undefined}
                  onClick={() => updateView({ edgeVisibility: mode })}
                >
                  {label}
                </button>
              );
            })}
            {view.edgeVisibility === 'all' && nodes.length > 30 ? (
              <span className="rounded-full bg-amber-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-amber-200">
                Dense view
              </span>
            ) : null}
            <button className="rounded-full bg-white/5 px-3 py-1" onClick={() => resetView()}>
              Reset
            </button>
            <button
              className={`rounded-full px-3 py-1 ${
                view.mode === 'observe' ? 'bg-aurora/20 text-aurora' : 'bg-amber-300/20 text-amber-200'
              }`}
              onClick={() => updateView({ mode: view.mode === 'observe' ? 'edit' : 'observe' })}
            >
              {view.mode === 'observe' ? 'Observe / Hush' : 'Edit'}
            </button>
            <button className="rounded-full bg-white/5 px-3 py-1" onClick={() => setAppMode('HOME_3D')}>
              Home
            </button>
            <button
              className="rounded-full bg-aurora/20 px-3 py-1 text-aurora hover:bg-aurora/30"
              onClick={onOpenSearch}
            >
              Search /
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
            <span className="text-[10px] uppercase tracking-[0.2em] text-slate-300">Tags</span>
            {availableTags.length === 0 && <span className="text-slate-400">No tags yet</span>}
            {availableTags.map((tag) => {
              const active = activeTags.includes(tag);
              return (
                <button
                  key={tag}
                  className={`rounded-full px-3 py-1 text-xs ${
                    active ? 'bg-aurora/20 text-aurora' : 'bg-black/30 text-sand'
                  }`}
                  onClick={() => onToggleTag(tag)}
                >
                  #{tag}
                </button>
              );
            })}
            {activeTags.length > 0 ? (
              <button
                className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-200"
                onClick={onClearTags}
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>
      </Html>
    </group>
  );
};

type EmbedProvider = {
  provider: 'youtube' | 'vimeo' | 'figma' | 'unknown';
  embedUrl?: string;
};

const detectEmbedProvider = (url: string): EmbedProvider => {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtube.com') || parsed.hostname === 'youtu.be') {
      const id = parsed.searchParams.get('v') ?? parsed.pathname.replace('/', '');
      if (id) {
        return {
          provider: 'youtube' as const,
          embedUrl: `https://www.youtube.com/embed/${id}`
        };
      }
    }
    if (parsed.hostname.includes('vimeo.com')) {
      const id = parsed.pathname.split('/').filter(Boolean)[0];
      if (id) {
        return {
          provider: 'vimeo' as const,
          embedUrl: `https://player.vimeo.com/video/${id}`
        };
      }
    }
    if (parsed.hostname.includes('figma.com')) {
      return {
        provider: 'figma' as const,
        embedUrl: `https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(url)}`
      };
    }
  } catch {
    /* noop */
  }
  return { provider: 'unknown' as const, embedUrl: undefined };
};

const BlockView = ({ block }: { block: ContentBlock }) => {
  if (block.type === 'markdown') {
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        className="prose prose-invert prose-sm max-w-none"
      >
        {block.text}
      </ReactMarkdown>
    );
  }
  if (block.type === 'image') {
    return (
      <div className="overflow-hidden rounded-xl border border-white/10">
        <ResilientImage src={block.url} alt={block.alt ?? ''} className="max-h-40 w-full object-cover" />
        {block.alt ? <p className="px-2 py-1 text-[10px] text-slate-300">{block.alt}</p> : null}
      </div>
    );
  }
  if (block.type === 'link') {
    return (
      <a
        href={block.url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs text-aurora hover:border-aurora/60"
      >
        <span className="truncate">{block.label ?? block.url}</span>
      </a>
    );
  }

  const embed = detectEmbedProvider(block.url);
  if (embed.provider === 'unknown' || !embed.embedUrl) {
    return (
      <div className="space-y-1 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-100">
        <p>Embed not allowed for this source.</p>
        <a className="text-aurora underline" href={block.url} target="_blank" rel="noreferrer">
          Open link
        </a>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-white/10">
      <iframe
        src={embed.embedUrl}
        title="Embedded content"
        className="h-48 w-full"
        sandbox="allow-scripts allow-same-origin allow-popups"
        allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
      />
    </div>
  );
};

const NodeInspector = ({
  node,
  hush,
  linkingFromId,
  onStartLink,
  onCancelLink
}: {
  node: NodeRecord | undefined;
  hush: number;
  linkingFromId?: string;
  onStartLink: (sourceId: string) => void;
  onCancelLink: () => void;
}) => {
  const { deleteNode, createNode, selectNode, updateView, updateNode, view } = useMiCa();
  const anchor = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const [addType, setAddType] = useState<ContentBlock['type']>('markdown');
  const [localNode, setLocalNode] = useState<NodeRecord | undefined>(node);

  useEffect(() => {
    setLocalNode(node);
  }, [node]);

  useFrame(() => {
    if (!anchor.current || !node) return;
    const target = new THREE.Vector3(node.position.x, node.position.y + 0.8, node.position.z);
    anchor.current.position.lerp(target, 0.35);
    anchor.current.quaternion.slerp(camera.quaternion, 0.18);
  });

  if (!node || !localNode) return null;

  const isEditing = view.mode === 'edit';

  const commitNode = async (next: NodeRecord) => {
    setLocalNode(next);
    await updateNode(next.id, next);
  };

  const mutateNode = (updater: (draft: NodeRecord) => void) => {
    if (!localNode) return;
    const draft: NodeRecord = {
      ...localNode,
      blocks: localNode.blocks.map((block) => ({ ...block }))
    };
    updater(draft);
    void commitNode(draft);
  };

  const addBlock = (type: ContentBlock['type']) => {
    mutateNode((draft) => {
      if (!localNode) return;
      const block: ContentBlock =
        type === 'markdown'
          ? ({ id: nanoid(), type: 'markdown', text: 'Write here…' } as ContentBlock)
          : type === 'image'
            ? ({ id: nanoid(), type: 'image', url: 'https://placekitten.com/640/360', alt: 'Image' } as ContentBlock)
            : type === 'link'
              ? ({ id: nanoid(), type: 'link', url: 'https://example.com', label: 'Link' } as ContentBlock)
              : (() => {
                  const embed = detectEmbedProvider('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
                  return {
                    id: nanoid(),
                    type: 'embed',
                    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
                    provider: embed.provider
                  } as ContentBlock;
                })();
      draft.blocks = [...draft.blocks, block];
    });
  };

  const moveBlock = (index: number, delta: number) => {
    mutateNode((draft) => {
      const next = [...draft.blocks];
      const target = index + delta;
      if (target < 0 || target >= next.length) return;
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      draft.blocks = next;
    });
  };

  const updateBlock = (blockId: string, updates: Partial<ContentBlock>) => {
    mutateNode((draft) => {
      draft.blocks = draft.blocks.map((block) =>
        block.id === blockId ? ({ ...block, ...updates } as ContentBlock) : block
      );
    });
  };

  const removeBlock = (blockId: string) => {
    mutateNode((draft) => {
      draft.blocks = draft.blocks.filter((block) => block.id !== blockId);
    });
  };

  return (
    <group ref={anchor}>
      <Html transform occlude className="pointer-events-auto">
        <div
          className="w-80 space-y-3 rounded-2xl border border-white/10 bg-black/70 p-4 text-sand shadow-xl backdrop-blur"
          style={{
            opacity: 0.96 - hush * 0.36,
            filter: `contrast(${1 - hush * 0.18}) saturate(${1 - hush * 0.08})`
          }}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-aurora">Node</p>
              {isEditing ? (
                <input
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
                  value={localNode.title}
                  onChange={(e) => mutateNode((draft) => void (draft.title = e.target.value))}
                />
              ) : (
                <p className="text-lg font-semibold leading-tight">{localNode.title}</p>
              )}
              <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-slate-300">
                {isEditing ? (
                  <input
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1"
                    value={localNode.tags.join(', ')}
                    onChange={(e) =>
                      mutateNode((draft) => {
                        draft.tags = e.target.value
                          .split(',')
                          .map((tag) => tag.trim())
                          .filter(Boolean);
                      })
                    }
                    placeholder="tags, comma separated"
                  />
                ) : (
                  localNode.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-white/5 px-2 py-1">
                      {tag}
                    </span>
                  ))
                )}
                <span className="rounded-full bg-white/5 px-2 py-1">Importance {localNode.importance}</span>
              </div>
              {isEditing ? (
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={localNode.importance}
                  onChange={(e) =>
                    mutateNode((draft) =>
                      void (draft.importance = Number(e.target.value) as NodeRecord['importance'])
                    )
                  }
                  className="mt-1 w-full"
                />
              ) : null}
            </div>
            <div className="flex flex-col items-end gap-1 text-[11px] text-slate-400">
              <button onClick={() => selectNode(undefined)} className="text-slate-400">
                Clear
              </button>
              <button
                onClick={() => updateView({ mode: isEditing ? 'observe' : 'edit' })}
                className="rounded-full border border-white/10 px-3 py-1 text-xs"
              >
                {isEditing ? 'Observe' : 'Edit'}
              </button>
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-3">
            {isEditing ? (
              <div className="space-y-2 text-xs text-slate-200">
                {localNode.blocks.map((block, index) => (
                  <div key={block.id} className="space-y-2 rounded-lg border border-white/10 bg-black/40 p-2">
                    <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-slate-400">
                      <span>{block.type}</span>
                      <div className="flex items-center gap-1">
                        <button
                          className="rounded-full border border-white/10 px-2 py-1"
                          disabled={index === 0}
                          onClick={() => moveBlock(index, -1)}
                        >
                          ↑
                        </button>
                        <button
                          className="rounded-full border border-white/10 px-2 py-1"
                          disabled={index === localNode.blocks.length - 1}
                          onClick={() => moveBlock(index, 1)}
                        >
                          ↓
                        </button>
                        <button
                          className="rounded-full border border-red-400/40 px-2 py-1 text-red-200"
                          onClick={() => removeBlock(block.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    {block.type === 'markdown' && (
                      <textarea
                        className="h-20 w-full rounded-lg border border-white/10 bg-white/5 p-2 text-xs"
                        value={block.text}
                        onChange={(e) => updateBlock(block.id, { text: e.target.value })}
                      />
                    )}
                    {block.type === 'image' && (
                      <div className="space-y-1">
                        <input
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs"
                          value={block.url}
                          onChange={(e) => updateBlock(block.id, { url: e.target.value })}
                          placeholder="Image URL"
                        />
                        <input
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs"
                          value={block.alt ?? ''}
                          onChange={(e) => updateBlock(block.id, { alt: e.target.value })}
                          placeholder="Alt text"
                        />
                      </div>
                    )}
                    {block.type === 'link' && (
                      <div className="space-y-1">
                        <input
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs"
                          value={block.url}
                          onChange={(e) => updateBlock(block.id, { url: e.target.value })}
                          placeholder="Link URL"
                        />
                        <input
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs"
                          value={block.label ?? ''}
                          onChange={(e) => updateBlock(block.id, { label: e.target.value })}
                          placeholder="Label"
                        />
                      </div>
                    )}
                    {block.type === 'embed' && (
                      <div className="space-y-1 text-xs">
                        <input
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1"
                          value={block.url}
                          onChange={(e) => {
                            const provider = detectEmbedProvider(e.target.value).provider;
                            updateBlock(block.id, { url: e.target.value, provider });
                          }}
                          placeholder="Embed URL (YouTube, Vimeo, Figma)"
                        />
                        <p className="text-[10px] text-slate-400">Provider: {block.provider}</p>
                      </div>
                    )}
                  </div>
                ))}
                <div className="flex items-center gap-2">
                  <select
                    value={addType}
                    onChange={(e) => setAddType(e.target.value as ContentBlock['type'])}
                    className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs"
                  >
                    <option value="markdown">Markdown</option>
                    <option value="image">Image</option>
                    <option value="link">Link</option>
                    <option value="embed">Embed</option>
                  </select>
                  <button
                    className="rounded-full bg-aurora/20 px-3 py-1 text-xs text-aurora"
                    onClick={() => addBlock(addType)}
                  >
                    Add block
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-sm text-slate-200">
                {localNode.blocks.map((block) => (
                  <div key={block.id} className="rounded-lg bg-black/30 p-2">
                    <BlockView block={block} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <button
              className="rounded-full bg-aurora/20 px-3 py-1 text-aurora"
              onClick={() => createNode({ parentId: node.id, title: 'New Thought' })}
            >
              Add child
            </button>
            <div className="flex items-center gap-2 rounded-full border border-white/10 px-2 py-1">
              <button
                className={`rounded-full px-3 py-1 ${
                  linkingFromId === node.id ? 'bg-aurora/20 text-aurora' : 'bg-white/10 text-sand'
                }`}
                onClick={() => (linkingFromId === node.id ? onCancelLink() : onStartLink(node.id))}
              >
                {linkingFromId === node.id ? 'Cancel link' : 'Link to…'}
              </button>
              <span className="text-[10px] text-slate-300">
                {linkingFromId === node.id ? 'Click another node or press Esc' : 'Double-click nodes to focus'}
              </span>
            </div>
            <button
              className="rounded-full border border-red-400/40 px-3 py-1 text-red-200"
              onClick={() => deleteNode(node.id)}
            >
              Delete
            </button>
          </div>
        </div>
      </Html>
    </group>
  );
};

const CommandBar = ({
  visible,
  onClose,
  hush,
  onFocus
}: { visible: boolean; onClose: () => void; hush: number; onFocus: (id: string) => void }) => {
  const { search } = useMiCa();
  const [query, setQuery] = useState('');
  const results = useMemo(() => (visible ? search(query) : []), [visible, query, search]);

  if (!visible) return null;

  return (
    <Html center transform occlude position={[0, 1.5, -3]} className="pointer-events-auto">
      <div
        className="w-[420px] space-y-2 rounded-2xl border border-white/10 bg-black/60 p-4 text-sand shadow-2xl backdrop-blur"
        style={{
          opacity: 0.92 - hush * 0.32,
          filter: `saturate(${1 - hush * 0.1}) contrast(${1 - hush * 0.12})`
        }}
      >
        <div className="flex items-center justify-between text-xs text-slate-300">
          <p>Command / Search</p>
          <button onClick={onClose} className="text-slate-400">
            Esc
          </button>
        </div>
        <input
          autoFocus
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-sand"
          placeholder="Jump to node…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="max-h-48 space-y-1 overflow-auto text-sm">
          {results.map((result) => (
            <button
              key={result.id}
              className="w-full rounded-lg bg-white/5 px-3 py-2 text-left hover:bg-aurora/10"
              onClick={() => {
                onFocus(result.id);
                onClose();
              }}
            >
              <p className="font-semibold">{result.title}</p>
              <p className="text-xs text-slate-400">{result.snippet}</p>
            </button>
          ))}
          {results.length === 0 && <p className="text-xs text-slate-500">No matches</p>}
        </div>
      </div>
    </Html>
  );
};

const SpaceWorld = () => {
  const { nodes, edges, view, updateView, selectedNodeId, selectNode, hush, linkNodes } = useMiCa();
  const controls = useRef<any>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [linkingFromId, setLinkingFromId] = useState<string | undefined>(undefined);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const { camera } = useThree();

  const nodeLookup = useMemo(() => Object.fromEntries(nodes.map((node) => [node.id, node])), [nodes]);
  const selectedNode = selectedNodeId ? nodeLookup[selectedNodeId] : undefined;

  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    nodes.forEach((node) => node.tags.forEach((tag) => tags.add(tag)));
    return Array.from(tags).sort();
  }, [nodes]);

  const tagFilteredSet = useMemo(() => {
    if (activeTags.length === 0) return new Set(nodes.map((node) => node.id));
    return new Set(
      nodes.filter((node) => node.tags.some((tag) => activeTags.includes(tag))).map((node) => node.id)
    );
  }, [activeTags, nodes]);

  const toggleTag = useCallback((tag: string) => {
    setActiveTags((prev) => (prev.includes(tag) ? prev.filter((entry) => entry !== tag) : [...prev, tag]));
  }, []);

  const clearTags = useCallback(() => setActiveTags([]), []);

  const focusNode = useCallback(
    (nodeId: string) => {
      const node = nodeLookup[nodeId];
      if (!node) return;
      selectNode(nodeId);
      const target = new THREE.Vector3(node.position.x, node.position.y, node.position.z);
      const currentTarget = controls.current?.target ?? new THREE.Vector3(...view.camera.target);
      const direction = camera.position.clone().sub(currentTarget);
      const distance = Math.max(direction.length(), 4);
      const newPosition = target.clone().add(direction.normalize().multiplyScalar(distance));

      camera.position.copy(newPosition);
      if (controls.current) {
        controls.current.target.copy(target);
        controls.current.update();
      }

      updateView({
        camera: {
          position: [newPosition.x, newPosition.y, newPosition.z],
          target: [target.x, target.y, target.z]
        }
      });
    },
    [camera, nodeLookup, selectNode, updateView, view.camera.target]
  );

  const visibleSet = useMemo(() => {
    if (view.edgeVisibility === 'all') return new Set(nodes.map((node) => node.id));
    const focus = selectedNodeId ?? nodes[0]?.id;
    const set = new Set<string>();
    if (!focus) return set;
    set.add(focus);
    edges.forEach((edge) => {
      if (edge.from === focus || edge.to === focus) {
        set.add(edge.from);
        set.add(edge.to);
      }
    });
    if (view.edgeVisibility === 'two-hop') {
      edges.forEach((edge) => {
        if (set.has(edge.from) || set.has(edge.to)) {
          set.add(edge.from);
          set.add(edge.to);
        }
      });
    }
    return set;
  }, [edges, nodes, selectedNodeId, view.edgeVisibility]);

  useEffect(() => {
    if (controls.current) {
      controls.current.target.set(view.camera.target[0], view.camera.target[1], view.camera.target[2]);
      controls.current.update();
    }
    camera.position.set(view.camera.position[0], view.camera.position[1], view.camera.position[2]);
  }, [view.camera.position, view.camera.target, camera]);

  const persistTimer = useRef(0);
  useFrame(({ camera }, delta) => {
    if (!controls.current) return;
    persistTimer.current += delta;
    if (persistTimer.current > 0.4) {
      persistTimer.current = 0;
      updateView({ camera: { position: [camera.position.x, camera.position.y, camera.position.z], target: view.camera.target } });
    }
  });

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === '/') {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === 'Escape') {
        setSearchOpen(false);
        setLinkingFromId(undefined);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleSelect = useCallback(
    (nodeId: string) => {
      if (linkingFromId) {
        if (linkingFromId !== nodeId) {
          void linkNodes(linkingFromId, nodeId, 'related');
        }
        setLinkingFromId(undefined);
        return;
      }
      selectNode(nodeId);
    },
    [linkingFromId, linkNodes, selectNode]
  );

  const Env = view.environment === 'dome' ? DomeEnvironment : WhiteRoomEnvironment;

  return (
    <group onPointerMissed={() => selectNode(undefined)}>
      <Env hush={hush} />
      <HushFog hush={hush} />
      <OrbitControls ref={controls} enablePan={false} enableDamping dampingFactor={0.08} />
      <ambientLight intensity={0.8} />
      <pointLight position={[10, 12, 8]} intensity={1.2} />
      <NodeInstances
        nodes={nodes}
        selectedNodeId={selectedNodeId}
        onSelect={handleSelect}
        onFocus={focusNode}
        hush={hush}
        linkingFromId={linkingFromId}
        tagFilteredSet={tagFilteredSet}
      />
      <SelectionHalo node={selectedNode} hush={hush} />
      <Edges
        nodes={nodes}
        edges={edges}
        visibleSet={visibleSet}
        hush={hush}
        tagFilteredSet={tagFilteredSet}
        selectedNodeId={selectedNodeId}
      />
      <Toolbelt
        hush={hush}
        onOpenSearch={() => setSearchOpen(true)}
        availableTags={availableTags}
        activeTags={activeTags}
        onToggleTag={toggleTag}
        onClearTags={clearTags}
      />
      <NodeInspector
        node={selectedNode}
        hush={hush}
        linkingFromId={linkingFromId}
        onStartLink={(sourceId) => setLinkingFromId(sourceId)}
        onCancelLink={() => setLinkingFromId(undefined)}
      />
      <CommandBar
        visible={searchOpen}
        onClose={() => setSearchOpen(false)}
        hush={hush}
        onFocus={focusNode}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3, 0]}>
        <circleGeometry args={[18, 64]} />
        <meshBasicMaterial color="#0f1324" transparent opacity={0.62 - hush * 0.32} />
      </mesh>
      {nodes.slice(0, 12).map((node) => {
        const dimmed = !tagFilteredSet.has(node.id);
        return (
        <Text
          key={node.id}
          position={[node.position.x, node.position.y + 0.4, node.position.z]}
          fontSize={0.26}
          color={selectedNodeId === node.id ? '#4ad3e8' : dimmed ? '#6e7286' : '#dce3ff'}
          anchorX="center"
          anchorY="middle"
        >
          {node.title}
        </Text>
        );
      })}
    </group>
  );
};

const WorldRouter = () => {
  const { appMode, stepHush } = useMiCa();
  useFrame((_, delta) => stepHush(delta));
  return appMode === 'HOME_3D' ? <HomeWorld /> : <SpaceWorld />;
};

export default function App() {
  const { init, initialized, hush } = useMiCa();

  useEffect(() => {
    init();
  }, [init]);

  if (!initialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-sand">
        <div className="space-y-2 text-center">
          <p className="text-sm text-slate-400">Booting MiCa</p>
          <p className="text-xl font-semibold">Preparing dome…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-full bg-black">
      <Canvas camera={{ position: [0, 3, 10], fov: 52 }} gl={{ antialias: true }}>
        <color attach="background" args={[0.02, 0.04, 0.09]} />
        <WorldRouter />
      </Canvas>
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(5,8,20,0) 55%, rgba(5,8,20,0.45) 100%)',
          opacity: 0.18 + hush * 0.42,
          transition: 'opacity 200ms ease'
        }}
      />
      <div className="pointer-events-none absolute left-4 top-4 text-xs uppercase tracking-[0.3em] text-aurora">
        MiCa Immersive Home
      </div>
    </div>
  );
}
