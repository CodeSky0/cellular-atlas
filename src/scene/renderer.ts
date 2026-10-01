import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { SceneTheme, ThemeName } from '../types/index.ts';

/** 两套主题对应的场景观感参数 */
export const SCENE_THEMES: Record<ThemeName, SceneTheme> = {
  dark: {
    background: 0x06070a,
    environment: 0.58,
    exposure: 1.2,
    key: 1.2,
    hemi: 0.34,
    fill: 0.34,
    top: 0.28,
    rim: 1.2,
    cameraFill: 0.32,
    bloomStrength: 0.34,
    bloomThreshold: 0.78,
    bloomRadius: 0.68,
    vignette: 0.62,
    grain: 0.028,
    aberration: 0.55,
  },
  light: {
    background: 0xfcfbf8,
    environment: 0.95,
    exposure: 1.02,
    key: 1.05,
    hemi: 0.55,
    fill: 0.45,
    top: 0.3,
    rim: 0.6,
    cameraFill: 0.28,
    bloomStrength: 0.12,
    bloomThreshold: 0.92,
    bloomRadius: 0.5,
    vignette: 0.24,
    grain: 0.016,
    aberration: 0.3,
  },
};

export type SceneContext = {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  /** 承接模型的地面光池 / 投影，由 app 摆位 */
  readonly ground: THREE.Mesh;
  /** 跟随相机的前向补光，由 app 每帧同步位置 */
  readonly cameraFill: THREE.DirectionalLight;
  render(): void;
  setSize(width: number, height: number): void;
  applyTheme(theme: ThemeName): void;
  setTint(color: THREE.Color): void;
  dispose(): void;
};

/** 暗角 + 胶片颗粒 + 轻微色散的合成通道 */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uTime: { value: 0 },
    uVignette: { value: 0.6 },
    uGrain: { value: 0.03 },
    uAberration: { value: 0.5 },
    uResolution: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uResolution;
    uniform float uTime;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uAberration;
    varying vec2 vUv;

    void main() {
      vec2 uv = vUv;
      vec2 d = uv - 0.5;
      float r2 = dot(d, d);

      vec2 offset = d * r2 * uAberration * 0.004;
      vec3 color = vec3(
        texture2D(tDiffuse, uv + offset).r,
        texture2D(tDiffuse, uv).g,
        texture2D(tDiffuse, uv - offset).b
      );

      float vignette = 1.0 - uVignette * smoothstep(0.04, 0.5, r2);
      color *= vignette;

      float noise = fract(sin(dot(uv * uResolution + uTime, vec2(12.9898, 78.233))) * 43758.5453);
      color += (noise - 0.5) * uGrain;

      gl_FragColor = vec4(color, 1.0);
    }
  `,
};

function makeGroundTexture(): THREE.Texture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(255,255,255,0.85)');
    gradient.addColorStop(0.42, 'rgba(255,255,255,0.30)');
    gradient.addColorStop(0.75, 'rgba(255,255,255,0.07)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createScene(host: HTMLElement): SceneContext {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SCENE_THEMES.dark.background);

  const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 220);
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = SCENE_THEMES.dark.exposure;
  renderer.localClippingEnabled = true;
  host.appendChild(renderer.domElement);

  // ---------- 基于图像的环境光照：让 PBR 材质真正“有反射” ----------
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envTarget.texture;
  scene.environmentIntensity = SCENE_THEMES.dark.environment;

  // ---------- 方向光 ----------
  const hemi = new THREE.HemisphereLight(0xfff6ec, 0x9aa0b4, SCENE_THEMES.dark.hemi);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xfff4e8, SCENE_THEMES.dark.key);
  key.position.set(4.5, 7.5, 5.5);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xdfe6ff, SCENE_THEMES.dark.fill);
  fill.position.set(-6, 2.5, 4);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0x9d8cff, SCENE_THEMES.dark.rim);
  rim.position.set(-3.5, -1.5, -6.5);
  scene.add(rim);

  const top = new THREE.DirectionalLight(0xffffff, SCENE_THEMES.dark.top);
  top.position.set(0, 9, 0);
  scene.add(top);

  // 跟随相机的前向补光
  const cameraFill = new THREE.DirectionalLight(0xffffff, SCENE_THEMES.dark.cameraFill);
  cameraFill.position.set(0, 0, 8);
  scene.add(cameraFill);
  scene.add(cameraFill.target);

  // ---------- 地面光池 ----------
  const groundTexture = makeGroundTexture();
  const groundMaterial = new THREE.MeshBasicMaterial({
    map: groundTexture,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    color: new THREE.Color(0x9d8cff),
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -1;
  ground.renderOrder = 1;
  scene.add(ground);

  // ---------- 后期合成 ----------
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(renderer.getPixelRatio());
  const renderPass = new RenderPass(scene, camera);
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(1, 1),
    SCENE_THEMES.dark.bloomStrength,
    SCENE_THEMES.dark.bloomRadius,
    SCENE_THEMES.dark.bloomThreshold,
  );
  const gradePass = new ShaderPass(GradeShader);
  const outputPass = new OutputPass();
  composer.addPass(renderPass);
  composer.addPass(bloomPass);
  composer.addPass(gradePass);
  composer.addPass(outputPass);

  const clock = new THREE.Clock();
  let theme = SCENE_THEMES.dark;

  return {
    scene,
    camera,
    renderer,
    ground,
    cameraFill,
    render() {
      gradePass.uniforms.uTime!.value = clock.getElapsedTime();
      composer.render();
    },
    setSize(width, height) {
      renderer.setSize(width, height, false);
      composer.setSize(width, height);
      const pixelRatio = renderer.getPixelRatio();
      gradePass.uniforms.uResolution!.value.set(width * pixelRatio, height * pixelRatio);
    },
    applyTheme(name) {
      theme = SCENE_THEMES[name];
      const background = new THREE.Color(theme.background);
      scene.background = background;
      scene.environmentIntensity = theme.environment;
      renderer.toneMappingExposure = theme.exposure;
      hemi.intensity = theme.hemi;
      hemi.groundColor = new THREE.Color(name === 'dark' ? 0x9aa0b4 : 0xcfcdc4);
      key.intensity = theme.key;
      fill.intensity = theme.fill;
      rim.intensity = theme.rim;
      top.intensity = theme.top;
      cameraFill.intensity = theme.cameraFill;
      bloomPass.strength = theme.bloomStrength;
      bloomPass.threshold = theme.bloomThreshold;
      bloomPass.radius = theme.bloomRadius;
      gradePass.uniforms.uVignette!.value = theme.vignette;
      gradePass.uniforms.uGrain!.value = theme.grain;
      gradePass.uniforms.uAberration!.value = theme.aberration;
      groundMaterial.blending = name === 'dark' ? THREE.AdditiveBlending : THREE.NormalBlending;
      groundMaterial.opacity = name === 'dark' ? 0.4 : 0.3;
    },
    setTint(color) {
      (rim.color as THREE.Color).copy(color);
      (groundMaterial.color as THREE.Color).copy(color);
    },
    dispose() {
      envTarget.dispose();
      pmrem.dispose();
      groundTexture.dispose();
      groundMaterial.dispose();
      ground.geometry.dispose();
      composer.dispose();
      renderer.dispose();
    },
  };
}
