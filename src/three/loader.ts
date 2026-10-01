import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import type { ModelStats } from '../types/index.ts';

export type ProgressCallback = (loaded: number, total: number) => void;

let sharedKTX2: KTX2Loader | null = null;
let sharedGLTF: GLTFLoader | null = null;
let boundRenderer: THREE.WebGLRenderer | null = null;

/** 复用一个 GLTFLoader / KTX2Loader，避免 KTX2 纹理转码器被反复初始化 */
function ensureLoaders(renderer: THREE.WebGLRenderer): GLTFLoader {
  if (!sharedGLTF || boundRenderer !== renderer) {
    if (sharedKTX2) {
      sharedKTX2.dispose();
    }
    sharedKTX2 = new KTX2Loader().setTranscoderPath('/basis/').detectSupport(renderer);
    sharedGLTF = new GLTFLoader();
    sharedGLTF.setMeshoptDecoder(MeshoptDecoder);
    sharedGLTF.setKTX2Loader(sharedKTX2);
    boundRenderer = renderer;
  }
  return sharedGLTF;
}

export function loadGLTF(
  url: string,
  renderer: THREE.WebGLRenderer,
  onProgress?: ProgressCallback,
): Promise<THREE.Group> {
  const loader = ensureLoaders(renderer);
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf) => resolve(gltf.scene),
      (event) => {
        if (onProgress && event.lengthComputable && event.total > 0) {
          onProgress(event.loaded, event.total);
        }
      },
      (error) => reject(error instanceof Error ? error : new Error(String(error))),
    );
  });
}

/** 统计顶点、三角面与材质数量，用于观察台数据卡 */
export function collectStats(root: THREE.Object3D): ModelStats {
  let vertices = 0;
  let triangles = 0;
  const materials = new Set<string>();

  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const geometry = mesh.geometry as THREE.BufferGeometry | undefined;
    const position = geometry?.attributes?.position;
    if (position) {
      vertices += position.count;
      const index = geometry.index;
      triangles += index ? Math.floor(index.count / 3) : Math.floor(position.count / 3);
    }
    const material = mesh.material;
    if (Array.isArray(material)) {
      material.forEach((item) => materials.add(item.uuid));
    } else if (material) {
      materials.add(material.uuid);
    }
  });

  return { vertices, triangles, materials: materials.size };
}
