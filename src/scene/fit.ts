import * as THREE from 'three';

/** 单位包围盒的 8 个角 */
const CORNERS: readonly (readonly [number, number, number])[] = [
  [-1, -1, -1],
  [1, -1, -1],
  [-1, 1, -1],
  [1, 1, -1],
  [-1, -1, 1],
  [1, -1, 1],
  [-1, 1, 1],
  [1, 1, 1],
];

type Basis = {
  readonly dx: number;
  readonly dy: number;
  readonly dz: number;
  readonly rx: number;
  readonly rz: number;
  readonly ux: number;
  readonly uy: number;
  readonly uz: number;
};

function basisAt(theta: number, phi: number): Basis {
  const sinPhi = Math.sin(phi);
  const dx = sinPhi * Math.sin(theta);
  const dy = Math.cos(phi);
  const dz = sinPhi * Math.cos(theta);
  // right = normalize(cross(worldUp, dir))，与 three 的 lookAt 基向量一致
  const rl = Math.hypot(dz, dx) || 1;
  const rx = dz / rl;
  const rz = -dx / rl;
  // up = dir × right
  return { dx, dy, dz, rx, rz, ux: dy * rz, uy: dz * rx - dx * rz, uz: -dy * rx };
}

/**
 * 计算“让模型投影后的包围框恰好充满画面 fill 比例”的相机距离。
 *
 * 单个角点在 NDC 中的占幅为 `max(|x| / (depth·tanH), |y| / (depth·tanV))`，
 * 该值随距离单调递减，故用二分法求解；再对所有采样方位取最大值，
 * 保证自动旋转到任意角度都不会出画。
 */
export function fitDistance(camera: THREE.PerspectiveCamera, size: THREE.Vector3, fill = 0.9): number {
  const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
  const tanH = tanV * Math.max(0.32, camera.aspect);
  const hx = Math.max(1e-4, Math.abs(size.x) * 0.5);
  const hy = Math.max(1e-4, Math.abs(size.y) * 0.5);
  const hz = Math.max(1e-4, Math.abs(size.z) * 0.5);

  const azimuths = 18;
  const phis = [0.5, 0.8, 1.13, 1.45, 1.75];
  const along: number[] = [0, 0, 0, 0, 0, 0, 0, 0];
  const side: number[] = [0, 0, 0, 0, 0, 0, 0, 0];
  const vert: number[] = [0, 0, 0, 0, 0, 0, 0, 0];
  let distance = 0;

  for (let s = 0; s < azimuths; s += 1) {
    const theta = (s / azimuths) * Math.PI * 2;
    for (const phi of phis) {
      const b = basisAt(theta, phi);
      let maxAlong = -Infinity;
      for (let i = 0; i < CORNERS.length; i += 1) {
        const c = CORNERS[i]!;
        const px = c[0] * hx;
        const py = c[1] * hy;
        const pz = c[2] * hz;
        const a = px * b.dx + py * b.dy + pz * b.dz;
        along[i] = a;
        side[i] = Math.abs(px * b.rx + pz * b.rz);
        vert[i] = Math.abs(px * b.ux + py * b.uy + pz * b.uz);
        if (a > maxAlong) maxAlong = a;
      }

      const extent = (d: number): number => {
        let worst = 0;
        for (let i = 0; i < CORNERS.length; i += 1) {
          const depth = d - along[i]!;
          if (depth <= 1e-5) return Infinity;
          const ex = side[i]! / (depth * tanH);
          const ey = vert[i]! / (depth * tanV);
          const value = ex > ey ? ex : ey;
          if (value > worst) worst = value;
        }
        return worst;
      };

      const near = maxAlong * 1.02 + 1e-3;
      let solved = near;
      if (extent(near) > fill) {
        let lo = near;
        let hi = near + 1;
        let guard = 0;
        while (extent(hi) > fill && guard < 48) {
          hi = hi * 1.5 + 0.5;
          guard += 1;
        }
        for (let i = 0; i < 34; i += 1) {
          const mid = (lo + hi) * 0.5;
          if (extent(mid) > fill) lo = mid;
          else hi = mid;
        }
        solved = hi;
      }
      if (solved > distance) distance = solved;
    }
  }

  return Math.max(distance, 0.6);
}
