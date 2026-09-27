import type * as THREE from 'three';

export type Vec3Tuple = readonly [number, number, number];

export type CellPart = {
  readonly name: string;
  readonly pos: Vec3Tuple;
  readonly text: string;
};

export type CellBuilder = () => THREE.Group;

export type Cell = {
  readonly id: string;
  readonly name: string;
  readonly english: string;
  readonly scale: string;
  readonly description: string;
  readonly concept: string;
  readonly builder: CellBuilder;
  readonly parts: readonly CellPart[];
};

export type ShellMesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial> & {
  userData: {
    shellOpacity: number;
    shellOpaque: boolean;
    isWire?: boolean;
  };
};

export type WireMesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> & {
  userData: { isWire: true };
};

export type CellEntity = {
  readonly wrapper: THREE.Group;
  readonly model: THREE.Group;
  readonly size: THREE.Vector3;
  readonly shells: readonly ShellMesh[];
  readonly wires: readonly WireMesh[];
};

export type OrbitState = {
  theta: number;
  phi: number;
  distance: number;
  targetTheta: number;
  targetPhi: number;
  targetDistance: number;
  minDistance: number;
  maxDistance: number;
  focus: THREE.Vector3;
  targetFocus: THREE.Vector3;
};

export type AppPhase = 'idle' | 'out' | 'in';

export type AppState = {
  id: string;
  next: string | null;
  phase: AppPhase;
  fade: number;
  spin: boolean;
  xray: boolean;
  wire: boolean;
  part: number;
};

export type PointerRecord = {
  x: number;
  y: number;
  button: number;
};

export type Gesture = {
  distance: number;
  x: number;
  y: number;
} | null;

export const ACCENT_COLOR = 0xc56473;
export const PAPER_COLOR = 0xf9f8f5;
export const SURFACE_COLOR = 0xf0efeb;
export const WIRE_COLOR = 0xa8a69f;
export const SHELL_WIRE_COLOR = 0xd0cec6;
