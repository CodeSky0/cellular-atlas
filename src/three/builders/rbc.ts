import * as THREE from 'three';
import { addShell } from '../geometry.ts';

type RBCOptions = {
  readonly offsetX: number;
  readonly offsetZ: number;
  readonly rotationY: number;
  readonly scale: number;
  readonly opacity: number;
  readonly tiltZ: number;
};

export function buildRBC(): THREE.Group {
  const g = new THREE.Group();

  const makeRBC = (options: RBCOptions): THREE.Group => {
    const { offsetX, offsetZ, rotationY, scale, opacity, tiltZ } = options;
    const subGroup = new THREE.Group();
    const radius = 2.0 * scale;
    const profile: THREE.Vector2[] = [];
    const steps = 128;

    const halfThickness = (u: number): number => {
      const r = u;
      const ellipse = Math.sqrt(Math.max(0, 1 - r * r));
      const dimple = 1 - 0.85 * Math.exp(-r * r * 6);
      return 0.5 * ellipse * dimple * scale;
    };
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      profile.push(new THREE.Vector2(Math.max(0.0001, radius * u), -halfThickness(u)));
    }
    for (let j = steps; j >= 0; j--) {
      const v = j / steps;
      profile.push(new THREE.Vector2(Math.max(0.0001, radius * v), halfThickness(v)));
    }

    const geo = new THREE.LatheGeometry(profile, 96);
    geo.computeVertexNormals();

    const colors: number[] = [];
    const center = new THREE.Color(0x8c1a2b);
    const mid = new THREE.Color(0xc52538);
    const rim = new THREE.Color(0xe8384e);
    const p = geo.attributes.position!;
    for (let k = 0; k < p.count; k++) {
      const r = Math.hypot(p.getX(k), p.getZ(k)) / radius;
      let col: THREE.Color;
      if (r < 0.45) {
        col = center.clone().lerp(mid, r / 0.45);
      } else {
        col = mid.clone().lerp(rim, (r - 0.45) / 0.55);
      }
      colors.push(col.r, col.g, col.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const rbcMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.12,
      metalness: 0.0,
      clearcoat: 0.9,
      clearcoatRoughness: 0.08,
    });
    const cell = addShell(subGroup, geo, rbcMat, opacity, 0xa8a69f);
    cell.rotation.x = 0.65;
    cell.rotation.y = rotationY;
    if (tiltZ) cell.rotation.z = tiltZ;
    subGroup.position.set(offsetX, 0, offsetZ);
    return subGroup;
  };

  g.add(makeRBC({ offsetX: 0, offsetZ: 0, rotationY: 0, scale: 1, opacity: 1, tiltZ: 0 }));
  g.add(makeRBC({ offsetX: -2.8, offsetZ: -0.2, rotationY: 0.1, scale: 0.75, opacity: 0.5, tiltZ: 0 }));
  g.add(makeRBC({ offsetX: -4.8, offsetZ: 0.15, rotationY: -0.08, scale: 0.7, opacity: 0.3, tiltZ: 0 }));
  g.add(makeRBC({ offsetX: 2.9, offsetZ: -0.4, rotationY: 0.6, scale: 0.8, opacity: 0.5, tiltZ: 0.5 }));

  return g;
}
