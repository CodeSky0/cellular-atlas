import type { AppElements } from './elements.ts';

export type LoaderController = {
  show(title: string, sub: string, phase?: string): void;
  setProgress(value: number): void;
  setPhase(text: string): void;
  fail(message: string): Promise<void>;
  hide(): Promise<void>;
  isVisible(): boolean;
};

const MIN_VISIBLE = 720;
const FADE_OUT = 560;

/**
 * 加载层控制器：进度条按缓动追上真实进度，
 * 并保证最短展示时间，避免加载层一闪而过。
 */
export function createLoaderController(els: AppElements): LoaderController {
  let target = 0;
  let shown = 0;
  let frame = 0;
  let shownAt = 0;
  let visible = false;
  let lastPct = '';

  const step = (): void => {
    frame = 0;
    shown += (target - shown) * 0.16;
    if (target - shown < 0.2) shown = target;
    els.loaderBar.style.width = `${shown.toFixed(2)}%`;
    const pct = `${Math.round(shown)}%`;
    if (pct !== lastPct) {
      els.loaderPct.textContent = pct;
      lastPct = pct;
    }
    if (shown < target) frame = window.requestAnimationFrame(step);
  };

  const kick = (): void => {
    if (!frame) frame = window.requestAnimationFrame(step);
  };

  const reset = (): void => {
    els.loader.hidden = false;
    els.loader.classList.remove('is-error');
    els.loader.style.opacity = '1';
    els.loaderBar.style.width = '0%';
    els.loaderPct.textContent = '0%';
    target = 0;
    shown = 0;
    lastPct = '0%';
  };

  return {
    show(title, sub, phase) {
      reset();
      els.loaderTitle.textContent = title;
      els.loaderSub.textContent = sub;
      if (phase) els.loaderPhase.textContent = phase;
      shownAt = performance.now();
      visible = true;
    },
    setProgress(value) {
      target = Math.max(target, Math.min(1, Math.max(0, value)) * 100);
      kick();
    },
    setPhase(text) {
      els.loaderPhase.textContent = text;
    },
    async fail(message) {
      target = 100;
      kick();
      els.loader.classList.add('is-error');
      els.loaderTitle.textContent = '模型加载失败';
      els.loaderSub.textContent = message;
      els.loaderPhase.textContent = '请检查网络连接后刷新页面';
    },
    async hide() {
      if (!visible) return;
      target = 100;
      kick();
      const wait = Math.max(0, MIN_VISIBLE - (performance.now() - shownAt));
      await new Promise((resolve) => window.setTimeout(resolve, wait));
      els.loader.style.opacity = '0';
      visible = false;
      await new Promise((resolve) => window.setTimeout(resolve, FADE_OUT));
      els.loader.hidden = true;
    },
    isVisible: () => visible,
  };
}
