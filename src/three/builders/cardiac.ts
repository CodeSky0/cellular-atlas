import * as THREE from 'three';
import { ACCENT_COLOR } from '../../types/index.ts';
import { bioMat } from '../materials.ts';
import { addShell, addTube, ball, clamp, randomGenerator, tubeGeometry, vec } from '../geometry.ts';
import { makeStriationNormalMap, makeStriationTexture } from '../textures.ts';

const UP = new THREE.Vector3(0, 1, 0);

type Branch = {
  readonly points: readonly THREE.Vector3[];
  readonly radii: readonly number[];
};

export function buildCardiac(): THREE.Group {
  const g = new THREE.Group();
  const stripeTexture = makeStriationTexture();
  const stripeNormal = makeStriationNormalMap();
  const fiberMat = bioMat(0xf2e6e6, {
    map: stripeTexture,
    normalMap: stripeNormal,
    normalScale: new THREE.Vector2(0.4, 0.4),
    roughness: 0.45,
    clearcoat: 0.3,
  });
  const discMat = bioMat(0x632d51, { roughness: 0.7, clearcoat: 0.3 });
  const nucleusMat = bioMat(0x7962a9, { roughness: 0.55, clearcoat: 0.3 });
  const mitoMat = bioMat(0xd7a267, { roughness: 0.35, clearcoat: 0.6 });
  const srMat = bioMat(0xc8a8b8, {
    roughness: 0.3,
    transparent: true,
    opacity: 0.6,
    clearcoat: 0.4,
  });
  const tTubuleMat = bioMat(0x8a6b5a, { roughness: 0.5, transparent: true, opacity: 0.7 });
  const period = 0.42;

  const fiber = (points: readonly THREE.Vector3[], radii: readonly number[]): void => {
    addShell(g, tubeGeometry(points, radii, 56, 28, period), fiberMat, 1, 0xd0cec6);
  };

  fiber(
    [vec([-1.88, 0, 0]), vec([-0.9, 0.04, 0]), vec([0.15, 0, 0]), vec([1.67, 0.03, 0])],
    [0.49, 0.68, 0.68, 0.45],
  );

  const branches: readonly Branch[] = [
    {
      points: [vec([1.02, 0.07, 0]), vec([1.68, 0.28, 0.01]), vec([2.65, 0.92, 0.1])],
      radii: [0.46, 0.4, 0.33],
    },
    {
      points: [vec([1.02, -0.08, 0]), vec([1.68, -0.35, -0.06]), vec([2.53, -0.94, -0.12])],
      radii: [0.46, 0.39, 0.31],
    },
    {
      points: [vec([-1.19, 0.02, 0]), vec([-1.79, 0.21, 0.02]), vec([-2.67, 0.61, 0.11])],
      radii: [0.43, 0.37, 0.31],
    },
  ];
  branches.forEach((item) => fiber(item.points, item.radii));

  const myofibrilMat = bioMat(0xb8737d, {
    map: stripeTexture,
    normalMap: stripeNormal,
    normalScale: new THREE.Vector2(0.6, 0.6),
    roughness: 0.5,
    clearcoat: 0.2,
  });
  const zLines = [-0.34, -0.17, 0, 0.17, 0.34];
  zLines.forEach((z, i) => {
    addTube(
      g,
      [
        vec([-1.42, i % 2 ? 0.19 : -0.2, z]),
        vec([-0.72, i % 2 ? 0.19 : -0.2, z]),
        vec([0.55, i % 2 ? 0.18 : -0.18, z]),
        vec([1.32, i % 2 ? 0.18 : -0.18, z]),
      ],
      [0.056, 0.062, 0.062, 0.048],
      myofibrilMat,
      56,
      10,
      period,
    );
  });

  const tTubuleRng = randomGenerator(3344);
  for (let tt = 0; tt < 12; tt++) {
    const tx = -1.3 + tt * 0.25;
    if (Math.abs(tx) < 0.3) continue;
    const tz = (tTubuleRng() - 0.5) * 0.5;
    const ty = (tTubuleRng() - 0.5) * 0.3;
    const depth = 0.25 + tTubuleRng() * 0.15;
    addTube(g, [vec([tx, ty, tz]), vec([tx, ty, tz + depth])], [0.025, 0.012], tTubuleMat, 8, 6);
    addTube(g, [vec([tx, ty, tz]), vec([tx, ty, tz - depth])], [0.025, 0.012], tTubuleMat, 8, 6);
  }

  const srRng = randomGenerator(5566);
  for (let sr = 0; sr < 24; sr++) {
    let sx = (srRng() * 2 - 1) * 1.4;
    if (Math.abs(sx) < 0.5) sx += sx < 0 ? -0.5 : 0.5;
    const sy = (srRng() - 0.5) * 0.35;
    const sz = (srRng() - 0.5) * 0.6;
    const srLen = 0.15 + srRng() * 0.1;
    const srDir = new THREE.Vector3(srRng() - 0.5, srRng() - 0.5, srRng() - 0.5).normalize();
    const srEnd = vec([sx, sy, sz]).addScaledVector(srDir, srLen);
    addTube(g, [vec([sx, sy, sz]), srEnd], [0.012, 0.008], srMat, 8, 5);
  }

  ball(g, vec([-0.14, 0, 0.19]), [0.56, 0.27, 0.29], nucleusMat);
  ball(g, vec([-0.04, 0.07, 0.45]), 0.085, bioMat(0x3a2040, { roughness: 0.8 }));
  const chrRng = randomGenerator(8888);
  const chrMat = bioMat(0x4a3268, { roughness: 0.7 });
  for (let chr = 0; chr < 12; chr++) {
    const cdir = new THREE.Vector3(chrRng() - 0.5, chrRng() - 0.5, chrRng() - 0.5).normalize();
    const cr = 0.12 + chrRng() * 0.14;
    ball(g, vec([-0.14, 0, 0.19]).add(cdir.multiplyScalar(cr)), 0.015 + chrRng() * 0.01, chrMat);
  }

  const rng = randomGenerator(7832);
  const cristaeMat = bioMat(0xc28a4f, { roughness: 0.5 });
  for (let i = 0; i < 65; i++) {
    let x = (rng() * 2 - 1) * 1.45;
    if (Math.abs(x) < 0.69) x += x < 0 ? -0.7 : 0.7;
    x = clamp(x, -1.65, 1.65);
    const angle = rng() * Math.PI * 2;
    const mGroup = new THREE.Group();
    const cylLen = 0.16 + rng() * 0.06;
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, cylLen, 14), mitoMat);
    const cap1 = new THREE.Mesh(new THREE.SphereGeometry(0.05, 14, 10), mitoMat);
    cap1.position.y = cylLen / 2;
    const cap2 = cap1.clone();
    cap2.position.y = -cylLen / 2;

    for (let cr = 0; cr < 3; cr++) {
      const ridge = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.006, 6, 12), cristaeMat);
      ridge.position.y = -0.04 + cr * 0.04;
      ridge.rotation.x = Math.PI / 2;
      mGroup.add(ridge);
    }

    mGroup.add(cyl, cap1, cap2);
    mGroup.position.set(x, Math.sin(angle) * 0.42, Math.cos(angle) * 0.42);
    mGroup.rotation.z = Math.PI / 2 + (rng() - 0.5) * 0.4;
    mGroup.rotation.y = (rng() - 0.5) * 0.4;
    mGroup.scale.set(1 + rng() * 0.4, 1 + rng() * 0.6, 1 + rng() * 0.4);
    g.add(mGroup);
  }

  const addDisc = (endpoint: THREE.Vector3, previous: THREE.Vector3, radius: number): void => {
    const direction = endpoint.clone().sub(previous).normalize();
    const geometry = new THREE.CylinderGeometry(radius, radius, 0.09, 36, 2);
    const position = geometry.attributes.position!;
    for (let k = 0; k < position.count; k++) {
      const px = position.getX(k);
      const py = position.getY(k);
      const pz = position.getZ(k);
      const stepWave = Math.sin(Math.atan2(pz, px) * 6) * 0.04;
      position.setY(k, py + stepWave + (px > 0.08 ? 0.05 : px < -0.08 ? -0.05 : 0));
    }
    geometry.computeVertexNormals();
    const disc = new THREE.Mesh(geometry, discMat);
    disc.position.copy(endpoint);
    disc.quaternion.setFromUnitVectors(UP, direction);
    g.add(disc);

    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(radius * 0.98, 0.018, 10, 36),
      bioMat(ACCENT_COLOR, { roughness: 0.3, clearcoat: 0.5 }),
    );
    rim.rotation.x = Math.PI / 2;
    disc.add(rim);

    const gjMat = bioMat(0xe8c5cc, { roughness: 0.3, clearcoat: 0.5 });
    for (let gj = 0; gj < 8; gj++) {
      const ga = (gj / 8) * Math.PI * 2;
      const gr = radius * 0.6;
      const gjDot = new THREE.Mesh(new THREE.SphereGeometry(0.025, 10, 8), gjMat);
      gjDot.position.set(Math.cos(ga) * gr, 0, Math.sin(ga) * gr);
      disc.add(gjDot);
    }
  };
  addDisc(vec([-1.88, 0, 0]), vec([-0.9, 0.04, 0]), 0.49);
  branches.forEach((item) => {
    const lastPoint = item.points[item.points.length - 1]!;
    const prevPoint = item.points[item.points.length - 2]!;
    const lastRadius = item.radii[item.radii.length - 1]!;
    addDisc(lastPoint, prevPoint, lastRadius);
  });
  return g;
}
