import * as THREE from 'three';
import type { OrbitState, PointerRecord } from '../types/index.ts';
import { clamp } from '../three/geometry.ts';

export function createOrbit(): OrbitState {
  return {
    theta: 0.25,
    phi: 1.13,
    distance: 10,
    targetTheta: 0.25,
    targetPhi: 1.13,
    targetDistance: 10,
    minDistance: 2,
    maxDistance: 50,
    focus: new THREE.Vector3(),
    targetFocus: new THREE.Vector3(),
  };
}

export function pan(
  orbit: OrbitState,
  camera: THREE.PerspectiveCamera,
  host: HTMLElement,
  dx: number,
  dy: number,
): void {
  const factor =
    (2 * orbit.targetDistance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / Math.max(1, host.clientHeight);
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
  const up = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1);
  orbit.targetFocus.addScaledVector(right, -dx * factor);
  orbit.targetFocus.addScaledVector(up, dy * factor);
}

export type PointerHandlerOptions = {
  readonly host: HTMLElement;
  readonly camera: THREE.PerspectiveCamera;
  readonly orbit: OrbitState;
  readonly onInteractStart: () => void;
};

export type PointerController = {
  readonly pointerMap: Map<number, PointerRecord>;
  getGesture(): { distance: number; x: number; y: number } | null;
  dispose(): void;
};

export function createPointerController(options: PointerHandlerOptions): PointerController {
  const { host, camera, orbit, onInteractStart } = options;
  const pointerMap = new Map<number, PointerRecord>();
  let gesture: { distance: number; x: number; y: number } | null = null;

  const onContextMenu = (e: Event): void => {
    e.preventDefault();
  };

  const onPointerDown = (e: PointerEvent): void => {
    e.preventDefault();
    onInteractStart();
    host.setPointerCapture(e.pointerId);
    pointerMap.set(e.pointerId, { x: e.clientX, y: e.clientY, button: e.button });
    if (pointerMap.size === 2) {
      const pair = Array.from(pointerMap.values());
      const a = pair[0]!;
      const b = pair[1]!;
      gesture = {
        distance: Math.hypot(a.x - b.x, a.y - b.y),
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
      };
    }
  };

  const onPointerMove = (e: PointerEvent): void => {
    const p = pointerMap.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (pointerMap.size === 1) {
      if (p.button === 2) {
        pan(orbit, camera, host, dx, dy);
      } else {
        orbit.targetTheta -= dx * 0.006;
        orbit.targetPhi = clamp(orbit.targetPhi - dy * 0.0055, 0.12, Math.PI - 0.12);
      }
    } else if (pointerMap.size === 2) {
      const pair = Array.from(pointerMap.values());
      const a = pair[0]!;
      const b = pair[1]!;
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      if (gesture && distance > 5) {
        orbit.targetDistance = clamp(
          (orbit.targetDistance * gesture.distance) / distance,
          orbit.minDistance,
          orbit.maxDistance,
        );
        pan(orbit, camera, host, midX - gesture.x, midY - gesture.y);
      }
      gesture = { distance, x: midX, y: midY };
    }
  };

  const onPointerEnd = (e: PointerEvent): void => {
    pointerMap.delete(e.pointerId);
    if (pointerMap.size < 2) gesture = null;
  };

  const onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    onInteractStart();
    orbit.targetDistance = clamp(
      orbit.targetDistance * Math.exp(e.deltaY * 0.001),
      orbit.minDistance,
      orbit.maxDistance,
    );
  };

  host.addEventListener('contextmenu', onContextMenu);
  host.addEventListener('pointerdown', onPointerDown);
  host.addEventListener('pointermove', onPointerMove);
  host.addEventListener('pointerup', onPointerEnd);
  host.addEventListener('pointercancel', onPointerEnd);
  host.addEventListener('wheel', onWheel, { passive: false });

  return {
    pointerMap,
    getGesture: () => gesture,
    dispose: () => {
      host.removeEventListener('contextmenu', onContextMenu);
      host.removeEventListener('pointerdown', onPointerDown);
      host.removeEventListener('pointermove', onPointerMove);
      host.removeEventListener('pointerup', onPointerEnd);
      host.removeEventListener('pointercancel', onPointerEnd);
      host.removeEventListener('wheel', onWheel);
    },
  };
}
