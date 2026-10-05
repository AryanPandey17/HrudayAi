import { CatmullRomCurve3, Euler, Vector3 } from "three";

import { AV_GROOVE_LAT, liftedPoint, surfaceNormal } from "./surface";

/** Orientation of the whole heart: apex towards the patient's left, slightly forward. */
export const HEART_ROTATION = new Euler(-0.2, -0.2, 0.36);

/** A point on the ventricular surface (`lon`, `lat`) or an explicit heart-local position. */
type PathPoint = [lon: number, lat: number] | Vector3;

interface SegmentDef {
  id: string;
  radius: number;
  points: PathPoint[];
}

/** A coronary artery and its branches. `id` must equal the model's target name. */
export interface VesselDef {
  id: string;
  name: string;
  territory: string;
  segments: SegmentDef[];
  /** Surface position of the floating label. */
  labelAt: [lon: number, lat: number];
}

export interface VesselSegment {
  id: string;
  radius: number;
  curve: CatmullRomCurve3;
}

const MAIN = 0.042;
const BRANCH = 0.026;
const G = AV_GROOVE_LAT;

// Coronary ostia on the aortic root (heart-local coordinates).
const LEFT_OSTIUM = new Vector3(0.2, 0.62, 0.36);
const RIGHT_OSTIUM = new Vector3(-0.3, 0.6, 0.42);
const LEFT_MAIN_END: PathPoint = [1.0, G + 0.02];

const LEFT_MAIN: SegmentDef = {
  id: "left-main",
  radius: MAIN,
  points: [LEFT_OSTIUM, [1.12, G + 0.08], LEFT_MAIN_END],
};

/**
 * Adding a vessel = adding an entry here (plus a target of the same name in the backend).
 * The left main stem is drawn with the LAD; the dataset has no separate left-main label.
 */
export const VESSELS: VesselDef[] = [
  {
    id: "LAD",
    name: "Left anterior descending",
    territory: "Front wall and septum of the left ventricle",
    labelAt: [1.3, -0.45],
    segments: [
      LEFT_MAIN,
      {
        id: "lad-main",
        radius: MAIN,
        points: [LEFT_MAIN_END, [1.14, 0.3], [1.22, 0.05], [1.27, -0.25], [1.31, -0.55], [1.34, -0.82], [1.4, -0.96]],
      },
      { id: "lad-diagonal-1", radius: BRANCH, points: [[1.15, 0.27], [0.95, 0.1], [0.78, -0.12], [0.66, -0.36]] },
      { id: "lad-diagonal-2", radius: BRANCH, points: [[1.25, -0.12], [1.08, -0.3], [0.96, -0.5], [0.9, -0.68]] },
    ],
  },
  {
    id: "LCX",
    name: "Left circumflex",
    territory: "Side and back wall of the left ventricle",
    labelAt: [0.25, 0.28],
    segments: [
      {
        id: "lcx-main",
        radius: MAIN,
        points: [LEFT_MAIN_END, [0.7, G], [0.3, G], [-0.2, G - 0.01], [-0.75, G - 0.02], [-1.25, G - 0.03]],
      },
      { id: "lcx-marginal", radius: BRANCH, points: [[0.3, G], [0.2, 0.25], [0.14, -0.05], [0.1, -0.38], [0.08, -0.62]] },
      { id: "lcx-posterolateral", radius: BRANCH, points: [[-0.6, G - 0.02], [-0.68, 0.22], [-0.72, -0.08], [-0.74, -0.35]] },
    ],
  },
  {
    id: "RCA",
    name: "Right coronary artery",
    territory: "Right ventricle and underside of the heart",
    labelAt: [2.85, 0.2],
    segments: [
      {
        id: "rca-main",
        radius: MAIN,
        points: [RIGHT_OSTIUM, [2.15, G + 0.04], [2.5, G], [2.95, G], [3.45, G - 0.01], [3.95, G - 0.02], [4.42, G - 0.03]],
      },
      { id: "rca-marginal", radius: BRANCH, points: [[2.75, G], [2.8, 0.2], [2.84, -0.12], [2.88, -0.42], [2.9, -0.62]] },
      { id: "rca-posterior-descending", radius: BRANCH, points: [[4.42, G - 0.03], [4.58, 0.22], [4.62, -0.1], [4.64, -0.42], [4.66, -0.7]] },
    ],
  },
];

const toVector = (point: PathPoint, radius: number) =>
  point instanceof Vector3 ? point.clone() : liftedPoint(point[0], point[1], radius * 0.55);

export function buildSegments(vessel: VesselDef): VesselSegment[] {
  return vessel.segments.map(({ id, radius, points }) => ({
    id,
    radius,
    curve: new CatmullRomCurve3(points.map((point) => toVector(point, radius)), false, "centripetal"),
  }));
}

/** World-space label anchor (lifted clear of the surface) and the surface normal there. */
export function labelAnchor(vessel: VesselDef): { position: Vector3; normal: Vector3 } {
  return {
    position: liftedPoint(...vessel.labelAt, 0.16).applyEuler(HEART_ROTATION),
    normal: surfaceNormal(...vessel.labelAt).applyEuler(HEART_ROTATION),
  };
}

export interface CameraView {
  position: Vector3;
  target: Vector3;
}

export const DEFAULT_VIEW: CameraView = {
  position: new Vector3(0.5, 0.8, 8.2),
  target: new Vector3(0.05, 0.45, 0),
};

export const TORSO_VIEW: CameraView = {
  position: new Vector3(0.4, 1.2, 17),
  target: new Vector3(-0.6, 0.6, 0),
};

const FOCUS_DISTANCE = 6.4;

/** Camera pose looking straight at the middle of a vessel's main segment (world space). */
export function focusView(vessel: VesselDef): CameraView {
  const main = buildSegments(vessel).reduce((a, b) => (b.curve.getLength() > a.curve.getLength() ? b : a));
  const target = main.curve.getPointAt(0.45).applyEuler(HEART_ROTATION);
  const outward = target.clone().setY(target.y * 0.35).normalize();
  // Bias towards the viewer so posterior segments are seen from the side, not from behind.
  const direction = outward.add(new Vector3(0, 0.1, 0.55)).normalize();
  return { position: target.clone().addScaledVector(direction, FOCUS_DISTANCE), target };
}
