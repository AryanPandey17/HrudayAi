import { type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { BackSide, type BufferGeometry, Color, type MeshStandardMaterial, SphereGeometry, TubeGeometry } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { buildSegments, type VesselDef, type VesselSegment } from "@/lib/heart/anatomy";

const COLOR_RATE = 5; // colour transition speed (1/s)
const HALO_SCALE = 1.7;
const HIT_SCALE = 2.8;

/** One merged geometry for a whole vessel: tubes plus rounded tips. */
function vesselGeometry(segments: VesselSegment[], radiusScale: number): BufferGeometry {
  const parts = segments.flatMap(({ curve, radius }) => {
    const r = radius * radiusScale;
    const tube = new TubeGeometry(curve, Math.ceil(curve.getLength() * 26), r, 8, false);
    const tip = new SphereGeometry(r, 8, 6).translate(...curve.getPoint(1).toArray());
    return [tube, tip];
  });
  return mergeGeometries(parts);
}

interface CoronaryVesselProps {
  vessel: VesselDef;
  color: string;
  pulsing: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}

/** A named coronary artery whose colour tracks its predicted stenosis probability. */
export function CoronaryVessel(props: CoronaryVesselProps) {
  const { vessel, color, pulsing, selected, onSelect, onHover } = props;
  const invalidate = useThree((state) => state.invalidate);
  const material = useRef<MeshStandardMaterial>(null);
  const [hovered, setHovered] = useState(false);

  const segments = useMemo(() => buildSegments(vessel), [vessel]);
  const geometry = useMemo(() => vesselGeometry(segments, 1), [segments]);
  const hitGeometry = useMemo(() => vesselGeometry(segments, HIT_SCALE), [segments]);
  const haloGeometry = useMemo(() => (selected ? vesselGeometry(segments, HALO_SCALE) : null), [segments, selected]);
  const targetColor = useMemo(() => new Color(color), [color]);

  useEffect(() => invalidate(), [invalidate, targetColor, selected, hovered, pulsing]);

  useFrame((state, delta) => {
    const current = material.current;
    if (!current) return;
    const blend = 1 - Math.exp(-Math.min(delta, 0.05) * COLOR_RATE);
    current.color.lerp(targetColor, blend);
    current.emissive.copy(current.color);
    const pulse = pulsing ? 0.22 + 0.22 * Math.sin(state.clock.elapsedTime * 4) : 0;
    current.emissiveIntensity = Math.max(pulse, selected ? 0.5 : hovered ? 0.35 : 0.12);
    const settling = Math.abs(current.color.r - targetColor.r) + Math.abs(current.color.g - targetColor.g) + Math.abs(current.color.b - targetColor.b) > 0.004;
    if (settling || pulsing) state.invalidate();
  });

  const hover = (isOver: boolean) => (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    setHovered(isOver);
    onHover(isOver ? vessel.id : null);
    document.body.style.cursor = isOver ? "pointer" : "";
  };
  const select = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSelect(vessel.id);
  };

  return (
    <group name={vessel.id}>
      <mesh geometry={geometry}>
        <meshStandardMaterial ref={material} color={color} roughness={0.35} metalness={0.05} />
      </mesh>
      {haloGeometry && (
        <mesh geometry={haloGeometry}>
          <meshBasicMaterial color="#ffffff" side={BackSide} transparent opacity={0.85} />
        </mesh>
      )}
      <mesh geometry={hitGeometry} onClick={select} onPointerOver={hover(true)} onPointerOut={hover(false)}>
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}
