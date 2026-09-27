import * as THREE from 'three';
import { PAPER_COLOR } from '../types/index.ts';

export type SceneContext = {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
};

export function createScene(host: HTMLElement): SceneContext {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PAPER_COLOR);

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 160);
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  host.appendChild(renderer.domElement);

  const hemi = new THREE.HemisphereLight(0xfffdf5, 0xd0cec6, 0.8);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xffffff, 1.2);
  key.position.set(5, 8, 6);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xf0efeb, 0.6);
  fill.position.set(-6, 3, 4);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xe3e1db, 0.8);
  rim.position.set(-4, -2, -6);
  scene.add(rim);

  const top = new THREE.DirectionalLight(0xffffff, 0.4);
  top.position.set(0, 10, 0);
  scene.add(top);

  return { scene, camera, renderer };
}
