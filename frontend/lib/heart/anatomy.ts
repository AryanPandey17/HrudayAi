import { Vector3 } from "three";

/** A coronary artery the viewer can colour. `id` must equal both a GLB node and a model target. */
export interface VesselInfo {
  id: string;
  name: string;
  territory: string;
}

/**
 * Adding a vessel = adding a mesh of that name to the heart model, a target of that name in the
 * backend, and one entry here. Each vessel is a single object: the models predict per vessel,
 * not per segment, so segments are never coloured separately.
 */
export const VESSELS: VesselInfo[] = [
  { id: "LAD", name: "Left anterior descending", territory: "front wall and septum of the left ventricle" },
  { id: "LCX", name: "Left circumflex", territory: "side and back wall of the left ventricle" },
  { id: "RCA", name: "Right coronary artery", territory: "right ventricle and underside of the heart" },
];

export type StructureTone = "wall" | "artery" | "vein";

/** Non-interactive anatomy nodes in the GLB and the neutral tone each one wears. */
export const STRUCTURES: { node: string; tone: StructureTone }[] = [
  { node: "heart_wall", tone: "wall" },
  { node: "aorta", tone: "artery" },
  { node: "left_main", tone: "artery" },
  { node: "pulmonary_veins", tone: "artery" },
  { node: "pulmonary_arteries", tone: "vein" },
  { node: "venae_cavae", tone: "vein" },
];

export const HEART_WALL_NODE = "heart_wall";

export interface CameraView {
  position: Vector3;
  target: Vector3;
}

export const DEFAULT_VIEW: CameraView = {
  position: new Vector3(1.2, 0.9, 9.4),
  target: new Vector3(0, 0.35, 0),
};

export const TORSO_VIEW: CameraView = {
  position: new Vector3(0.6, 1.4, 19),
  target: new Vector3(-0.6, 0.6, 0),
};
