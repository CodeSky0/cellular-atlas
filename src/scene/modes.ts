import * as THREE from 'three';
import type { ModeMeshes } from '../types/index.ts';

export type { ModeMeshes };

const MODE_VERTEX = /* glsl */ `
  varying vec3 vNormalV;
  varying vec3 vViewDir;
  varying vec3 vWorldPos;

  #include <clipping_planes_pars_vertex>

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vNormalV = normalize(normalMatrix * normal);
    vViewDir = normalize(-mvPosition.xyz);
    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
    #include <clipping_planes_vertex>
    gl_Position = projectionMatrix * mvPosition;
  }
`;

/**
 * 透视模式：菲涅耳全息外壳。
 * 深色底用叠加混合发光；浅色底改用普通混合，避免加色到纯白。
 */
const XRAY_FRAGMENT = /* glsl */ `
  uniform vec3 uTint;
  uniform float uPaper;
  varying vec3 vNormalV;
  varying vec3 vViewDir;

  #include <clipping_planes_pars_fragment>

  void main() {
    #include <clipping_planes_fragment>
    float fresnel = 1.0 - abs(dot(normalize(vNormalV), normalize(vViewDir)));
    float rim = pow(fresnel, 2.0);

    vec3 darkColor = mix(uTint * 0.45, mix(uTint, vec3(1.0), 0.18) * 1.35, rim);
    float darkAlpha = 0.04 + rim * 1.05;

    vec3 lightColor = mix(mix(uTint, vec3(1.0), 0.45), uTint, rim);
    float lightAlpha = 0.1 + rim * 0.5;

    gl_FragColor = vec4(
      mix(darkColor, lightColor, uPaper),
      mix(darkAlpha, lightAlpha, uPaper)
    );
  }
`;

/** 网格模式：世界空间三维网格 + 轮廓线，深色底亮线、浅色底暗线 */
const CONTOUR_FRAGMENT = /* glsl */ `
  uniform vec3 uTint;
  uniform float uGrid;
  uniform float uPaper;
  varying vec3 vNormalV;
  varying vec3 vViewDir;
  varying vec3 vWorldPos;

  #include <clipping_planes_pars_fragment>

  void main() {
    #include <clipping_planes_fragment>
    float ndv = abs(dot(normalize(vNormalV), normalize(vViewDir)));
    float shade = mix(0.05, 0.4, pow(ndv, 0.8));
    float edge = smoothstep(0.34, 0.19, ndv);

    vec3 scaled = vWorldPos * uGrid;
    vec3 width = fwidth(scaled);
    vec3 grid = abs(fract(scaled) - 0.5) / max(width, vec3(1e-5));
    float line = clamp(1.0 - min(min(grid.x, grid.y), min(grid.z, 1.0)), 0.0, 1.0);

    vec3 bodyDark = uTint * shade;
    vec3 bodyLight = mix(vec3(1.0), uTint, 0.26 + 0.46 * shade);
    vec3 lineDark = uTint * 1.6 + vec3(0.06);
    vec3 lineLight = mix(bodyLight, uTint * 0.35, 0.88);
    vec3 edgeDark = uTint * 1.7 + vec3(0.25);
    vec3 edgeLight = uTint * 0.2;

    vec3 color =
      mix(bodyDark, bodyLight, uPaper)
      + mix(lineDark, lineLight, uPaper) * line * mix(0.55, 0.8, uPaper)
      + mix(edgeDark, edgeLight, uPaper) * edge;

    gl_FragColor = vec4(color, 1.0);
  }
`;

export type ModeOptions = {
  /** 网格密度：世界单位内的格数 */
  readonly gridScale?: number;
};

/**
 * 为 GLB 网格生成两种分析模式的叠加网格，与源网格共享几何体（不复制顶点数据）。
 */
export function createModeMeshes(source: THREE.Mesh, tint: THREE.Color, options: ModeOptions = {}): ModeMeshes {
  const gridScale = options.gridScale ?? 12;

  const make = (
    fragment: string,
    depthWrite: boolean,
    transparent: boolean,
    renderOrder: number,
    extraUniforms: Record<string, THREE.IUniform>,
  ): THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial> => {
    const material = new THREE.ShaderMaterial({
      uniforms: { uTint: { value: tint.clone() }, uPaper: { value: 0 }, ...extraUniforms },
      vertexShader: MODE_VERTEX,
      fragmentShader: fragment,
      transparent,
      depthWrite,
      depthTest: true,
      blending: transparent ? THREE.AdditiveBlending : THREE.NormalBlending,
      side: THREE.DoubleSide,
      clipping: true,
    });
    const mesh = new THREE.Mesh(source.geometry, material);
    mesh.visible = false;
    mesh.renderOrder = renderOrder;
    mesh.frustumCulled = source.frustumCulled;
    if (source.parent) source.parent.add(mesh);
    mesh.position.copy(source.position);
    mesh.quaternion.copy(source.quaternion);
    mesh.scale.copy(source.scale);
    return mesh;
  };

  return {
    xray: make(XRAY_FRAGMENT, false, true, 4, {}),
    contour: make(CONTOUR_FRAGMENT, true, false, 0, { uGrid: { value: gridScale } }),
  };
}

/** 主题切换时切换分析模式的混合方式与配色方向 */
export function setModePaper(modes: ModeMeshes, paper: boolean): void {
  const xrayMaterial = modes.xray.material as THREE.ShaderMaterial;
  xrayMaterial.uniforms.uPaper!.value = paper ? 1 : 0;
  xrayMaterial.blending = paper ? THREE.NormalBlending : THREE.AdditiveBlending;
  xrayMaterial.needsUpdate = true;

  const contourMaterial = modes.contour.material as THREE.ShaderMaterial;
  contourMaterial.uniforms.uPaper!.value = paper ? 1 : 0;
}
