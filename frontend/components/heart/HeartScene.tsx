"use client";

import { ContactShadows, useGLTF } from "@react-three/drei";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { Suspense, useMemo, useRef } from "react";
import type { BufferGeometry, Mesh } from "three";

import type { ThemeTokens } from "@/hooks/useThemeTokens";
import { HEART_MODEL_URL } from "@/lib/config";
import { type CameraView, DEFAULT_VIEW, HEART_WALL_NODE, STRUCTURES, TORSO_VIEW, VESSELS } from "@/lib/heart/anatomy";
import { bakedGeometry, centreOf, vesselAnchor, type VesselAnchor } from "@/lib/heart/geometry";

import { CameraRig } from "./CameraRig";
import { Torso } from "./Torso";
import { Vessel } from "./Vessel";
import { VesselLabels } from "./VesselLabels";

export interface VesselState {
  color: string;
  opacity: number;
  /** Text shown on the 3D label, e.g. "46%"; null before a prediction. */
  valueLabel: string | null;
}

export interface HeartSceneProps {
  /** Display state per vessel id; vessels without an entry are not drawn. */
  vessels: Record<string, VesselState>;
  tokens: ThemeTokens;
  hidden: ReadonlySet<string>;
  selected: string | null;
  showLabels: boolean;
  showTorso: boolean;
  autoRotate: boolean;
  reducedMotion: boolean;
  viewKey: number;
  onSelectVessel: (id: string) => void;
  onSelectHeart: () => void;
  onHover: (id: string | null) => void;
}

// Selecting a vessel fades the others so the choice reads without outlines or glow.
const UNSELECTED_DIMMING = 0.3;

interface Anatomy {
  structures: { node: string; tone: "wall" | "artery" | "vein"; geometry: BufferGeometry }[];
  vessels: Record<string, BufferGeometry>;
  anchors: Record<string, VesselAnchor>;
}

/** Loads the heart model once and prepares world-space geometry, label anchors and camera poses. */
function useAnatomy(): Anatomy {
  const { nodes } = useGLTF(HEART_MODEL_URL, false, true);
  return useMemo(() => {
    const bake = (name: string) => bakedGeometry(nodes[name] as Mesh);
    const structures = STRUCTURES.filter(({ node }) => node in nodes).map((item) => ({ ...item, geometry: bake(item.node) }));
    const heartCentre = centreOf(structures.find(({ node }) => node === HEART_WALL_NODE)!.geometry);
    const vessels = Object.fromEntries(VESSELS.filter(({ id }) => id in nodes).map(({ id }) => [id, bake(id)]));
    const anchors = Object.fromEntries(
      Object.entries(vessels).map(([id, geometry]) => [id, vesselAnchor(geometry, heartCentre)]),
    );
    return { structures, vessels, anchors };
  }, [nodes]);
}

interface HeartProps extends HeartSceneProps {
  labelElements: React.RefObject<Map<string, HTMLElement>>;
}

function Heart(props: HeartProps) {
  const { vessels, tokens, hidden, selected, showLabels, showTorso } = props;
  const anatomy = useAnatomy();
  const tones = { wall: tokens.heartWall, artery: tokens.heartArtery, vein: tokens.heartVein };
  const visible = Object.keys(anatomy.vessels).filter((id) => id in vessels && !hidden.has(id));
  const view: CameraView = selected && visible.includes(selected) ? anatomy.anchors[selected].view : showTorso ? TORSO_VIEW : DEFAULT_VIEW;
  // Anatomy in front of a vessel blocks hover and click, so only visible vessel can be picked.
  const occlude = (event: ThreeEvent<PointerEvent>) => event.stopPropagation();
  const selectHeart = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    props.onSelectHeart();
  };

  return (
    <>
      {anatomy.structures.map(({ node, tone, geometry }) => (
        <mesh key={node} geometry={geometry} onClick={node === HEART_WALL_NODE ? selectHeart : undefined} onPointerOver={occlude}>
          <meshPhysicalMaterial color={tones[tone]} roughness={0.62} clearcoat={0.25} clearcoatRoughness={0.55} sheen={0.25} />
        </mesh>
      ))}
      {visible.map((id) => (
        <Vessel
          key={id}
          id={id}
          geometry={anatomy.vessels[id]}
          color={vessels[id].color}
          opacity={vessels[id].opacity * (selected && selected !== id ? UNSELECTED_DIMMING : 1)}
          onSelect={props.onSelectVessel}
          onHover={props.onHover}
        />
      ))}
      {showLabels && (
        <VesselLabels
          anchors={Object.fromEntries(visible.map((id) => [id, anatomy.anchors[id]]))}
          elements={props.labelElements}
        />
      )}
      <CameraRig
        view={view}
        viewKey={props.viewKey}
        maxDistance={showTorso ? 28 : 14}
        autoRotate={props.autoRotate && !props.reducedMotion}
        instant={props.reducedMotion}
      />
    </>
  );
}

/** WebGL scene. Renders on demand, with capped pixel ratio and no post-processing. */
export default function HeartScene(props: HeartSceneProps) {
  const { vessels, tokens, hidden, selected, showLabels, showTorso, onSelectVessel } = props;
  const labelElements = useRef(new Map<string, HTMLElement>());
  const labelled = VESSELS.filter(({ id }) => id in vessels && !hidden.has(id));

  return (
    <div className="relative size-full overflow-hidden">
      <Canvas
        frameloop="demand"
        dpr={[1, 1.5]}
        camera={{ fov: 30, near: 0.1, far: 90, position: DEFAULT_VIEW.position.toArray() }}
        gl={{ antialias: true, powerPreference: "low-power" }}
        aria-label="Interactive 3D heart with coronary arteries coloured by predicted stenosis probability"
        role="img"
      >
        <color attach="background" args={[tokens.canvas]} />
        {/* Soft studio lighting: broad sky/ground fill, one key, a weak rim. No shadows are cast. */}
        <hemisphereLight args={["#ffffff", "#8a8f98", 1.1]} />
        <directionalLight position={[4, 5, 7]} intensity={1.5} />
        <directionalLight position={[-6, 2, -4]} intensity={0.45} />
        <Suspense fallback={null}>
          <Heart {...props} labelElements={labelElements} />
          <ContactShadows position={[0, -2.35, 0]} scale={9} blur={2.6} far={3} opacity={0.22} frames={1} resolution={256} />
        </Suspense>
        {showTorso && <Torso color={tokens.outline} />}
      </Canvas>
      {showLabels &&
        labelled.map(({ id, name }) => (
          <button
            key={id}
            type="button"
            ref={(element) => {
              if (element) labelElements.current.set(id, element);
              else labelElements.current.delete(id);
            }}
            onClick={() => onSelectVessel(id)}
            aria-label={`Select ${name}`}
            className={`absolute left-0 top-0 inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border bg-background/95 px-2 py-0.5 text-xs font-medium shadow-xs ${
              selected === id ? "border-foreground" : "border-border"
            }`}
          >
            <span className="size-2 rounded-full" style={{ background: vessels[id].color }} />
            {id}
            {vessels[id].valueLabel && <span className="font-mono tabular-nums">{vessels[id].valueLabel}</span>}
          </button>
        ))}
    </div>
  );
}

useGLTF.preload(HEART_MODEL_URL, false, true);
