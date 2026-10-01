import * as THREE from 'three';
import { CELLS } from './data/cells.ts';
import type { AppState, CellEntity, ThemeName } from './types/index.ts';
import { createScene } from './scene/renderer.ts';
import { createOrbit, createPointerController } from './scene/orbit.ts';
import { fitDistance } from './scene/fit.ts';
import { createModeMeshes, setModePaper } from './scene/modes.ts';
import { createClipController } from './scene/clip.ts';
import { createLinkVisuals, setLinkPaper, setLinkTint, stepLinkVisual } from './scene/links.ts';
import { getElements, replayAnimation } from './ui/elements.ts';
import { buildNav, setActiveNav } from './ui/nav.ts';
import { createInfoController } from './ui/info.ts';
import { createToolbarController, stopSpin } from './ui/toolbar.ts';
import { createLoaderController } from './ui/loader.ts';
import { createThemeController } from './ui/theme.ts';
import { createCalloutController, type Anchor } from './ui/callouts.ts';
import { collectStats, loadGLTF } from './three/loader.ts';
import { clamp } from './three/geometry.ts';

const reduceMotion =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const FILL_RATIO = 0.92;
const OUT_DURATION = 0.24;
const IN_DURATION = 0.34;

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export class CellularAtlasApp {
  private readonly els = getElements();
  private readonly sceneCtx = createScene(this.els.host);
  private readonly loader = createLoaderController(this.els);
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
    clip: false,
    links: false,
    callouts: false,
    part: 0,
  };
  private readonly info = createInfoController(this.els, CELLS.length, {
    onSelectPart: (index) => this.focusPart(index),
  });
  private readonly toolbar = createToolbarController(this.els);
  private readonly theme: ReturnType<typeof createThemeController>;
  private readonly pointerController = createPointerController({
    host: this.els.host,
    camera: this.sceneCtx.camera,
    orbit: this.orbit,
    onInteractStart: () => stopSpin(this.els, this.state),
  });
  private readonly clock = new THREE.Clock();
  private readonly resizeObserver: ResizeObserver | null;
  private readonly tintColor = new THREE.Color(CELLS[0]!.tint);
  private readonly clip = createClipController(this.sceneCtx.scene, this.tintColor);
  private readonly callouts = createCalloutController(
    this.els.calloutLines,
    this.els.calloutParts,
    this.els.calloutLinks,
  );
  private readonly scratch = new THREE.Vector3();
  private readonly forward = new THREE.Vector3();
  private elapsed = 0;
  private themeName: ThemeName =
    document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';

  private resize: () => void = () => {};
  private loading = false;
  private pendingId: string | null = null;
  private hudAccum = 0;
  private lastZoom = -1;
  private lastBearing = -1;

  constructor() {
    const { camera } = this.sceneCtx;

    this.theme = createThemeController(this.els.themeToggle, (name) => this.onThemeChange(name));

    buildNav(CELLS, this.els, (id) => void this.switchCell(id));

    // 加载期间先把首份样本的文字档案铺好，避免面板出现占位破折号
    this.info.renderInfo(CELLS[0]!, 0);
    setActiveNav(this.els.navEl, CELLS[0]!.id);

    this.toolbar.init(this.state, {
      onSpinToggle: () => {},
      onXrayToggle: () => this.applyModes(),
      onWireToggle: () => this.applyModes(),
      onClipToggle: (on) => this.onClipToggle(on),
      onLinkToggle: (on) => this.els.callouts.classList.toggle('show-links', on),
      onCalloutToggle: (on) => {
        this.els.callouts.classList.toggle('show-parts', on);
        // 标注框已带结构名，隐藏重复的点位标签
        this.els.pinsEl.classList.toggle('quiet', on);
        if (on) this.callouts.setActivePart(this.state.part);
      },
      onReset: () => {
        this.orbit.targetTheta = 0.25;
        this.orbit.targetPhi = 1.13;
        this.orbit.targetFocus.set(0, 0, 0);
        const ent = this.entities[this.state.next ?? this.state.id];
        if (ent) {
          this.applyFit(ent);
          this.orbit.targetDistance = this.orbit.fitDistance;
          this.layoutGround(ent);
        }
      },
    });

    // 剖切深度
    this.els.clipRange.addEventListener('input', () => this.onClipInput());
    this.onClipInput();

    window.addEventListener('keydown', (e) => this.onKeydown(e));

    // 拖拽时显示中心准星
    this.els.host.addEventListener('pointerdown', () => {
      this.els.stage.classList.add('is-dragging');
    });
    const endDrag = (): void => this.els.stage.classList.remove('is-dragging');
    this.els.host.addEventListener('pointerup', endDrag);
    this.els.host.addEventListener('pointercancel', endDrag);
    this.els.host.addEventListener('pointerleave', endDrag);

    // 右栏阅读进度
    const detailBody = this.els.detailBody;
    detailBody.addEventListener(
      'scroll',
      () => {
        const max = detailBody.scrollHeight - detailBody.clientHeight;
        const ratio = max > 0 ? detailBody.scrollTop / max : 0;
        this.els.detailProgress.style.width = `${(ratio * 100).toFixed(1)}%`;
      },
      { passive: true },
    );

    const resize = (): void => {
      const width = Math.max(1, this.els.host.clientWidth);
      const height = Math.max(1, this.els.host.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      this.sceneCtx.setSize(width, height);
      const ent = this.entities[this.state.id];
      if (ent) {
        this.applyFit(ent);
        this.layoutGround(ent);
      }
      this.applyModes();
    };
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(resize);
      this.resizeObserver.observe(this.els.host);
    } else {
      this.resizeObserver = null;
      window.addEventListener('resize', resize);
    }
    this.resize = resize;
    this.installDevPicker();
  }

  /**
   * 开发期标注拾取工具：把页面像素换算成 part.pos 所在的模型坐标，
   * 便于把结构锚点精确落到模型表面。生产构建中整段会被剔除。
   */
  private installDevPicker(): void {
    if (!import.meta.env.DEV) return;
    const app = this;
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const round = (value: number): number => Math.round(value * 1000) / 1000;

    (window as unknown as Record<string, unknown>).__atlas = {
      /**
       * 传入页面像素坐标，返回射线命中模型表面的点（cells.ts 的 pos 坐标系）。
       * radius > 0 时会在该像素周围螺旋搜索，便于拾取细枝这类很难点中的位置。
       */
      pick(sx: number, sy: number, radius = 0) {
        const entity = app.entities[app.state.id];
        if (!entity) return null;
        const rect = app.els.host.getBoundingClientRect();

        const cast = (px: number, py: number): THREE.Intersection | null => {
          pointer.set(
            ((px - rect.left) / rect.width) * 2 - 1,
            -((py - rect.top) / rect.height) * 2 + 1,
          );
          raycaster.setFromCamera(pointer, app.sceneCtx.camera);
          return raycaster.intersectObjects([...entity.baseMeshes], false)[0] ?? null;
        };

        let hit = cast(sx, sy);
        let hitX = sx;
        let hitY = sy;
        if (!hit && radius > 0) {
          search: for (let r = 2; r <= radius; r += 2) {
            const steps = Math.max(8, Math.round(r * 1.6));
            for (let i = 0; i < steps; i += 1) {
              const angle = (i / steps) * Math.PI * 2;
              const px = sx + Math.cos(angle) * r;
              const py = sy + Math.sin(angle) * r;
              const probe = cast(px, py);
              if (probe) {
                hit = probe;
                hitX = px;
                hitY = py;
                break search;
              }
            }
          }
        }
        if (!hit) return null;

        const local = entity.model.worldToLocal(hit.point.clone());
        return {
          pos: [round(local.x), round(local.y), round(local.z)],
          distance: round(hit.distance),
          screen: [round(hitX), round(hitY)],
        };
      },
      state: () => ({
        id: app.state.id,
        theta: round(app.orbit.theta),
        phi: round(app.orbit.phi),
        distance: round(app.orbit.distance),
        fit: round(app.orbit.fitDistance),
      }),
      /** 立刻把相机放到确定机位，便于截图与拾取严格对齐 */
      frame(theta = 0.25, phi = 1.13) {
        app.orbit.theta = theta;
        app.orbit.targetTheta = theta;
        app.orbit.phi = phi;
        app.orbit.targetPhi = phi;
        app.orbit.focus.set(0, 0, 0);
        app.orbit.targetFocus.set(0, 0, 0);
        app.orbit.distance = app.orbit.targetDistance = app.orbit.fitDistance;
      },
    };
  }

  // ------------------------------------------------------------------ 取景

  /** 依据当前画幅计算并记录取景参数 */
  private applyFit(ent: CellEntity): void {
    const previous = this.orbit.fitDistance;
    const distance = fitDistance(this.sceneCtx.camera, ent.size, FILL_RATIO);
    // 用户尚未手动缩放时，取景距离跟随画幅变化
    const following = previous <= 0 || Math.abs(this.orbit.targetDistance - previous) < previous * 0.03;
    this.orbit.fitDistance = distance;
    this.orbit.minDistance = distance * 0.3;
    this.orbit.maxDistance = distance * 3.4;
    if (following) this.orbit.targetDistance = distance;
    else this.orbit.targetDistance = Math.min(this.orbit.maxDistance, this.orbit.targetDistance);
  }

  /** 地面光池贴着模型底部 */
  private layoutGround(ent: CellEntity): void {
    const radius = Math.max(ent.size.x, ent.size.z) * 1.15 + ent.size.y * 0.12;
    this.sceneCtx.ground.scale.setScalar(Math.max(0.4, radius));
    this.sceneCtx.ground.position.y = -ent.size.y * 0.5 - radius * 0.04;
    const longest = Math.max(ent.size.x, ent.size.y, ent.size.z, 0.001);
    this.clip.layout(ent.size.z * 0.62, longest * 1.35);
  }

  // ------------------------------------------------------------------ 剖切

  private onClipInput(): void {
    const raw = Number(this.els.clipRange.value);
    const value = Number.isFinite(raw) ? raw / 100 : 0.5;
    this.clip.setValue(value);
    this.els.clipValue.textContent = String(Math.round(value * 100));
    this.els.clipRange.style.setProperty('--fill', `${(value * 100).toFixed(1)}%`);
  }

  private onClipToggle(on: boolean): void {
    this.clip.setEnabled(on);
    this.els.clipPanel.hidden = !on;
    this.applyClip();
  }

  private applyClip(): void {
    for (const id of Object.keys(this.entities)) {
      const entity = this.entities[id];
      if (entity) this.clip.applyTo(entity.clipMaterials);
    }
  }

  // ------------------------------------------------------------------ 模式

  private applyModes(): void {
    const ent = this.entities[this.state.id];
    if (!ent) return;
    const xray = this.state.xray;
    const wire = this.state.wire;

    for (const mesh of ent.baseMeshes) {
      const baseOpacity = mesh.userData.shellOpacity ?? 1;
      const opaque = mesh.userData.shellOpaque ?? true;
      const originalSide = (mesh.userData.originalSide ?? THREE.FrontSide) as THREE.Side;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) {
        if (xray) {
          material.transparent = true;
          material.opacity = Math.max(0.06, baseOpacity * 0.24);
          material.depthWrite = false;
          material.side = THREE.DoubleSide;
        } else {
          material.transparent = !opaque;
          material.opacity = opaque ? 1 : baseOpacity;
          material.depthWrite = opaque;
          material.side = originalSide;
        }
        material.needsUpdate = true;
      }
      mesh.visible = !wire;
    }

    ent.modes.contour.visible = wire;
    ent.modes.xray.visible = xray;
  }

  // ------------------------------------------------------------------ 加载

  private async loadEntity(cellId: string): Promise<CellEntity | null> {
    const existing = this.entities[cellId];
    if (existing) return existing;

    const cell = CELLS.find((c) => c.id === cellId);
    if (!cell) return null;

    const index = CELLS.indexOf(cell);
    this.loader.show(
      `正在构建${cell.name}模型`,
      `Specimen ${pad(index + 1)} · ${cell.english}`,
      '下载模型数据',
    );

    const model = await loadGLTF(cell.modelUrl, this.sceneCtx.renderer, (loaded, total) => {
      this.loader.setProgress(loaded / total);
    });

    this.loader.setProgress(1);
    this.loader.setPhase('解析材质与几何');

    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    model.position.sub(center);

    const wrapper = new THREE.Group();
    wrapper.visible = false;
    wrapper.add(model);
    this.sceneCtx.scene.add(wrapper);

    const tint = new THREE.Color(cell.tint);
    const baseMeshes: THREE.Mesh[] = [];
    model.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.userData.originalSide = (mesh.material as THREE.Material).side;
      baseMeshes.push(mesh);
    });

    const first = baseMeshes[0];
    if (!first) return null;
    const stats = collectStats(model);
    const gridScale = 16 / Math.max(size.x, size.y, size.z, 0.001);
    const modes = createModeMeshes(first, tint, { gridScale });
    setModePaper(modes, this.themeName === 'light');

    // 结构之间的引导弧，与模型共享坐标系
    const links = createLinkVisuals(cell, size, tint);
    setLinkPaper(links, this.themeName === 'light');
    for (const link of links) {
      model.add(link.mesh);
    }

    const clipMaterials: THREE.Material[] = [modes.xray.material, modes.contour.material];
    for (const mesh of baseMeshes) {
      const material = mesh.material as THREE.Material | THREE.Material[];
      if (Array.isArray(material)) clipMaterials.push(...material);
      else clipMaterials.push(material);
    }

    const entity: CellEntity = {
      wrapper,
      model,
      size,
      stats,
      modes,
      baseMeshes,
      links,
      clipMaterials,
    };
    this.entities[cellId] = entity;
    this.clip.applyTo(clipMaterials);
    this.loader.setPhase('装配光照与视图');
    return entity;
  }

  // ------------------------------------------------------------------ 切换

  private async switchCell(id: string): Promise<void> {
    if (this.loading) {
      this.pendingId = id;
      return;
    }
    if (id === this.state.id && this.state.phase === 'idle') return;
    const cell = CELLS.find((c) => c.id === id);
    if (!cell) return;

    const entity = this.entities[id] ?? (await this.ensureEntity(id));
    if (!entity) return;

    replayAnimation(this.els.stageSweep, 'run');
    this.tintColor.set(cell.tint);
    this.sceneCtx.setTint(this.tintColor);
    this.clip.setTint(this.tintColor);
    setLinkTint(entity.links, this.tintColor);
    this.layoutGround(entity);

    this.state.next = id;
    this.state.phase = 'out';
    this.state.part = 0;
    const index = CELLS.indexOf(cell);
    this.info.renderInfo(cell, index);
    this.info.renderStats(entity.stats);
    this.callouts.build(cell, (partIndex) => this.info.selectPart(partIndex));
    this.callouts.setActivePart(0);
    setActiveNav(this.els.navEl, id);
  }

  private async ensureEntity(id: string): Promise<CellEntity | null> {
    if (this.entities[id]) return this.entities[id]!;
    this.loading = true;
    try {
      const entity = await this.loadEntity(id);
      await this.loader.hide();
      return entity;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.loader.fail(message);
      return null;
    } finally {
      this.loading = false;
    }
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
    if (nextCell) void this.switchCell(nextCell.id);
  }

  // ------------------------------------------------------------------ 主题

  private onThemeChange(name: ThemeName): void {
    this.themeName = name;
    this.sceneCtx.applyTheme(name);
    const paper = name === 'light';
    this.clip.setPaper(paper);
    for (const id of Object.keys(this.entities)) {
      const entity = this.entities[id];
      if (!entity) continue;
      setModePaper(entity.modes, paper);
      setLinkPaper(entity.links, paper);
    }
    const ent = this.entities[this.state.id];
    if (ent) {
      this.layoutGround(ent);
    }
    this.applyModes();
  }

  // ------------------------------------------------------------------ 标注

  /** 点击结构时把镜头推向该结构，并停止自动旋转 */
  private focusPart(index: number): void {
    const cell = CELLS.find((c) => c.id === this.state.id);
    const ent = this.entities[this.state.id];
    const part = cell?.parts[index];
    if (!cell || !ent || !part) return;

    this.state.part = index;
    this.callouts.setActivePart(index);
    stopSpin(this.els, this.state);
    const point = ent.model.localToWorld(new THREE.Vector3(part.pos[0], part.pos[1], part.pos[2]));
    this.orbit.targetFocus.set(point.x, point.y, point.z);
    this.orbit.targetDistance = clamp(
      this.orbit.distance * 0.62,
      this.orbit.minDistance,
      this.orbit.maxDistance,
    );
  }

  /** 把模型局部坐标投影到观察台像素坐标 */
  private projectLocal(local: THREE.Vector3, camera: THREE.PerspectiveCamera, w: number, h: number): Anchor {
    const projected = this.scratch.copy(local);
    this.entities[this.state.id]?.model.localToWorld(projected);
    projected.project(camera);
    const x = (projected.x * 0.5 + 0.5) * w;
    const y = (-projected.y * 0.5 + 0.5) * h;
    return { x, y, visible: projected.z >= -1 && projected.z <= 1 && x > 6 && x < w - 6 && y > 6 && y < h - 6 };
  }

  private updateOverlays(camera: THREE.PerspectiveCamera): void {
    const pinButtons = this.info.getPinButtons();
    const cell = CELLS.find((c) => c.id === this.state.id);
    const ent = this.entities[this.state.id];
    const w = this.els.host.clientWidth;
    const h = this.els.host.clientHeight;

    if (!cell || !ent || this.state.next) {
      pinButtons.forEach((pin) => {
        pin.hidden = true;
      });
      this.callouts.updateParts([], w, h);
      this.callouts.updateLinks([], w, h, this.state.part);
      return;
    }

    this.sceneCtx.scene.updateMatrixWorld(true);

    const partAnchors: Anchor[] = [];
    cell.parts.forEach((part, i) => {
      const anchor = this.projectLocal(new THREE.Vector3(part.pos[0], part.pos[1], part.pos[2]), camera, w, h);
      partAnchors.push(anchor);
      const pin = pinButtons[i];
      if (!pin) return;
      const pinned = anchor.visible && anchor.x > 23 && anchor.x < w - 60 && anchor.y > 65 && anchor.y < h - 65;
      pin.hidden = !pinned;
      if (pinned) {
        pin.style.left = `${anchor.x.toFixed(1)}px`;
        pin.style.top = `${anchor.y.toFixed(1)}px`;
      }
    });
    this.callouts.updateParts(partAnchors, w, h);

    if (this.state.links) {
      const linkAnchors = ent.links.map((link) => this.projectLocal(link.midpoint, camera, w, h));
      this.callouts.updateLinks(linkAnchors, w, h, this.state.part);
    }
  }

  // ------------------------------------------------------------------ 仪表

  private updateHud(): void {
    const zoom = Math.round((this.orbit.fitDistance / Math.max(0.001, this.orbit.distance)) * 100);
    if (zoom !== this.lastZoom) {
      this.lastZoom = zoom;
      this.els.zoomValue.textContent = String(Math.min(999, Math.max(1, zoom)));
    }
    const bearing = ((-this.orbit.theta * 180) / Math.PI) % 360;
    const rounded = Math.round(((bearing + 360) % 360) / 2) * 2;
    if (rounded !== this.lastBearing) {
      this.lastBearing = rounded;
      this.els.compassNeedle.style.setProperty('--bearing', `${rounded}deg`);
    }
  }

  // ------------------------------------------------------------------ 主循环

  private tick = (): void => {
    requestAnimationFrame(this.tick);
    const { camera, renderer } = this.sceneCtx;
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.elapsed += dt;

    if (this.state.phase === 'out') {
      this.state.fade = Math.max(0, this.state.fade - dt / OUT_DURATION);
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
          this.applyFit(nextEnt);
          this.layoutGround(nextEnt);
          this.orbit.distance = this.orbit.fitDistance * 1.18;
          this.applyModes();
        }
        this.state.phase = 'in';
      }
    } else if (this.state.phase === 'in') {
      this.state.fade = Math.min(1, this.state.fade + dt / IN_DURATION);
      if (this.state.fade === 1) this.state.phase = 'idle';
    }
    renderer.domElement.style.opacity = String(this.state.fade);
    this.els.pinsEl.style.opacity = String(this.state.fade);

    if (this.state.spin && this.pointerController.pointerMap.size === 0) {
      this.orbit.targetTheta += dt * 0.17;
    }
    const damping = 1 - Math.exp(-dt * 7.5);
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

    // 前向补光跟随相机
    this.sceneCtx.cameraFill.position.copy(camera.position);
    this.sceneCtx.cameraFill.target.position.copy(this.orbit.focus);

    // 剖切刀片：正对视线时淡出，避免遮挡剖面
    this.forward.subVectors(this.orbit.focus, camera.position).normalize();
    this.clip.setViewDot(Math.abs(this.forward.dot(this.clip.plane.normal)));
    this.clip.update(dt);

    // 结构关联弧
    const ent = this.entities[this.state.id];
    if (ent) {
      for (const link of ent.links) {
        const connected = link.from === this.state.part || link.to === this.state.part;
        const opacity = this.state.links ? (connected ? 1 : 0.26) : 0;
        stepLinkVisual(link, dt, this.elapsed, this.state.links ? 1 : 0, opacity);
      }
    }

    this.updateOverlays(camera);

    this.hudAccum += dt;
    if (this.hudAccum >= 0.1) {
      this.hudAccum = 0;
      this.updateHud();
    }

    this.sceneCtx.render();

    if (
      this.state.phase === 'idle' &&
      !this.loading &&
      this.pendingId &&
      this.pendingId !== this.state.id
    ) {
      const next = this.pendingId;
      this.pendingId = null;
      void this.switchCell(next);
    }
  };

  // ------------------------------------------------------------------ 启动

  async start(): Promise<void> {
    const firstCell = CELLS[0]!;
    this.theme.init();

    try {
      const entity = await this.loadEntity(firstCell.id);
      if (!entity) {
        await this.loader.fail('模型数据为空');
        return;
      }
      await this.loader.hide();

      this.resize();
      entity.wrapper.visible = true;
      this.tintColor.set(firstCell.tint);
      this.sceneCtx.setTint(this.tintColor);
      this.clip.setTint(this.tintColor);
      setLinkTint(entity.links, this.tintColor);
      this.info.renderInfo(firstCell, 0);
      this.info.renderStats(entity.stats);
      this.callouts.build(firstCell, (partIndex) => this.info.selectPart(partIndex));
      this.callouts.setActivePart(0);
      setActiveNav(this.els.navEl, firstCell.id);
      this.applyFit(entity);
      this.layoutGround(entity);
      this.orbit.distance = this.orbit.fitDistance;
      this.orbit.theta = 0.25;
      this.orbit.targetTheta = 0.25;
      this.applyModes();
      this.tick();

      // 首屏进入动画
      this.state.fade = 0;
      this.state.phase = 'in';
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.loader.fail(message);
    }
  }

  showError(message: string): void {
    void this.loader.fail(message);
  }
}
