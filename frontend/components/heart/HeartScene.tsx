"use client";

import { Canvas } from "@react-three/fiber";
import { useMemo, useRef } from "react";

import { type CameraView, DEFAULT_VIEW, focusView, HEART_ROTATION, TORSO_VIEW, VESSELS } from "@/lib/heart/anatomy";

import { CameraRig } from "./CameraRig";
import { CoronaryVessel } from "./CoronaryVessel";
import { HeartModel } from "./HeartModel";
import { Torso } from "./Torso";
import { VesselLabels } from "./VesselLabels";

export interface VesselState {
  color: string;
  /** Text shown on the 3D label, e.g. "88%"; null before a prediction. */
  valueLabel: string | null;
  pulsing: boolean;
}

export interface HeartSceneProps {
  /** Display state per vessel id; vessels without an entry are not drawn. */
  vessels: Record<string, VesselState>;
  hidden: ReadonlySet<string>;
  selected: string | null;
  showLabels: boolean;
  showTorso: boolean;
  viewKey: number;
  onSelectVessel: (id: string) => void;
  onSelectHeart: () => void;
  onHover: (id: string | null) => void;
}

/** WebGL scene. Renders on demand, with capped pixel ratio and no post-processing. */
export default function HeartScene(props: HeartSceneProps) {
  const { vessels, hidden, selected, showLabels, showTorso, viewKey, onSelectVessel } = props;
  const labelElements = useRef(new Map<string, HTMLElement>());
  const visible = useMemo(() => VESSELS.filter(({ id }) => id in vessels && !hidden.has(id)), [vessels, hidden]);
  const view: CameraView = useMemo(() => {
    const vessel = visible.find(({ id }) => id === selected);
    if (vessel) return focusView(vessel);
    return showTorso ? TORSO_VIEW : DEFAULT_VIEW;
  }, [selected, visible, showTorso]);

  return (
    <div className="relative size-full overflow-hidden">
      <Canvas
        frameloop="demand"
        dpr={[1, 1.5]}
        camera={{ fov: 32, near: 0.1, far: 80, position: DEFAULT_VIEW.position.toArray() }}
        gl={{ antialias: true, powerPreference: "low-power" }}
        aria-label="Interactive 3D heart with coronary arteries coloured by predicted stenosis probability"
        role="img"
      >
        <ambientLight intensity={0.75} />
        <hemisphereLight args={["#ffffff", "#3a4658", 0.6]} />
        <directionalLight position={[3, 4, 6]} intensity={1.6} />
        <directionalLight position={[-5, 1, -3]} intensity={0.5} />
        <group rotation={HEART_ROTATION}>
          <HeartModel onSelect={props.onSelectHeart} />
          {visible.map((vessel) => (
            <CoronaryVessel
              key={vessel.id}
              vessel={vessel}
              color={vessels[vessel.id].color}
              pulsing={vessels[vessel.id].pulsing}
              selected={selected === vessel.id}
              onSelect={onSelectVessel}
              onHover={props.onHover}
            />
          ))}
        </group>
        {showTorso && <Torso />}
        {showLabels && <VesselLabels vessels={visible} elements={labelElements} />}
        <CameraRig view={view} viewKey={viewKey} maxDistance={showTorso ? 26 : 11} />
      </Canvas>
      {showLabels &&
        visible.map(({ id, name }) => (
          <button
            key={id}
            type="button"
            ref={(element) => {
              if (element) labelElements.current.set(id, element);
              else labelElements.current.delete(id);
            }}
            onClick={() => onSelectVessel(id)}
            className={`vessel-label absolute left-0 top-0 ${selected === id ? "vessel-label-selected" : ""}`}
            aria-label={`Select ${name}`}
          >
            <span className="size-2 rounded-full" style={{ background: vessels[id].color }} />
            {id}
            {vessels[id].valueLabel && <span className="font-mono tabular-nums">{vessels[id].valueLabel}</span>}
          </button>
        ))}
    </div>
  );
}
