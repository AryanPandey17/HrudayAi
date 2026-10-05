import { type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { type BufferGeometry, Color, type MeshStandardMaterial } from "three";

import { inflate } from "@/lib/heart/geometry";

const COLOR_RATE = 5; // colour transition speed (1/s)
const VISIBLE_INFLATION = 0.014;
const HIT_INFLATION = 0.08;

interface VesselProps {
  id: string;
  geometry: BufferGeometry;
  color: string;
  /** 1 = solid; lower when the interval is wide or another vessel is selected. */
  opacity: number;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}

/** One coronary artery: a single mesh whose colour tracks its predicted probability. */
export function Vessel({ id, geometry, color, opacity, onSelect, onHover }: VesselProps) {
  const invalidate = useThree((state) => state.invalidate);
  const material = useRef<MeshStandardMaterial>(null);
  const visible = useMemo(() => inflate(geometry, VISIBLE_INFLATION), [geometry]);
  const hitArea = useMemo(() => inflate(geometry, HIT_INFLATION), [geometry]);
  const targetColor = useMemo(() => new Color(color), [color]);

  useEffect(() => invalidate(), [invalidate, targetColor, opacity]);

  useFrame((state, delta) => {
    const current = material.current;
    if (!current) return;
    current.color.lerp(targetColor, 1 - Math.exp(-Math.min(delta, 0.05) * COLOR_RATE));
    const gap =
      Math.abs(current.color.r - targetColor.r) +
      Math.abs(current.color.g - targetColor.g) +
      Math.abs(current.color.b - targetColor.b);
    if (gap > 0.004) state.invalidate();
  });

  const hover = (isOver: boolean) => (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    onHover(isOver ? id : null);
    document.body.style.cursor = isOver ? "pointer" : "";
  };
  const select = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSelect(id);
  };

  return (
    <group name={id}>
      <mesh geometry={visible}>
        <meshStandardMaterial
          ref={material}
          color={color}
          roughness={0.45}
          metalness={0}
          transparent={opacity < 1}
          opacity={opacity}
        />
      </mesh>
      <mesh geometry={hitArea} onClick={select} onPointerOver={hover(true)} onPointerOut={hover(false)}>
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}
