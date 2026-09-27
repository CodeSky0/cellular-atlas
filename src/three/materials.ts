import * as THREE from 'three';

export type BioMatOptions = Partial<
  Pick<
    THREE.MeshPhysicalMaterialParameters,
    | 'roughness'
    | 'metalness'
    | 'clearcoat'
    | 'clearcoatRoughness'
    | 'transparent'
    | 'opacity'
    | 'side'
    | 'map'
    | 'normalMap'
    | 'normalScale'
  >
>;

export function bioMat(color: THREE.ColorRepresentation, options?: BioMatOptions): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.4,
    metalness: 0.0,
    clearcoat: 0.3,
    clearcoatRoughness: 0.2,
    ...options,
  });
}

export function membraneMat(
  color: THREE.ColorRepresentation,
  options?: BioMatOptions,
): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.15,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
    ...options,
  });
}
