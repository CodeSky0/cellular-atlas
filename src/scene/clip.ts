import * as THREE from 'three';

/** 剖切面沿着世界 -Z 方向切开标本，可看到内部结构 */
const NORMAL = new THREE.Vector3(0, 0, -1);

const SECTION_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SECTION_FRAGMENT = /* glsl */ `
  uniform vec3 uTint;
  uniform float uView;
  uniform float uPaper;
  varying vec2 vUv;

  void main() {
    vec2 p = vUv - 0.5;
    float r = length(p) * 2.0;
    float radial = smoothstep(1.0, 0.28, r);

    vec2 scaled = vUv * 26.0;
    vec2 width = fwidth(scaled);
    vec2 grid = abs(fract(scaled) - 0.5) / max(width, vec2(1e-5));
    float line = clamp(1.0 - min(grid.x, grid.y), 0.0, 1.0);

    float frame = smoothstep(0.06, 0.0, abs(r - 0.95));

    float alpha = (0.04 + line * 0.32 + frame * 0.5) * radial;
    alpha *= mix(0.78, 0.05, uView) * mix(1.0, 1.25, uPaper);

    vec3 color = mix(uTint * 1.15, uTint * 0.55, uPaper);
    gl_FragColor = vec4(color, alpha);
  }
`;

export type ClipController = {
  readonly plane: THREE.Plane;
  readonly visual: THREE.Mesh;
  /** 0 = 完整标本，1 = 完全剖开 */
  setValue(value: number): void;
  getValue(): number;
  setEnabled(enabled: boolean): void;
  isEnabled(): boolean;
  /** 依据标本尺度摆放刀片平面：range 为剖切行程，bladeSize 为刀片显示尺寸 */
  layout(range: number, bladeSize: number): void;
  /** 相机与剖切面法线的夹角余弦绝对值，用于正对时淡出 */
  setViewDot(value: number): void;
  setPaper(paper: boolean): void;
  setTint(color: THREE.Color): void;
  /** 把裁剪平面挂到材质上（null 表示取消） */
  applyTo(materials: readonly THREE.Material[]): void;
  update(dt: number): void;
};

export function createClipController(scene: THREE.Scene, tint: THREE.Color): ClipController {
  const plane = new THREE.Plane(NORMAL.clone(), 0);
  let enabled = false;
  let value = 0.5;
  let radius = 1;
  let wanted = false;
  let fade = 0;

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTint: { value: tint.clone() },
      uView: { value: 0 },
      uPaper: { value: 0 },
    },
    vertexShader: SECTION_VERTEX,
    fragmentShader: SECTION_FRAGMENT,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });

  const visual = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  visual.renderOrder = 2;
  visual.visible = false;
  visual.frustumCulled = false;
  scene.add(visual);

  /** 0..1 → 平面常数（0 = 平面在标本之外，1 = 掠过整颗标本） */
  const constantFor = (v: number): number => (0.5 - v) * 2 * radius;

  const sync = (): void => {
    const c = constantFor(value);
    plane.constant = c;
    visual.position.set(0, 0, c - radius * 0.004);
    const atEdge = value <= 0.002 || value >= 0.998;
    wanted = enabled && !atEdge;
  };

  return {
    plane,
    visual,
    setValue(v) {
      value = Math.min(1, Math.max(0, v));
      sync();
    },
    getValue: () => value,
    setEnabled(on) {
      enabled = on;
      sync();
    },
    isEnabled: () => enabled,
    layout(range, bladeSize) {
      radius = Math.max(0.05, range);
      const scale = Math.max(0.25, bladeSize);
      visual.scale.set(scale, scale, 1);
      sync();
    },
    setViewDot(v) {
      material.uniforms.uView!.value = Math.min(1, Math.max(0, v));
    },
    setPaper(paper) {
      material.uniforms.uPaper!.value = paper ? 1 : 0;
      material.blending = paper ? THREE.NormalBlending : THREE.AdditiveBlending;
      material.needsUpdate = true;
    },
    setTint(color) {
      (material.uniforms.uTint!.value as THREE.Color).copy(color);
    },
    applyTo(materials) {
      for (const item of materials) {
        item.clippingPlanes = enabled ? [plane] : null;
        item.needsUpdate = true;
      }
    },
    update(dt) {
      const target = wanted ? 1 : 0;
      fade += (target - fade) * (1 - Math.exp(-dt * 9));
      material.opacity = fade;
      visual.visible = fade > 0.01;
    },
  };
}
