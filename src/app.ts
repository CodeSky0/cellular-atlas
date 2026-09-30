import * as THREE from 'three';
import { CELLS } from './data/cells.ts';
import type { CellEntity, OrbitState, AppState, ShellMesh, WireMesh } from './types/index.ts';
import { createScene } from './scene/renderer.ts';
import { createOrbit, createPointerController } from './scene/orbit.ts';
import { getElements } from './ui/elements.ts';
import { buildNav, setActiveNav } from './ui/nav.ts';
import { createInfoController } from './ui/info.ts';
import { createToolbarController, stopSpin } from './ui/toolbar.ts';
import { vec } from './three/geometry.ts';
import { loadGLTF } from './three/loader.ts';

const reduceMotion =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function fitCell(orbit: OrbitState, camera: THREE.PerspectiveCamera, size: THREE.Vector3): void {
  const aspect = Math.max(0.5, camera.aspect);
  const neededWidth = (size.x * 0.98 + size.z * 0.32) / aspect;
  const neededHeight = size.y * 1.29;
  const viewHeight = Math.max(3.7, neededWidth, neededHeight);
  const d = (viewHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)))) * 1.17;
  orbit.minDistance = Math.max(1.55, d * 0.43);
  orbit.maxDistance = d * 3.1;
  orbit.targetDistance = d;
  orbit.targetFocus.set(0, 0, 0);
}

function applyModes(entities: Record<string, CellEntity>, state: AppState): void {
  for (const id of Object.keys(entities)) {
    const ent = entities[id];
    if (!ent) continue;
    for (const mesh of ent.shells) {
      const base = mesh.userData.shellOpacity;
      const material = mesh.material;
      if (state.xray) {
        material.transparent = true;
        material.opacity = Math.max(0.1, base * 0.35);
        material.depthWrite = false;
        material.needsUpdate = true;
      } else {
        const opaque = mesh.userData.shellOpaque;
        material.transparent = !opaque;
        material.opacity = opaque ? 1 : base;
        material.depthWrite = opaque;
        material.needsUpdate = true;
      }
    }
    for (const wire of ent.wires) {
      wire.visible = state.wire;
    }
  }
}

function positionPins(
  state: AppState,
  entities: Record<string, CellEntity>,
  camera: THREE.PerspectiveCamera,
  scene: THREE.Scene,
  host: HTMLElement,
  pinButtons: readonly HTMLButtonElement[],
): void {
  if (state.next || !state.id) {
    pinButtons.forEach((pin) => {
      pin.hidden = true;
    });
    return;
  }
  const cell = CELLS.find((c) => c.id === state.id);
  if (!cell) return;
  const ent = entities[state.id];
  if (!ent) return;
  const w = host.clientWidth;
  const h = host.clientHeight;
  scene.updateMatrixWorld(true);

  cell.parts.forEach((part, i) => {
    const projected = ent.model.localToWorld(vec(part.pos)).project(camera);
    const x = (projected.x * 0.5 + 0.5) * w;
    const y = (-projected.y * 0.5 + 0.5) * h;
    const pin = pinButtons[i];
    if (!pin) return;
    pin.hidden = projected.z < -1 || projected.z > 1 || x < 23 || x > w - 60 || y < 65 || y > h - 65;
    if (!pin.hidden) {
      pin.style.left = `${x}px`;
      pin.style.top = `${y}px`;
    }
  });
}

export class CellularAtlasApp {
  private readonly els = getElements();
  private readonly sceneCtx = createScene(this.els.host);
  private entities: Record<string, CellEntity> = {};
  private readonly orbit = createOrbit();
  private readonly state: AppState = {
    id: CELLS[0]!.id,
    next: null,
    phase: 'idle',
    fade: 1,
    spin: !reduceMotion,
    xray: false,
    wire: false,
    part: 0,
  };
  private readonly info = createInfoController(this.els, CELLS.length);
  private readonly toolbar = createToolbarController(this.els);
  private readonly pointerController = createPointerController({
    host: this.els.host,
    camera: this.sceneCtx.camera,
    orbit: this.orbit,
    onInteractStart: () => stopSpin(this.els, this.state),
  });
  private readonly clock = new THREE.Clock();
  private readonly resizeObserver: ResizeObserver | null;

  constructor() {
    const { camera, renderer } = this.sceneCtx;

    buildNav(CELLS, this.els, (id) => this.switchCell(id));

    this.toolbar.init(this.state, {
      onSpinToggle: () => {},
      onXrayToggle: () => applyModes(this.entities, this.state),
      onWireToggle: () => applyModes(this.entities, this.state),
      onReset: () => {
        this.orbit.targetTheta = 0.25;
        this.orbit.targetPhi = 1.13;
        const ent = this.entities[this.state.next ?? this.state.id];
        if (ent) fitCell(this.orbit, camera, ent.size);
      },
    });

    window.addEventListener('keydown', (e) => this.onKeydown(e));

    const resize = (): void => {
      const width = Math.max(1, this.els.host.clientWidth);
      const height = Math.max(1, this.els.host.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      const ent = this.entities[this.state.id];
      if (ent) {
        fitCell(this.orbit, camera, ent.size);
      }
    };
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(resize);
      this.resizeObserver.observe(this.els.host);
    } else {
      this.resizeObserver = null;
      window.addEventListener('resize', resize);
    }
    this.resize = resize;
  }

  private resize: () => void = () => {};
  private loading = false;

  private updateLoaderText(text: string): void {
    const loaderText = this.els.loader.querySelector<HTMLElement>('.loader-text');
    if (loaderText) loaderText.textContent = text;
  }

  private showLoader(text: string): void {
    this.els.loader.hidden = false;
    this.els.loader.style.opacity = '1';
    this.updateLoaderText(text);
  }

