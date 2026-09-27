import * as THREE from 'three';
import type { Vec3Tuple } from '../types/index.ts';

export function vec(a: Vec3Tuple): THREE.Vector3 {
  return new THREE.Vector3(a[0], a[1], a[2]);
}

export function clamp(x: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, x));
}
