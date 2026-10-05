import { BufferGeometry, Float32BufferAttribute, Vector3 } from "three";

/**
 * Procedural ventricular surface, parameterised like a globe:
 *   `lon` - angle around the long axis (PI/2 = anterior, 0 = patient's left, PI = patient's right)
 *   `lat` - height in [-1, 1] (+1 = base, -1 = apex)
 * The same function builds the mesh and places the coronary arteries, so vessels always sit
 * exactly on the surface.
 */

const WIDTH = 1.0; // left-right half extent
const DEPTH = 0.84; // front-back half extent
const BASE_HEIGHT = 0.62;
const APEX_HEIGHT = 1.28;
const APEX_CONE = 0.3; // 0 = round bottom, 1 = pure cone

export const AV_GROOVE_LAT = 0.5;
export const ANTERIOR_GROOVE_LON = 1.25;
export const POSTERIOR_GROOVE_LON = 4.62;

const bump = (distance: number, width: number) => Math.exp(-((distance / width) ** 2));

function angularDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % (2 * Math.PI);
  return d > Math.PI ? 2 * Math.PI - d : d;
}

/** Shallow grooves where the main coronary arteries run. */
function grooveScale(lon: number, lat: number): number {
  const atrioventricular = 0.05 * bump(lat - AV_GROOVE_LAT, 0.1);
  const belowBase = lat < AV_GROOVE_LAT ? 1 : 0;
  const interventricular =
    0.035 *
    belowBase *
    (bump(angularDistance(lon, ANTERIOR_GROOVE_LON), 0.16) +
      bump(angularDistance(lon, POSTERIOR_GROOVE_LON), 0.16));
  return 1 - atrioventricular - interventricular;
}

export function surfacePoint(lon: number, lat: number, target = new Vector3()): Vector3 {
  const sphere = Math.sqrt(Math.max(0, 1 - lat * lat));
  const cone = lat < 0 ? sphere * (1 - APEX_CONE) + (1 + lat) * APEX_CONE : sphere;
  const radius = cone * grooveScale(lon, lat);
  // The right ventricle (patient's right, anterior) bulges slightly more than the left.
  const rightBulge = 1 + 0.06 * bump(angularDistance(lon, 2.3), 0.9);
  return target.set(
    Math.cos(lon) * radius * WIDTH * rightBulge,
    lat * (lat > 0 ? BASE_HEIGHT : APEX_HEIGHT),
    Math.sin(lon) * radius * DEPTH * rightBulge,
  );
}

/** Outward unit normal by finite differences. */
export function surfaceNormal(lon: number, lat: number, target = new Vector3()): Vector3 {
  const e = 1e-3;
  const clamped = Math.min(1 - 2 * e, Math.max(-1 + 2 * e, lat));
  const alongLon = surfacePoint(lon + e, clamped).sub(surfacePoint(lon - e, clamped));
  const alongLat = surfacePoint(lon, clamped + e).sub(surfacePoint(lon, clamped - e));
  return target.crossVectors(alongLat, alongLon).normalize();
}

/** Point lifted `offset` above the surface along its normal. */
export function liftedPoint(lon: number, lat: number, offset: number): Vector3 {
  return surfacePoint(lon, lat).addScaledVector(surfaceNormal(lon, lat), offset);
}

export function buildVentricleGeometry(lonSegments = 72, latSegments = 44): BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  const point = new Vector3();
  for (let j = 0; j <= latSegments; j++) {
    // Cosine spacing puts more rings near the base and apex where curvature is highest.
    const lat = Math.cos((j / latSegments) * Math.PI);
    for (let i = 0; i <= lonSegments; i++) {
      surfacePoint((i / lonSegments) * 2 * Math.PI, lat, point);
      positions.push(point.x, point.y, point.z);
    }
  }
  const row = lonSegments + 1;
  for (let j = 0; j < latSegments; j++) {
    for (let i = 0; i < lonSegments; i++) {
      const a = j * row + i;
      const b = a + row;
      indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
