import { useFrame } from "@react-three/fiber";
import type { RefObject } from "react";
import { Vector3 } from "three";

import type { VesselAnchor } from "@/lib/heart/geometry";

interface VesselLabelsProps {
  anchors: Record<string, VesselAnchor>;
  /** DOM label elements by vessel id, rendered by the parent outside the canvas. */
  elements: RefObject<Map<string, HTMLElement>>;
}

const projected = new Vector3();
const toCamera = new Vector3();

/**
 * Keeps plain DOM labels glued to their 3D anchors. Runs only on rendered frames, and fades
 * labels whose anchor faces away from the camera.
 */
export function VesselLabels({ anchors, elements }: VesselLabelsProps) {
  useFrame(({ camera, size }) => {
    for (const [id, { label, outward }] of Object.entries(anchors)) {
      const element = elements.current.get(id);
      if (!element) continue;
      projected.copy(label).project(camera);
      const x = (projected.x * 0.5 + 0.5) * size.width;
      const y = (-projected.y * 0.5 + 0.5) * size.height;
      const facing = outward.dot(toCamera.copy(camera.position).sub(label).normalize());
      element.style.transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      element.style.opacity = facing > -0.15 ? "1" : "0.5";
    }
  });
  return null;
}
