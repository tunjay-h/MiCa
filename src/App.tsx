import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Float, GradientTexture, Html, Line, OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';
import { useMiCa } from './state/store';
import { type NodeRecord } from './state/types';
import './index.css';

const DomeEnvironment = ({ hush }: { hush: number }) => (
  <mesh scale={[90, 60, 90]}>
    <sphereGeometry args={[1, 64, 64]} />
    <meshBasicMaterial side={1} transparent opacity={0.9 + (1 - hush) * 0.05}>
      <GradientTexture stops={[0, 0.5, 1]} colors={['#0b1224', '#0e1a33', '#0b1224']} size={512} />
    </meshBasicMaterial>
  </mesh>
);

const WhiteRoomEnvironment = ({ hush }: { hush: number }) => (
  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -5, 0]}>
    <planeGeometry args={[160, 160]} />
    <meshBasicMaterial transparent opacity={0.7 + (1 - hush) * 0.1}>
      <GradientTexture stops={[0, 1]} colors={['#0d1021', '#0a0c18']} size={256} />
    </meshBasicMaterial>
  </mesh>
);

const SpaceCard = ({
  index,
  total,
  space,
  onEnter,
  onFocus
}: {
  index: number;
  total: number;
  space: { id: string; name: string; icon: string; updatedAt: number };
  onEnter: () => void;
  onFocus: () => void;
}) => {
  const angle = (index / total) * Math.PI * 1.2 - Math.PI * 0.6;
  const radius = 6;
  const x = Math.sin(angle) * radius;
  const z = Math.cos(angle) * radius;
  return (
    <Float speed={1} rotationIntensity={0.1} position={[x, 0.4, -z]}>
      <mesh
        onClick={onEnter}
        onPointerOver={onFocus}
        scale={1.1}
        castShadow
        receiveShadow
        rotation={[0, -angle, 0]}
      >
        <planeGeometry args={[2.6, 3.4]} />
        <meshStandardMaterial color="#10172b" transparent opacity={0.88} />
        <Html
          transform
          occlude
          position={[0, 0, 0.05]}
          className="pointer-events-auto select-none"
        >
          <div className="w-40 space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4 text-sand shadow-lg">
            <div className="text-3xl">{space.icon}</div>
            <div className="font-semibold leading-tight">{space.name}</div>
            <p className="text-xs text-slate-400">
              Updated {new Date(space.updatedAt).toLocaleDateString()}
            </p>
            <button className="w-full rounded-full bg-aurora/20 px-3 py-1 text-sm text-aurora hover:bg-aurora/30">
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

  const handleEnter = async (id: string) => {
    await setActiveSpace(id);
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
      {spaces.map((space, index) => (
        <SpaceCard
          key={space.id}
          index={index}
          total={Math.max(spaces.length, 4)}
          space={space}
          onEnter={() => handleEnter(space.id)}
          onFocus={() => setName(space.name)}
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
                    await addSpaceFromTemplate(template, { name, icon });
                    setNewSpaceOpen(false);
                    setName('New Space');
                    setIcon('🪐');
                    setAppMode('SPACE_3D');
                  }}
                >
                  Create & Enter
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
  onSelect,
  hush
}: {
  nodes: NodeRecord[];
  onSelect: (id: string) => void;
  hush: number;
}) => (
  <group>
    {nodes.map((node, index) => {
      const wobble = Math.sin((Date.now() * 0.001 + index) * 0.6) * 0.08 * (0.4 + hush * 0.6);
      return (
        <Float key={node.id} speed={1.2} floatIntensity={0.1} position={[node.position.x, node.position.y + wobble, node.position.z]}>
          <mesh
            onClick={(event) => {
              event.stopPropagation();
              onSelect(node.id);
            }}
          >
            <sphereGeometry args={[0.25, 28, 28]} />
            <meshStandardMaterial color="#9fb4ff" emissive="#4ad3e8" emissiveIntensity={0.5 + hush * 0.4} />
          </mesh>
        </Float>
      );
    })}
  </group>
);

const Edges = ({
  nodes,
  edges,
  visibleSet,
  hush
}: {
  nodes: NodeRecord[];
  edges: { id: string; from: string; to: string }[];
  visibleSet: Set<string>;
  hush: number;
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
          return (
            <Line
              key={edge.id}
              points={[
                [from.position.x, from.position.y, from.position.z],
                [to.position.x, to.position.y, to.position.z]
              ]}
              color="#5d6a90"
              linewidth={1}
              transparent
              opacity={0.3 + hush * 0.4}
            />
          );
        })}
    </group>
  );
};

const Toolbelt = ({ hush }: { hush: number }) => {
  const { view, updateView, setAppMode } = useMiCa();
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
        <div className="flex gap-2 rounded-full border border-white/10 bg-black/50 px-3 py-2 text-xs text-sand shadow-lg backdrop-blur"
          style={{ opacity: 0.6 + hush * 0.4 }}
        >
          <button
            className={`rounded-full px-3 py-1 ${view.environment === 'dome' ? 'bg-aurora/20 text-aurora' : 'bg-white/10'}`}
            onClick={() => updateView({ environment: 'dome' })}
          >
            Dome
          </button>
          <button
            className={`rounded-full px-3 py-1 ${view.environment === 'white-room' ? 'bg-aurora/20 text-aurora' : 'bg-white/10'}`}
            onClick={() => updateView({ environment: 'white-room' })}
          >
            White Room
          </button>
          {(['neighborhood', 'two-hop', 'all'] as const).map((mode) => (
            <button
              key={mode}
              className={`rounded-full px-3 py-1 capitalize ${
                view.edgeVisibility === mode ? 'bg-white/15 text-sand' : 'bg-white/5 text-slate-300'
              }`}
              onClick={() => updateView({ edgeVisibility: mode })}
            >
              {mode}
            </button>
          ))}
          <button
            className="rounded-full bg-white/5 px-3 py-1"
            onClick={() => updateView({ camera: { position: [8, 6, 10], target: [0, 0, 0] } })}
          >
            Reset
          </button>
          <button
            className={`rounded-full px-3 py-1 ${view.mode === 'observe' ? 'bg-aurora/20 text-aurora' : 'bg-amber-300/20 text-amber-200'}`}
            onClick={() => updateView({ mode: view.mode === 'observe' ? 'edit' : 'observe' })}
          >
            {view.mode === 'observe' ? 'Observe / Hush' : 'Edit'}
          </button>
          <button className="rounded-full bg-white/5 px-3 py-1" onClick={() => setAppMode('HOME_3D')}>
            Home
          </button>
        </div>
      </Html>
    </group>
  );
};