  private hideLoader(): void {
    this.els.loader.style.opacity = '0';
    setTimeout(() => {
      this.els.loader.hidden = true;
    }, 400);
  }

  private async loadEntity(cellId: string): Promise<CellEntity | null> {
    const existing = this.entities[cellId];
    if (existing) return existing;

    const cell = CELLS.find((c) => c.id === cellId);
    if (!cell) return null;

    const model = await loadGLTF(cell.modelUrl, this.sceneCtx.renderer, (loaded, total) => {
      const pct = total > 0 ? Math.round((loaded / total) * 100) : 0;
      this.updateLoaderText(`加载 ${cell.name}… ${pct}%`);
    });

    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    model.position.sub(center);

    const wrapper = new THREE.Group();
    wrapper.visible = false;
    wrapper.add(model);
    this.sceneCtx.scene.add(wrapper);

    const shells: ShellMesh[] = [];
    const wires: WireMesh[] = [];
    model.traverse((obj) => {
      if (obj.userData.shellOpacity !== undefined) shells.push(obj as ShellMesh);
      if (obj.userData.isWire) wires.push(obj as WireMesh);
    });

    const entity: CellEntity = { wrapper, model, size, shells, wires };
    this.entities[cellId] = entity;
    return entity;
  }

  private async switchCell(id: string): Promise<void> {
    if (id === this.state.id && this.state.phase === 'idle') return;
    if (this.loading) return;
    const cell = CELLS.find((c) => c.id === id);
    if (!cell) return;

    if (!this.entities[id]) {
      this.loading = true;
      this.showLoader(`加载 ${cell.name}…`);
      await this.loadEntity(id);
      this.loading = false;
      this.hideLoader();
    }

    this.state.next = id;
    this.state.phase = 'out';
    const index = CELLS.indexOf(cell);
    this.info.renderInfo(cell, index);
    setActiveNav(this.els.navEl, id);
  }

  private onKeydown(e: KeyboardEvent): void {
    if (
      e.altKey ||
      e.ctrlKey ||
      e.metaKey ||
      /INPUT|TEXTAREA|SELECT/.test((document.activeElement as HTMLElement | null)?.tagName ?? '')
    ) {
      return;
    }
    const direction =
      e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!direction) return;
    e.preventDefault();
    const active = this.state.next ?? this.state.id;
    const index = CELLS.findIndex((c) => c.id === active);
    if (index < 0) return;
    const nextCell = CELLS[(index + direction + CELLS.length) % CELLS.length];
    if (nextCell) this.switchCell(nextCell.id);
  }

  private tick = (): void => {
    requestAnimationFrame(this.tick);
    const { scene, camera, renderer } = this.sceneCtx;
    const dt = Math.min(this.clock.getDelta(), 0.05);

    if (this.state.phase === 'out') {
      this.state.fade = Math.max(0, this.state.fade - dt / 0.23);
      if (this.state.fade === 0) {
        const currentEnt = this.entities[this.state.id];
        if (currentEnt) currentEnt.wrapper.visible = false;
        if (this.state.next) {
          this.state.id = this.state.next;
          this.state.next = null;
        }
        const nextEnt = this.entities[this.state.id];
        if (nextEnt) {
          nextEnt.wrapper.visible = true;
          fitCell(this.orbit, camera, nextEnt.size);
        }
        this.state.phase = 'in';
      }
    } else if (this.state.phase === 'in') {
      this.state.fade = Math.min(1, this.state.fade + dt / 0.29);
      if (this.state.fade === 1) this.state.phase = 'idle';
    }
    renderer.domElement.style.opacity = String(this.state.fade);
    this.els.pinsEl.style.opacity = String(this.state.fade);

    if (this.state.spin && this.pointerController.pointerMap.size === 0) {
      this.orbit.targetTheta += dt * 0.18;
    }
    const damping = 1 - Math.exp(-dt * 7);
    this.orbit.theta += (this.orbit.targetTheta - this.orbit.theta) * damping;
    this.orbit.phi += (this.orbit.targetPhi - this.orbit.phi) * damping;
    this.orbit.distance += (this.orbit.targetDistance - this.orbit.distance) * damping;
    this.orbit.focus.lerp(this.orbit.targetFocus, damping);

    camera.position.set(
      this.orbit.focus.x + this.orbit.distance * Math.sin(this.orbit.phi) * Math.sin(this.orbit.theta),
      this.orbit.focus.y + this.orbit.distance * Math.cos(this.orbit.phi),
      this.orbit.focus.z + this.orbit.distance * Math.sin(this.orbit.phi) * Math.cos(this.orbit.theta),
    );
    camera.lookAt(this.orbit.focus);
    camera.updateMatrixWorld();
    positionPins(
      this.state,
      this.entities,
      camera,
      scene,
      this.els.host,
      this.info.getPinButtons(),
    );
    renderer.render(scene, camera);
  };

  async start(): Promise<void> {
    const firstCell = CELLS[0]!;
    this.updateLoaderText(`加载 ${firstCell.name}…`);
    const firstEntity = await this.loadEntity(firstCell.id);
    if (!firstEntity) {
      this.showError('首个模型加载失败');
      return;
    }

    this.resize();
    firstEntity.wrapper.visible = true;
    this.info.renderInfo(firstCell, 0);
    setActiveNav(this.els.navEl, firstCell.id);
    this.orbit.distance = this.orbit.targetDistance;
    applyModes(this.entities, this.state);
    this.tick();

    this.hideLoader();
  }

  showError(message: string): void {
    this.els.loader.innerHTML =
      `<div class="loader-content"><div class="loader-text" style="color:var(--error)">${message}</div></div>`;
  }
}
