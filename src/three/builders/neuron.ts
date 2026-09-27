import * as THREE from 'three';
import { ACCENT_COLOR } from '../../types/index.ts';
import { bioMat } from '../materials.ts';
import { addShell, addTube, ball, randomGenerator, vec } from '../geometry.ts';
import type { Vec3Tuple } from '../../types/index.ts';

const UP = new THREE.Vector3(0, 1, 0);

type DendriteRoot = {
  readonly dir: Vec3Tuple;
  readonly len: number;
  readonly r: number;
};

export function buildNeuron(): THREE.Group {
  const g = new THREE.Group();
  const C = new THREE.Vector3(-1.7, 0, 0);

  const somaMat = bioMat(0xe8d5c5, { roughness: 0.35, clearcoat: 0.5 });
  const somaGeo = new THREE.SphereGeometry(1, 64, 40);
  const attr = somaGeo.attributes.position!;
  const v = new THREE.Vector3();
  const rngSoma = randomGenerator(123);
  for (let i = 0; i < attr.count; i++) {
    v.fromBufferAttribute(attr, i);
    const warp = 1 + 0.05 * Math.sin(v.y * 7 + v.z * 5) + 0.03 * Math.sin(v.x * 9 + v.y * 3) + 0.02 * rngSoma();
    attr.setXYZ(i, v.x * 0.97 * warp, v.y * 0.85 * warp, v.z * 0.76 * warp);
  }
  somaGeo.computeVertexNormals();
  addShell(g, somaGeo, somaMat, 1, 0xd0cec6).position.copy(C);

  const nucleusMat = bioMat(0x795b99, { roughness: 0.55, clearcoat: 0.3 });
  ball(g, C.clone().add(new THREE.Vector3(-0.1, 0.02, 0.02)), [0.39, 0.37, 0.34], nucleusMat);
  ball(g, C.clone().add(new THREE.Vector3(0.05, 0.1, 0.29)), 0.105, bioMat(0x3a2040, { roughness: 0.8 }));

  const chromatinRng = randomGenerator(777);
  const chromatinMat = bioMat(0x5a3d6b, { roughness: 0.7 });
  for (let cs = 0; cs < 18; cs++) {
    const cdir = new THREE.Vector3(chromatinRng() - 0.5, chromatinRng() - 0.5, chromatinRng() - 0.5).normalize();
    const cr = 0.15 + chromatinRng() * 0.18;
    ball(g, C.clone().add(cdir.multiplyScalar(cr)), 0.018 + chromatinRng() * 0.012, chromatinMat);
  }

  const rng = randomGenerator(17031);
  const nisslMat = bioMat(0x6b5b75, { roughness: 0.7 });
  const nissl = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), nisslMat, 160);
  const dummy = new THREE.Object3D();
  for (let n = 0; n < 160; n++) {
    const y = rng() * 2 - 1;
    const angle = rng() * Math.PI * 2;
    const rr = Math.sqrt(1 - y * y);
    const radial = 0.55 + rng() * 0.18;
    dummy.position.set(
      C.x + rr * Math.cos(angle) * 0.68 * radial,
      rr * Math.sin(angle) * 0.58 * radial,
      y * 0.52 * radial,
    );
    dummy.scale.set(0.04 + rng() * 0.035, 0.02 + rng() * 0.02, 0.025 + rng() * 0.012);
    dummy.rotation.set(rng(), rng(), rng());
    dummy.updateMatrix();
    nissl.setMatrixAt(n, dummy.matrix);
  }
  nissl.instanceMatrix.needsUpdate = true;
  g.add(nissl);

  const dendMat = bioMat(0xc98a61, { roughness: 0.45, clearcoat: 0.4 });

  const buildDendrite = (
    start: THREE.Vector3,
    direction: THREE.Vector3,
    length: number,
    radius: number,
    depth: number,
    rngFn: () => number,
  ): void => {
    if (depth <= 0 || radius < 0.025) return;
    const mid = start.clone().addScaledVector(direction, length * 0.5);
    const end = start.clone().addScaledVector(direction, length);
    const perp = new THREE.Vector3(direction.y, -direction.x, direction.z * 0.3).normalize();
    mid.addScaledVector(perp, (rngFn() - 0.5) * length * 0.15);

    addTube(g, [start, mid, end], [radius, radius * 0.82, radius * 0.68], dendMat, 18, 12);
    ball(g, end, radius * 0.68, dendMat);

    const spineCount = depth >= 2 ? 5 : 3;
    for (let s = 1; s <= spineCount; s++) {
      const t = s / (spineCount + 1);
      const origin = start.clone().lerp(end, t);
      const spineR = radius * 0.35;
      const spineDir = perp
        .clone()
        .multiplyScalar(rngFn() - 0.5)
        .addScaledVector(direction, (rngFn() - 0.5) * 0.3)
        .add(new THREE.Vector3(0, (rngFn() - 0.5) * 0.4, (rngFn() - 0.5) * 0.4))
        .normalize();
      const spineLen = 0.06 + rngFn() * 0.05;
      const spineEnd = origin.clone().addScaledVector(spineDir, spineLen);
      addTube(g, [origin, spineEnd], [spineR * 0.4, spineR * 0.25], dendMat, 5, 6);
      ball(g, spineEnd, spineR * 0.5, dendMat);
    }

    const branchCount = depth >= 2 ? 2 + (rngFn() > 0.6 ? 1 : 0) : 2;
    for (let b = 0; b < branchCount; b++) {
      const turnAngle = (b - (branchCount - 1) / 2) * 0.7 + (rngFn() - 0.5) * 0.4;
      const turnAxis = new THREE.Vector3(rngFn() - 0.5, rngFn() - 0.5, rngFn() - 0.5).normalize();
      const newDir = direction.clone().applyAxisAngle(turnAxis, turnAngle).normalize();
      buildDendrite(end, newDir, length * (0.55 + rngFn() * 0.2), radius * 0.62, depth - 1, rngFn);
    }
  };

  const dendriteRoots: readonly DendriteRoot[] = [
    { dir: [-0.92, 0.6, 0.16], len: 1.1, r: 0.19 },
    { dir: [-0.92, -0.59, 0.18], len: 1.05, r: 0.18 },
    { dir: [-0.86, -0.08, -0.64], len: 1.0, r: 0.17 },
    { dir: [-0.25, 0.98, -0.18], len: 0.95, r: 0.16 },
    { dir: [-0.12, -0.97, -0.23], len: 0.95, r: 0.16 },
    { dir: [-0.38, 0.75, 0.64], len: 0.9, r: 0.15 },
  ];
  const dendRng = randomGenerator(2024);
  dendriteRoots.forEach((root) => {
    const dir = vec(root.dir).normalize();
    const start = C.clone().addScaledVector(dir, 0.69);
    buildDendrite(start, dir, root.len, root.r, 3, dendRng);
  });

  const axonMat = bioMat(0x8da6b5, { roughness: 0.25, clearcoat: 0.7 });
  addTube(
    g,
    [
      C.clone().add(new THREE.Vector3(0.66, -0.02, 0)),
      new THREE.Vector3(-0.69, -0.02, 0.01),
      new THREE.Vector3(-0.41, -0.025, 0.02),
    ],
    [0.31, 0.2, 0.12],
    axonMat,
    16,
    14,
  );

  const axPoints: THREE.Vector3[] = [
    new THREE.Vector3(-0.42, -0.025, 0.02),
    new THREE.Vector3(0.63, 0.08, 0.07),
    new THREE.Vector3(1.8, -0.075, -0.03),
    new THREE.Vector3(3, 0.065, 0.04),
    new THREE.Vector3(4.08, 0.02, 0.04),
  ];
  const axCurve = new THREE.CatmullRomCurve3(axPoints);
  addTube(g, axPoints, [0.115, 0.108, 0.105, 0.1, 0.078], axonMat, 80, 14);

  const myelinMat = bioMat(0xeae6df, {
    roughness: 0.08,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    transparent: true,
    opacity: 0.92,
  });
  const nodeMat = bioMat(0xa64953, { roughness: 0.4, transparent: true, opacity: 0.7 });
  const schwannNucMat = bioMat(0x5c5a55, { roughness: 0.7 });
  const myelinSegments: readonly (readonly [number, number])[] = [
    [0.06, 0.24],
    [0.3, 0.48],
    [0.54, 0.72],
    [0.78, 0.96],
  ];
  myelinSegments.forEach((range, segIdx) => {
    const pts: THREE.Vector3[] = [];
    const rs: number[] = [];
    for (let q = 0; q <= 14; q++) {
      const local = q / 14;
      pts.push(axCurve.getPointAt(THREE.MathUtils.lerp(range[0], range[1], local)));
      rs.push(0.13 + 0.2 * Math.pow(Math.sin(Math.PI * local), 0.55));
    }
    addTube(g, pts, rs, myelinMat, 36, 20);

    const midT = (range[0] + range[1]) / 2;
    const midPoint = axCurve.getPointAt(midT);
    const tangent = axCurve.getTangentAt(midT);
    const sideDir = new THREE.Vector3().crossVectors(tangent, UP).normalize();
    if (segIdx % 2 === 0) sideDir.negate();
    const nucPos = midPoint
      .clone()
      .addScaledVector(sideDir, 0.26)
      .add(new THREE.Vector3(0, 0.04 * (segIdx % 2 ? 1 : -1), 0));
    ball(g, nucPos, [0.11, 0.05, 0.06], schwannNucMat);

    if (segIdx < myelinSegments.length - 1) {
      const nextRange = myelinSegments[segIdx + 1]!;
      const nodeT = (range[1] + nextRange[0]) / 2;
      const nodePos = axCurve.getPointAt(nodeT);
      ball(g, nodePos, 0.115, nodeMat);
    }
  });

  const startTerminal = axCurve.getPointAt(1);
  const boutonMat = bioMat(ACCENT_COLOR, { roughness: 0.35, clearcoat: 0.5 });
  const vesicleMat = bioMat(0xe8c5cc, {
    roughness: 0.2,
    clearcoat: 0.8,
    transparent: true,
    opacity: 0.85,
  });
  const terminalDirs: readonly Vec3Tuple[] = [
    [0.72, 0.47, 0.16],
    [0.77, -0.46, 0.22],
    [0.74, 0.23, -0.44],
    [0.75, -0.26, -0.4],
  ];
  terminalDirs.forEach((raw) => {
    const direction = vec(raw).normalize();
    const tip = startTerminal.clone().addScaledVector(direction, 0.87);
    addTube(g, [startTerminal, tip], [0.075, 0.033], axonMat, 12, 8);
    ball(g, tip, [0.14, 0.12, 0.13], boutonMat);

    const vRng = randomGenerator(Math.floor(raw[0] * 1000) + 42);
    for (let vs = 0; vs < 8; vs++) {
      const vpos = tip.clone().add(
        new THREE.Vector3((vRng() - 0.5) * 0.12, (vRng() - 0.5) * 0.1, (vRng() - 0.5) * 0.12),
      );
      ball(g, vpos, 0.012 + vRng() * 0.008, vesicleMat);
    }
  });
  return g;
}
