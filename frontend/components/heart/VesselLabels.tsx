import { useFrame } from "@react-three/fiber";
import { type RefObject, useMemo } from "react";
import { Vector3 } from "three";

import { labelAnchor, type VesselDef } from "@/lib/heart/anatomy";

interface VesselLabelsProps {
  vessels: VesselDef[];
  /** DOM label elements by vessel id, rendered by the parent outside the canvas. */
  elements: RefObject<Map<string, HTMLElement>>;
}

const projected = new Vector3();
const toCamera = new Vector3();

/**
 * Keeps plain DOM labels glued to their 3D anchors. Runs only on rendered frames, and fades
 * labels whose anchor faces away from the camera.
 */
export function VesselLabels({ vessels, elements }: VesselLabelsProps) {
  const anchors = useMemo(() => vessels.map((vessel) => ({ id: vessel.id, ...labelAnchor(vessel) })), [vessels]);

  useFrame(({ camera, size }) => {
    for (const { id, position, normal } of anchors) {
      const element = elements.current.get(id);
      if (!element) continue;
      projected.copy(position).project(camera);
      const x = (projected.x * 0.5 + 0.5) * size.width;
      const y = (-projected.y * 0.5 + 0.5) * size.height;
      const facing = normal.dot(toCamera.copy(camera.position).sub(position).normalize());
      element.style.transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      element.style.opacity = facing > -0.15 ? "1" : "0.45";
    }
  });
  return null;
}
