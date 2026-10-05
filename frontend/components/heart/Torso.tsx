import { useMemo } from "react";
import { EdgesGeometry, LatheGeometry, Vector2 } from "three";

// (radius, height) profile from hips to neck, in heart units (1 unit is roughly 5 cm).
const PROFILE: [number, number][] = [
  [0, -7.2], [2.9, -7.0], [3.05, -5.5], [2.75, -3.2], [3.0, -1.0], [3.35, 1.0],
  [3.6, 2.6], [3.5, 3.4], [2.6, 4.0], [1.15, 4.5], [1.0, 5.4], [0, 5.5],
];
const DEPTH_SCALE = 0.6;
const COLOR = "#7fa6c9";
const ignoreRaycast = () => null;

/** Translucent torso silhouette that shows where the heart sits; purely for orientation. */
export function Torso() {
  const geometry = useMemo(
    () => new LatheGeometry(PROFILE.map(([r, y]) => new Vector2(r, y)), 24),
    [],
  );
  const edges = useMemo(() => new EdgesGeometry(geometry, 1), [geometry]);
  return (
    <group position={[-0.7, -0.2, -0.5]} scale={[1, 1, DEPTH_SCALE]}>
      <mesh geometry={geometry} raycast={ignoreRaycast}>
        <meshBasicMaterial color={COLOR} transparent opacity={0.06} depthWrite={false} />
      </mesh>
      <lineSegments geometry={edges} raycast={ignoreRaycast}>
        <lineBasicMaterial color={COLOR} transparent opacity={0.22} />
      </lineSegments>
    </group>
  );
}
