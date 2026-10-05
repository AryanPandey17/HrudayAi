import { BufferAttribute, BufferGeometry, type Mesh, Vector3 } from "three";

import type { CameraView } from "./anatomy";

const FOCUS_DISTANCE = 8.6;
const LABEL_LIFT = 0.14;

/**
 * World-space, float32 copy of a loaded mesh's geometry with smooth normals. The GLB stores
 * quantised integers plus a node transform; baking both here keeps later maths simple.
 */
export function bakedGeometry(mesh: Mesh): BufferGeometry {
  mesh.updateWorldMatrix(true, false);
  const source = mesh.geometry.getAttribute("position");
  const positions = new Float32Array(source.count * 3);
  const point = new Vector3();
  for (let i = 0; i < source.count; i++) {
    point.fromBufferAttribute(source, i).applyMatrix4(mesh.matrixWorld).toArray(positions, i * 3);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setIndex(mesh.geometry.getIndex());
  geometry.computeVertexNormals();
  return geometry;
}

/** Copy of a geometry pushed outwards along its normals (thicker vessel, outline or hit area). */
export function inflate(geometry: BufferGeometry, distance: number): BufferGeometry {
  const inflated = geometry.clone();
  const position = inflated.getAttribute("position");
  const normal = inflated.getAttribute("normal");
  for (let i = 0; i < position.count; i++) {
    position.setXYZ(
      i,
      position.getX(i) + normal.getX(i) * distance,
      position.getY(i) + normal.getY(i) * distance,
      position.getZ(i) + normal.getZ(i) * distance,
    );
  }
  return inflated;
}

export function centreOf(geometry: BufferGeometry): Vector3 {
  geometry.computeBoundingBox();
  return geometry.boundingBox!.getCenter(new Vector3());
}

export interface VesselAnchor {
  /** Where the floating label sits. */
  label: Vector3;
  /** Direction from the heart's centre out through the vessel. */
  outward: Vector3;
  view: CameraView;
}

/** Label position and camera pose for a vessel, derived from its geometry alone. */
export function vesselAnchor(vessel: BufferGeometry, heartCentre: Vector3): VesselAnchor {
  const position = vessel.getAttribute("position");
  const centroid = new Vector3();
  const point = new Vector3();
  for (let i = 0; i < position.count; i++) centroid.add(point.fromBufferAttribute(position, i));
  centroid.divideScalar(position.count);
  const outward = centroid.clone().sub(heartCentre).normalize();

  // The label goes on the vessel's outermost point so it sits over visible vessel, not muscle.
  const outermost = new Vector3();
  let best = -Infinity;
  for (let i = 0; i < position.count; i++) {
    const reach = point.fromBufferAttribute(position, i).sub(heartCentre).dot(outward);
    if (reach > best) {
      best = reach;
      outermost.fromBufferAttribute(position, i);
    }
  }
  // Bias the camera towards the viewer so posterior vessels are seen from the side.
  const direction = outward.clone().multiplyScalar(1.2).add(new Vector3(0, 0.12, 0.5)).normalize();
  return {
    label: outermost.addScaledVector(outward, LABEL_LIFT),
    outward,
    view: { position: centroid.clone().addScaledVector(direction, FOCUS_DISTANCE), target: centroid },
  };
}
