import * as THREE from 'three';
import type { ShellMesh, Vec3Tuple, WireMesh } from '../types/index.ts';

export function vec(a: Vec3Tuple): THREE.Vector3 {
  return new THREE.Vector3(a[0], a[1], a[2]);
}

export function clamp(x: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, x));
}

export function randomGenerator(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const sphereGeo = new THREE.SphereGeometry(1, 32, 24);

export function ball(
  group: THREE.Group,
  position: THREE.Vector3,
  scale: number | Vec3Tuple,
  mat: THREE.Material,
): THREE.Mesh {
  const mesh = new THREE.Mesh(sphereGeo, mat);
  mesh.position.copy(position);
  if (typeof scale === 'number') {
    mesh.scale.setScalar(scale);
  } else {
    mesh.scale.set(scale[0], scale[1], scale[2]);
  }
  group.add(mesh);
  return mesh;
}

export function tubeGeometry(
  points: readonly THREE.Vector3[],
  radii: readonly number[],
  steps: number,
  sides: number,
  uvPeriod?: number,
): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points as THREE.Vector3[]);
  const frames = curve.computeFrenetFrames(steps, false);
  const length = curve.getLength();
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const p = curve.getPointAt(t);
    const at = t * (radii.length - 1);
    const lo = Math.min(Math.floor(at), radii.length - 2);
    const radius = THREE.MathUtils.lerp(radii[lo]!, radii[lo + 1]!, at - lo);

    for (let j = 0; j <= sides; j++) {
      const angle = (j / sides) * Math.PI * 2;
      const offset = frames.normals[i]!
        .clone()
        .multiplyScalar(Math.cos(angle) * radius)
        .addScaledVector(frames.binormals[i]!, Math.sin(angle) * radius);
      const v = p.clone().add(offset);
      positions.push(v.x, v.y, v.z);
      uvs.push(uvPeriod ? (t * length) / uvPeriod : t, j / sides);

      if (i < steps && j < sides) {
        const a = i * (sides + 1) + j;
        const b = a + 1;
        const c = a + sides + 1;
        const d = c + 1;
        indices.push(a, b, c, b, d, c);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function addTube(
  group: THREE.Group,
  points: readonly THREE.Vector3[],
  radii: readonly number[],
  mat: THREE.Material,
  steps = 14,
  sides = 12,
  uvPeriod?: number,
): THREE.Mesh {
  const mesh = new THREE.Mesh(tubeGeometry(points, radii, steps, sides, uvPeriod), mat);
  group.add(mesh);
  return mesh;
}

export function addShell(
  group: THREE.Group,
  geo: THREE.BufferGeometry,
  mat: THREE.MeshPhysicalMaterial,
  opacity: number,
  wireColor: THREE.ColorRepresentation | false,
): ShellMesh {
  const opaque = opacity >= 1;
  mat.transparent = !opaque;
  mat.opacity = opaque ? 1 : opacity;
  mat.depthWrite = opaque;
  mat.side = THREE.FrontSide;

  const mesh = new THREE.Mesh(geo, mat) as ShellMesh;
  mesh.userData.shellOpacity = opacity;
  mesh.userData.shellOpaque = opaque;
  group.add(mesh);

  if (wireColor !== false) {
    const wire = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        color: wireColor,
        wireframe: true,
        transparent: true,
        opacity: 0.08,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      }),
    ) as WireMesh;
    wire.visible = false;
    wire.userData.isWire = true;
    mesh.add(wire);
  }
  return mesh;
}
