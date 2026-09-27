import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export type ProgressCallback = (loaded: number, total: number) => void;

export function loadGLTF(url: string, onProgress?: ProgressCallback): Promise<THREE.Group> {
  const loader = new GLTFLoader();
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf) => resolve(gltf.scene),
      (event) => {
        if (onProgress && event.lengthComputable) {
          onProgress(event.loaded, event.total);
        }
      },
      (error) => reject(error instanceof Error ? error : new Error(String(error))),
    );
  });
}