const NodeInspector = ({ node, hush }: { node: NodeRecord | undefined; hush: number }) => {
  const { deleteNode, createNode, linkNodes, selectNode, updateView } = useMiCa();
  const anchor = useRef<THREE.Group>(null);
  const { camera } = useThree();

  useFrame(() => {
    if (!anchor.current || !node) return;
    const target = new THREE.Vector3(node.position.x, node.position.y + 0.8, node.position.z);
    anchor.current.position.lerp(target, 0.4);
    anchor.current.quaternion.slerp(camera.quaternion, 0.15);
  });

  if (!node) return null;

  return (
    <group ref={anchor}>
      <Html transform occlude className="pointer-events-auto">
        <div
          className="w-64 space-y-2 rounded-2xl border border-white/10 bg-black/60 p-4 text-sand shadow-xl backdrop-blur"
          style={{ opacity: 0.5 + hush * 0.5 }}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-aurora">Node</p>
              <p className="text-lg font-semibold leading-tight">{node.title}</p>
            </div>
            <button className="text-xs text-slate-400" onClick={() => selectNode(undefined)}>
              Clear
            </button>
          </div>
          <div className="space-y-1 text-sm text-slate-200">
            {node.blocks.map((block) => (
              <p key={block.id} className="rounded-lg bg-white/5 px-2 py-1 text-xs text-slate-300">
                {block.type === 'markdown' ? block.text : block.type}
              </p>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <button
              className="rounded-full bg-aurora/20 px-3 py-1 text-aurora"
              onClick={() => createNode({ parentId: node.id, title: 'New Thought' })}
            >
              Add child
            </button>
            <button
              className="rounded-full border border-white/10 px-3 py-1"
              onClick={() => updateView({ mode: 'edit' })}
            >
              Edit
            </button>
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

const CommandBar = ({ visible, onClose, hush }: { visible: boolean; onClose: () => void; hush: number }) => {
  const { search, selectNode } = useMiCa();
  const [query, setQuery] = useState('');
  const results = useMemo(() => (visible ? search(query) : []), [visible, query, search]);

  if (!visible) return null;

  return (
    <Html center transform occlude position={[0, 1.5, -3]} className="pointer-events-auto">
      <div
        className="w-[420px] space-y-2 rounded-2xl border border-white/10 bg-black/60 p-4 text-sand shadow-2xl backdrop-blur"
        style={{ opacity: 0.5 + hush * 0.5 }}
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
                selectNode(result.id);
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
  const { nodes, edges, view, updateView, selectedNodeId, selectNode, hush } = useMiCa();
  const controls = useRef<any>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const { camera } = useThree();

  const nodeLookup = useMemo(() => Object.fromEntries(nodes.map((node) => [node.id, node])), [nodes]);
  const selectedNode = selectedNodeId ? nodeLookup[selectedNodeId] : undefined;

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
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const Env = view.environment === 'dome' ? DomeEnvironment : WhiteRoomEnvironment;

  return (
    <group>
      <Env hush={hush} />
      <OrbitControls ref={controls} enablePan={false} />
      <ambientLight intensity={0.8} />
      <pointLight position={[10, 12, 8]} intensity={1.2} />
      <NodeInstances nodes={nodes} onSelect={selectNode} hush={hush} />
      <Edges nodes={nodes} edges={edges} visibleSet={visibleSet} hush={hush} />
      <Toolbelt hush={hush} />
      <NodeInspector node={selectedNode} hush={hush} />
      <CommandBar visible={searchOpen} onClose={() => setSearchOpen(false)} hush={hush} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3, 0]}>
        <circleGeometry args={[18, 64]} />
        <meshBasicMaterial color="#0f1324" transparent opacity={0.5 + hush * 0.2} />
      </mesh>
      {nodes.slice(0, 12).map((node) => (
        <Text
          key={node.id}
          position={[node.position.x, node.position.y + 0.4, node.position.z]}
          fontSize={0.26}
          color={selectedNodeId === node.id ? '#4ad3e8' : '#dce3ff'}
          anchorX="center"
          anchorY="middle"
        >
          {node.title}
        </Text>
      ))}
    </group>
  );
};

const WorldRouter = () => {
  const { appMode, stepHush } = useMiCa();
  useFrame((_, delta) => stepHush(delta));
  return appMode === 'HOME_3D' ? <HomeWorld /> : <SpaceWorld />;
};

export default function App() {
  const { init, initialized } = useMiCa();

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
      <div className="pointer-events-none absolute left-4 top-4 text-xs uppercase tracking-[0.3em] text-aurora">
        MiCa Immersive Home
      </div>
    </div>
  );
}
