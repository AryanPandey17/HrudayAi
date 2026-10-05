import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

import type { CameraView } from "@/lib/heart/anatomy";

const PAN_LIMIT = new Vector3(1.6, 1.8, 1.6);
const PAN_MIN = PAN_LIMIT.clone().negate();
const GLIDE_RATE = 4.5;
const ARRIVED = 0.01;
const COMFORTABLE_ASPECT = 1.25; // narrower canvases pull the camera back to keep the heart in frame

const destination = new Vector3();

interface CameraRigProps {
  view: CameraView;
  /** Changes whenever the same view should be re-applied (e.g. the reset button). */
  viewKey: number;
  maxDistance: number;
}

/** Orbit / zoom / limited pan, plus a smooth glide to `view` whenever it changes. */
export function CameraRig({ view, viewKey, maxDistance }: CameraRigProps) {
  const controls = useRef<OrbitControlsImpl>(null);
  const gliding = useRef(false);
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    gliding.current = true;
    invalidate();
  }, [view, viewKey, invalidate]);

  useFrame((state, delta) => {
    const orbit = controls.current;
    if (!gliding.current || !orbit) return;
    const pullBack = Math.max(1, COMFORTABLE_ASPECT / (state.size.width / state.size.height));
    destination.copy(view.position).sub(view.target).multiplyScalar(pullBack).add(view.target);
    const blend = 1 - Math.exp(-Math.min(delta, 0.05) * GLIDE_RATE);
    state.camera.position.lerp(destination, blend);
    orbit.target.lerp(view.target, blend);
    orbit.update();
    const remaining = state.camera.position.distanceTo(destination) + orbit.target.distanceTo(view.target);
    gliding.current = remaining > ARRIVED;
    if (gliding.current) state.invalidate();
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.12}
      minDistance={2.4}
      maxDistance={maxDistance}
      onStart={() => (gliding.current = false)}
      onChange={() => controls.current?.target.clamp(PAN_MIN, PAN_LIMIT)}
    />
  );
}
