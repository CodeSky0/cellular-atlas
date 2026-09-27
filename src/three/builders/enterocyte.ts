import * as THREE from 'three';
import { ACCENT_COLOR } from '../../types/index.ts';
import { bioMat } from '../materials.ts';
import { addShell, addTube, ball, randomGenerator, vec } from '../geometry.ts';

export function buildEnterocyte(): THREE.Group {
  const g = new THREE.Group();
  const bodyMat = bioMat(0xede8dc, { roughness: 0.35, clearcoat: 0.4 });
  const neighborMat = bioMat(0xd0cec6, { transparent: true, opacity: 0.28, roughness: 0.6 });
  const brushMat = bioMat(0xb8c8ac, { roughness: 0.5, clearcoat: 0.3 });
  const tipMat = bioMat(0xd8e0cc, { roughness: 0.6, clearcoat: 0.3 });
  const nucleusMat = bioMat(0x6b5b75, { roughness: 0.5, clearcoat: 0.3 });
  const mitoMat = bioMat(0xd7a267, { roughness: 0.35, clearcoat: 0.5 });
  const golgiMat = bioMat(0xe397a1, { roughness: 0.25, clearcoat: 0.6 });
  const lysoMat = bioMat(0xd67080, { roughness: 0.3, clearcoat: 0.5 });
  const topY = 1.62;
  const bottomY = -1.68;

  const body = addShell(g, new THREE.CylinderGeometry(0.78, 0.84, topY - bottomY, 36, 3), bodyMat, 1, 0xd0cec6);
  body.position.y = (topY + bottomY) / 2;

  const neighbor = addShell(
    g,
    new THREE.CylinderGeometry(0.78, 0.84, topY - bottomY, 24, 1),
    neighborMat,
    0.25,
    false,
  );
  neighbor.position.set(1.65, (topY + bottomY) / 2, -0.05);

  const count = 480;
  const stemGeo = new THREE.CylinderGeometry(0.013, 0.017, 1, 6);
  const tipGeo = new THREE.SphereGeometry(0.02, 8, 6);
  const stems = new THREE.InstancedMesh(stemGeo, brushMat, count);
  const tips = new THREE.InstancedMesh(tipGeo, tipMat, count);
  const stemDummy = new THREE.Object3D();
  const tipDummy = new THREE.Object3D();
  const rng = randomGenerator(5041);
  const golden = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < count; i++) {
    const radial = 0.76 * Math.sqrt((i + 0.5) / count);
    const angle = i * golden;
    const x = Math.cos(angle) * radial;
    const z = Math.sin(angle) * radial;
    const length = 0.38 + rng() * 0.04;
    const leanX = (rng() - 0.5) * 0.03;
    const leanZ = (rng() - 0.5) * 0.03;

    stemDummy.position.set(x, topY + length / 2, z);
    stemDummy.rotation.set(leanX, 0, leanZ);
    stemDummy.scale.set(1, length, 1);
    stemDummy.updateMatrix();
    stems.setMatrixAt(i, stemDummy.matrix);

    tipDummy.position.set(x, topY + length, z);
    tipDummy.scale.setScalar(1);
    tipDummy.updateMatrix();
    tips.setMatrixAt(i, tipDummy.matrix);
  }
  stems.instanceMatrix.needsUpdate = true;
  tips.instanceMatrix.needsUpdate = true;
  g.add(stems, tips);

  const twMat = bioMat(0xa0b090, { roughness: 0.6, transparent: true, opacity: 0.4 });
  for (let tw = 0; tw < 80; tw++) {
    const twA = (tw / 80) * Math.PI * 2;
    const twR = 0.72;
    addTube(
      g,
      [
        vec([Math.cos(twA) * twR, topY - 0.01, Math.sin(twA) * twR]),
        vec([Math.cos(twA) * twR * 0.55, topY - 0.1, Math.sin(twA) * twR * 0.55]),
      ],
      [0.007, 0.003],
      twMat,
      3,
      4,
    );
  }

  const tightMat = bioMat(ACCENT_COLOR, { roughness: 0.3, clearcoat: 0.5 });
  const adherensMat = bioMat(0x5e9f7e, { roughness: 0.35, clearcoat: 0.4 });
  const desmoMat = bioMat(0xa87a3d, { roughness: 0.4, clearcoat: 0.4 });

  const tight = new THREE.Mesh(new THREE.TorusGeometry(0.79, 0.025, 10, 56), tightMat);
  tight.rotation.x = Math.PI / 2;
  tight.position.y = 1.46;
  g.add(tight);

  const adherens = new THREE.Mesh(new THREE.TorusGeometry(0.79, 0.02, 10, 56), adherensMat);
  adherens.rotation.x = Math.PI / 2;
  adherens.position.y = 1.39;
  g.add(adherens);

  const desmo = new THREE.Mesh(new THREE.TorusGeometry(0.79, 0.016, 10, 56), desmoMat);
  desmo.rotation.x = Math.PI / 2;
  desmo.position.y = 1.32;
  g.add(desmo);

  ball(g, vec([0, -0.92, 0.02]), [0.38, 0.54, 0.32], nucleusMat);
  ball(g, vec([0.08, -0.84, 0.32]), 0.08, bioMat(0x3a2040, { roughness: 0.8 }));

  for (let layer = 0; layer < 5; layer++) {
    const yy = -0.28 + layer * 0.08;
    addTube(
      g,
      [
        vec([-0.28, yy, 0.38]),
        vec([-0.06, yy - 0.04, 0.45]),
        vec([0.16, yy - 0.02, 0.44]),
        vec([0.3, yy + 0.03, 0.38]),
      ],
      [0.022, 0.028, 0.028, 0.016],
      golgiMat,
      24,
      8,
    );
  }

  const lysoRng = randomGenerator(9876);
  for (let ly = 0; ly < 10; ly++) {
    const lyY = 0.15 + lysoRng() * 1.1;
    const lyA = lysoRng() * Math.PI * 2;
    const lyR = 0.2 + lysoRng() * 0.3;
    ball(g, vec([Math.cos(lyA) * lyR, lyY, Math.sin(lyA) * lyR]), 0.022 + lysoRng() * 0.02, lysoMat);
  }

  const mitoRng = randomGenerator(2086);
  for (let m = 0; m < 35; m++) {
    const yy2 = -0.4 + mitoRng() * 1.5;
    const a = mitoRng() * Math.PI * 2;
    const rr = 0.25 + mitoRng() * 0.25;
    const mGroup = new THREE.Group();
    const mitoLen = 0.14 + mitoRng() * 0.04;
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, mitoLen, 12), mitoMat);
    const cap1 = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), mitoMat);
    cap1.position.y = mitoLen / 2;
    const cap2 = cap1.clone();
    cap2.position.y = -mitoLen / 2;
    mGroup.add(cyl, cap1, cap2);
    mGroup.position.set(Math.cos(a) * rr, yy2, Math.sin(a) * rr);
    mGroup.rotation.z = Math.PI / 2 + (mitoRng() - 0.5) * 0.3;
    g.add(mGroup);
  }

  const basal = new THREE.Mesh(
    new THREE.BoxGeometry(3.8, 0.04, 2.0),
    bioMat(0xa8a69f, { transparent: true, opacity: 0.4, roughness: 0.7 }),
  );
  basal.position.set(0.7, -1.78, 0);
  g.add(basal);
  return g;
}
