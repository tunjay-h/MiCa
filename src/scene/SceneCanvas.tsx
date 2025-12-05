import { Canvas, useFrame } from '@react-three/fiber';
import { Instances, Instance, OrbitControls, Text, Line, GradientTexture } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import { useMiCa } from '../state/store';
import { type EdgeRecord, type NodeRecord } from '../state/types';

const NodeInstances = ({ nodes, onSelect }: { nodes: NodeRecord[]; onSelect: (id: string) => void }) => (
  <Instances limit={nodes.length} castShadow receiveShadow>
    <sphereGeometry args={[0.22, 24, 24]} />
    <meshStandardMaterial emissive="#4ad3e8" color="#9fb4ff" emissiveIntensity={0.6} />
    {nodes.map((node) => (
      <Instance
        key={node.id}
        position={[node.position.x, node.position.y, node.position.z]}
        onClick={(event) => {
          event.stopPropagation();
          onSelect(node.id);
        }}
      />
    ))}
  </Instances>
);

const EdgeLines = ({
  edges,
  nodeLookup,
  visibleSet
}: {
  edges: EdgeRecord[];
  nodeLookup: Record<string, NodeRecord>;
  visibleSet: Set<string>;
}) => (
  <group>
    {edges
      .filter((edge) => visibleSet.has(edge.from) || visibleSet.has(edge.to))
      .map((edge) => {
        const from = nodeLookup[edge.from];
        const to = nodeLookup[edge.to];
        if (!from || !to) return null;
        return (
          <Line
            key={edge.id}
            points={[
              [from.position.x, from.position.y, from.position.z],
              [to.position.x, to.position.y, to.position.z]
            ]}
            color="#6b7a9f"
            linewidth={1}
            dashed={false}
            opacity={0.6}
            transparent
          />
        );
      })}
  </group>
);

const FloatingEnvironment = () => (
  <mesh scale={[80, 40, 80]} position={[0, 0, 0]}>
    <sphereGeometry args={[1, 32, 32]} />
    <meshBasicMaterial side={1}>
      <GradientTexture stops={[0, 0.5, 1]} colors={['#0b1224', '#0f1f3c', '#0b1224']} size={256} />
    </meshBasicMaterial>
  </mesh>
);

const SceneContent = () => {
  const { nodes, edges, selectNode, selectedNodeId, view, updateView } = useMiCa();
  const nodeLookup = useMemo(
    () => Object.fromEntries(nodes.map((node) => [node.id, node])),
    [nodes]
  );
  const elapsed = useRef(0);

  const visibleSet = useMemo(() => {
    if (view.edgeVisibility === 'all') {
      return new Set(nodes.map((node) => node.id));
    }
    const focusId = selectedNodeId ?? nodes[0]?.id;
    const neighborhood = new Set<string>();
    if (focusId) {
      neighborhood.add(focusId);
      edges.forEach((edge) => {
        if (edge.from === focusId || edge.to === focusId) {
          neighborhood.add(edge.from);
          neighborhood.add(edge.to);
        }
      });
      if (view.edgeVisibility === 'two-hop') {
        edges.forEach((edge) => {
          if (neighborhood.has(edge.from) || neighborhood.has(edge.to)) {
            neighborhood.add(edge.from);
            neighborhood.add(edge.to);
          }
        });
      }
    }
    return neighborhood;
  }, [edges, nodes, selectedNodeId, view.edgeVisibility]);

  useFrame(({ camera }, delta) => {
    elapsed.current += delta;
    if (elapsed.current > 0.4) {
      elapsed.current = 0;
      updateView({
        camera: {
          position: [camera.position.x, camera.position.y, camera.position.z],
          target: view.camera.target
        }
      });
    }
  });

  return (
    <>
      <ambientLight intensity={0.6} />
      <pointLight position={[10, 15, 12]} intensity={1.1} />
      <FloatingEnvironment />
      <NodeInstances nodes={nodes} onSelect={selectNode} />
      <EdgeLines edges={edges} nodeLookup={nodeLookup} visibleSet={visibleSet} />
      {nodes.slice(0, 12).map((node) => (
        <Text
          key={node.id}
          position={[node.position.x, node.position.y + 0.4, node.position.z]}
          fontSize={0.28}
          color={selectedNodeId === node.id ? '#4ad3e8' : '#dce3ff'}
          anchorX="center"
          anchorY="middle"
        >
          {node.title}
        </Text>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -3, 0]}>
        <circleGeometry args={[18, 64]} />
        <meshBasicMaterial color="#0f1324" transparent opacity={0.6} />
      </mesh>
    </>
  );
};

export function SceneCanvas() {
  return (
    <div className="h-[520px] w-full overflow-hidden rounded-2xl border border-white/5 bg-black/40 shadow-inner">
      <Canvas camera={{ position: [8, 6, 10], fov: 45 }} gl={{ antialias: true }}>
        <color attach="background" args={[0.03, 0.05, 0.1]} />
        <OrbitControls enablePan={false} />
        <SceneContent />
      </Canvas>
    </div>
  );
}
