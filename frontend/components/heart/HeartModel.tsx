import { useMemo } from "react";
import { CatmullRomCurve3, TubeGeometry, Vector3 } from "three";
import type { ThreeEvent } from "@react-three/fiber";

import { buildVentricleGeometry } from "@/lib/heart/surface";

const MYOCARDIUM = "#a9565f";
const ATRIUM = "#8f4c5a";
const ARTERY = "#c0584c";
const VEIN = "#5b7fae";

type Triple = [number, number, number];

interface TubeDef {
  color: string;
  radius: number;
  points: Triple[];
}

const GREAT_VESSELS: TubeDef[] = [
  // Aorta: ascending, arch, descending behind the heart.
  { color: ARTERY, radius: 0.2, points: [[-0.05, 0.45, 0.22], [-0.08, 0.95, 0.2], [-0.02, 1.45, 0.1], [0.2, 1.78, -0.12], [0.5, 1.7, -0.42], [0.62, 1.3, -0.62], [0.62, 0.7, -0.7]] },
  // Arch branches.
  { color: ARTERY, radius: 0.07, points: [[0.03, 1.66, 0.02], [-0.02, 1.95, 0.02], [-0.08, 2.25, 0.0]] },
  { color: ARTERY, radius: 0.06, points: [[0.22, 1.76, -0.14], [0.24, 2.05, -0.16], [0.24, 2.3, -0.16]] },
  { color: ARTERY, radius: 0.06, points: [[0.42, 1.72, -0.34], [0.5, 2.0, -0.38], [0.58, 2.25, -0.4]] },
  // Pulmonary trunk and its two branches.
  { color: VEIN, radius: 0.19, points: [[0.28, 0.45, 0.5], [0.34, 0.9, 0.42], [0.42, 1.18, 0.14], [0.46, 1.26, -0.18]] },
  { color: VEIN, radius: 0.13, points: [[0.44, 1.24, -0.1], [0.75, 1.3, -0.3], [1.05, 1.28, -0.42]] },
  { color: VEIN, radius: 0.13, points: [[0.44, 1.24, -0.1], [0.0, 1.22, -0.42], [-0.5, 1.2, -0.5]] },
  // Venae cavae.
  { color: VEIN, radius: 0.15, points: [[-0.62, 0.9, -0.05], [-0.64, 1.4, -0.08], [-0.62, 2.0, -0.1]] },
  { color: VEIN, radius: 0.15, points: [[-0.5, 0.45, -0.5], [-0.52, 0.0, -0.6], [-0.52, -0.45, -0.66]] },
];

const CHAMBERS: { position: Triple; scale: Triple }[] = [
  { position: [-0.58, 0.76, 0.02], scale: [0.5, 0.42, 0.5] }, // right atrium
  { position: [-0.42, 0.8, 0.42], scale: [0.26, 0.2, 0.2] }, // right auricle
  { position: [0.25, 0.84, -0.42], scale: [0.6, 0.4, 0.44] }, // left atrium
  { position: [0.74, 0.74, 0.2], scale: [0.24, 0.18, 0.2] }, // left auricle
];

function tubeGeometry({ points, radius }: TubeDef): TubeGeometry {
  const curve = new CatmullRomCurve3(points.map((p) => new Vector3(...p)));
  return new TubeGeometry(curve, points.length * 8, radius, 12, false);
}

interface HeartModelProps {
  onSelect: () => void;
}

/** Stylised procedural heart: ventricles, atria and great vessels. Low-poly, no textures. */
export function HeartModel({ onSelect }: HeartModelProps) {
  const ventricles = useMemo(() => buildVentricleGeometry(), []);
  const tubes = useMemo(() => GREAT_VESSELS.map(tubeGeometry), []);
  const select = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSelect();
  };

  return (
    <group>
      <mesh geometry={ventricles} onClick={select}>
        <meshStandardMaterial color={MYOCARDIUM} roughness={0.62} metalness={0.02} />
      </mesh>
      {CHAMBERS.map(({ position, scale }, index) => (
        <mesh key={index} position={position} scale={scale} onClick={select}>
          <sphereGeometry args={[1, 28, 20]} />
          <meshStandardMaterial color={ATRIUM} roughness={0.7} />
        </mesh>
      ))}
      {tubes.map((geometry, index) => (
        <mesh key={index} geometry={geometry}>
          <meshStandardMaterial color={GREAT_VESSELS[index].color} roughness={0.55} />
        </mesh>
      ))}
    </group>
  );
}
