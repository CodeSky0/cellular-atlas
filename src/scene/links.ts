import * as THREE from 'three';
import type { Cell, LinkVisual } from '../types/index.ts';

const LINK_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/** 引导弧：暗色底为加色发光，浅色底改为实色描边 */
const LINK_FRAGMENT = /* glsl */ `
  uniform vec3 uTint;
  uniform float uTime;
  uniform float uReveal;
  uniform float uOpacity;
  uniform float uPaper;
  varying vec2 vUv;

  void main() {
    if (vUv.x > uReveal) discard;

    float ends = smoothstep(0.0, 0.07, vUv.x) * smoothstep(1.0, 0.93, vUv.x);
    // 流动的虚线
    float wave = sin((vUv.x * 24.0 - uTime * 2.2) * 3.14159) * 0.5 + 0.5;
    float dashes = smoothstep(0.42, 0.95, wave);
    // 沿弧前进的亮脉冲
    float head = exp(-pow((fract(vUv.x - uTime * 0.32) - 0.5) * 7.0, 2.0));

    float darkAlpha = (0.2 + dashes * 0.42 + head * 0.8) * uOpacity;
    float lightAlpha = (0.26 + dashes * 0.22 + head * 0.3) * uOpacity;

    vec3 darkColor = uTint * (0.5 + dashes * 0.5 + head * 1.4);
    vec3 lightColor = mix(uTint, vec3(1.0), 0.28) * (0.82 + head * 0.3);

    gl_FragColor = vec4(
      mix(darkColor, lightColor, uPaper),
      mix(darkAlpha, lightAlpha, uPaper) * ends
    );
  }
`;

/** 依据结构位置生成带弧度的引导曲线 */
export function createLinkVisuals(cell: Cell, size: THREE.Vector3, tint: THREE.Color): LinkVisual[] {
  const scale = Math.max(size.x, size.y, size.z, 0.001);
  const radius = Math.max(0.0012, scale * 0.0072);
  const visuals: LinkVisual[] = [];

  for (const link of cell.links) {
    const fromPart = cell.parts[link.from];
    const toPart = cell.parts[link.to];
    if (!fromPart || !toPart) continue;

    const start = new THREE.Vector3(fromPart.pos[0], fromPart.pos[1], fromPart.pos[2]);
    const end = new THREE.Vector3(toPart.pos[0], toPart.pos[1], toPart.pos[2]);
    const mid = start.clone().add(end).multiplyScalar(0.5);
    const distance = start.distanceTo(end);
    // 弧顶朝标本外侧鼓起，避免穿过模型本体
    const outward =
      mid.lengthSq() > 1e-8 ? mid.clone().normalize() : new THREE.Vector3(0, 1, 0);
    const control = mid.clone().addScaledVector(outward, distance * 0.36);
    const curve = new THREE.QuadraticBezierCurve3(start, control, end);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTint: { value: tint.clone() },
        uTime: { value: 0 },
        uReveal: { value: 0 },
        uOpacity: { value: 0 },
        uPaper: { value: 0 },
      },
      vertexShader: LINK_VERTEX,
      fragmentShader: LINK_FRAGMENT,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 72, radius, 6, false), material);
    mesh.renderOrder = 5;
    mesh.visible = false;

    visuals.push({
      from: link.from,
      to: link.to,
      label: link.label,
      mesh,
      start,
      end,
      midpoint: curve.getPoint(0.5),
      reveal: 0,
      opacity: 0,
    });
  }

  return visuals;
}

/** 每帧推进出现动画与流动时间 */
export function stepLinkVisual(
  visual: LinkVisual,
  dt: number,
  time: number,
  revealTarget: number,
  opacityTarget: number,
): void {
  const k = 1 - Math.exp(-dt * 7);
  visual.reveal += (revealTarget - visual.reveal) * k;
  visual.opacity += (opacityTarget - visual.opacity) * k;
  const uniforms = visual.mesh.material.uniforms;
  uniforms.uTime!.value = time;
  uniforms.uReveal!.value = visual.reveal;
  uniforms.uOpacity!.value = visual.opacity;
  visual.mesh.visible = visual.opacity > 0.01 && visual.reveal > 0.005;
}

export function setLinkPaper(visuals: readonly LinkVisual[], paper: boolean): void {
  for (const visual of visuals) {
    const material = visual.mesh.material;
    material.uniforms.uPaper!.value = paper ? 1 : 0;
    material.blending = paper ? THREE.NormalBlending : THREE.AdditiveBlending;
    material.needsUpdate = true;
  }
}

export function setLinkTint(visuals: readonly LinkVisual[], tint: THREE.Color): void {
  for (const visual of visuals) {
    (visual.mesh.material.uniforms.uTint!.value as THREE.Color).copy(tint);
  }
}
