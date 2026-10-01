import type * as THREE from 'three';

export type Vec3Tuple = readonly [number, number, number];

export type ThemeName = 'dark' | 'light';

export type CellPart = {
  readonly name: string;
  readonly pos: Vec3Tuple;
  readonly text: string;
};

/** 结构之间的关联：用带方向的引导弧表示通路 / 支持关系 */
export type CellLink = {
  readonly from: number;
  readonly to: number;
  readonly label: string;
};

export type Cell = {
  readonly id: string;
  readonly name: string;
  readonly english: string;
  /** 该样本的专属色，驱动强调色、标注点与场景轮廓光 */
  readonly tint: string;
  readonly scale: string;
  readonly description: string;
  readonly concept: string;
  readonly modelUrl: string;
  readonly parts: readonly CellPart[];
  readonly links: readonly CellLink[];
};

/** 模型几何统计，用于观察台数据卡 */
export type ModelStats = {
  readonly vertices: number;
  readonly triangles: number;
  readonly materials: number;
};

export type ShellMesh = THREE.Mesh<THREE.BufferGeometry, THREE.Material> & {
  userData: {
    shellOpacity?: number;
    shellOpaque?: boolean;
    isWire?: boolean;
  };
};

/** 透视 / 网格模式下叠加的着色网格 */
export type ModeMeshes = {
  readonly xray: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  readonly contour: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
};

/** 结构之间的引导弧（可动效状态） */
export type LinkVisual = {
  readonly from: number;
  readonly to: number;
  readonly label: string;
  readonly mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  /** 模型局部空间中的起止点与弧顶 */
  readonly start: THREE.Vector3;
  readonly end: THREE.Vector3;
  readonly midpoint: THREE.Vector3;
  reveal: number;
  opacity: number;
};

export type CellEntity = {
  readonly wrapper: THREE.Group;
  readonly model: THREE.Group;
  readonly size: THREE.Vector3;
  readonly stats: ModelStats;
  readonly modes: ModeMeshes;
  readonly baseMeshes: readonly THREE.Mesh[];
  readonly links: readonly LinkVisual[];
  /** 参与剖切裁剪的材质 */
  readonly clipMaterials: readonly THREE.Material[];
};

export type OrbitState = {
  theta: number;
  phi: number;
  distance: number;
  targetTheta: number;
  targetPhi: number;
  targetDistance: number;
  /** 自适应取景得到的基准距离，用于计算缩放百分比 */
  fitDistance: number;
  minDistance: number;
  maxDistance: number;
  focus: THREE.Vector3;
  targetFocus: THREE.Vector3;
};

export type AppPhase = 'idle' | 'out' | 'in';

export type AppState = {
  id: string;
  next: string | null;
  phase: 'idle' | 'out' | 'in';
  fade: number;
  spin: boolean;
  xray: boolean;
  wire: boolean;
  clip: boolean;
  links: boolean;
  callouts: boolean;
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

/** 场景随主题切换的渲染参数 */
export type SceneTheme = {
  readonly background: number;
  readonly environment: number;
  readonly exposure: number;
  readonly key: number;
  readonly hemi: number;
  readonly fill: number;
  readonly top: number;
  readonly rim: number;
  /** 跟随相机的前向补光，保证任何角度都读得清 */
  readonly cameraFill: number;
  readonly bloomStrength: number;
  readonly bloomThreshold: number;
  readonly bloomRadius: number;
  readonly vignette: number;
  readonly grain: number;
  readonly aberration: number;
};
