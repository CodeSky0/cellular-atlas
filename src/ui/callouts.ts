import type { Cell } from '../types/index.ts';

const SVG_NS = 'http://www.w3.org/2000/svg';
const GAP_X = 26;
const GAP_Y = 8;
const PAD = 12;
/** 顶部为样本标识与工具条留出净空 */
const PAD_TOP = 58;

export type Anchor = {
  readonly x: number;
  readonly y: number;
  readonly visible: boolean;
};

/** 可摆放元素：x/y 为锚点，tx/ty 为目标左上角，px/py 为最近一次写入值 */
type Placeable = {
  readonly el: HTMLElement;
  x: number;
  y: number;
  w: number;
  h: number;
  tx: number;
  ty: number;
  px: number;
  py: number;
  placed: boolean;
};

type PartItem = Placeable & {
  readonly poly: SVGPolylineElement;
  readonly dot: SVGCircleElement;
  side: 'left' | 'right';
  visible: boolean;
};

type ChipItem = Placeable & {
  readonly from: number;
  readonly to: number;
  visible: boolean;
  active: boolean;
};

export type CalloutController = {
  build(cell: Cell, onSelect: (index: number) => void): void;
  setActivePart(index: number): void;
  updateParts(anchors: readonly Anchor[], width: number, height: number): void;
  updateLinks(anchors: readonly Anchor[], width: number, height: number, activePart: number | null): void;
};

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** 竖向防重叠排布：顺序下推 → 整体回收 → 顶部归位 */
function stackVertically(
  items: readonly { y: number; h: number; ty: number }[],
  height: number,
  topPad: number,
): void {
  if (!items.length) return;
  const list = items as { y: number; h: number; ty: number }[];
  let cursor = topPad;
  for (const item of list) {
    let ty = item.y - item.h / 2;
    if (ty < cursor) ty = cursor;
    item.ty = ty;
    cursor = ty + item.h + GAP_Y;
  }

  const overflow = cursor - GAP_Y - (height - PAD);
  if (overflow <= 0) return;

  let bottom = height - PAD;
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const item = list[i]!;
    item.ty = Math.min(item.ty, bottom - item.h);
    bottom = item.ty - GAP_Y;
  }
  const top = list[0]!.ty;
  if (top < topPad) {
    const shift = topPad - top;
    for (const item of list) item.ty += shift;
  }
}

function applyPlace(item: Placeable): void {
  if (item.placed && Math.abs(item.tx - item.px) < 0.4 && Math.abs(item.ty - item.py) < 0.4) return;
  item.placed = true;
  item.px = item.tx;
  item.py = item.ty;
  item.el.style.transform = `translate3d(${item.tx.toFixed(1)}px, ${item.ty.toFixed(1)}px, 0)`;
}

export function createCalloutController(
  svg: SVGSVGElement,
  partsLayer: HTMLElement,
  linksLayer: HTMLElement,
): CalloutController {
  let partItems: PartItem[] = [];
  let chipItems: ChipItem[] = [];
  const leftBucket: PartItem[] = [];
  const rightBucket: PartItem[] = [];

  const measure = (): void => {
    for (const item of partItems) {
      item.w = item.el.offsetWidth || 140;
      item.h = item.el.offsetHeight || 30;
    }
    for (const item of chipItems) {
      item.w = item.el.offsetWidth || 72;
      item.h = item.el.offsetHeight || 18;
    }
  };

  const build = (cell: Cell, onSelect: (index: number) => void): void => {
    svg.replaceChildren();
    partsLayer.replaceChildren();
    linksLayer.replaceChildren();
    partItems = [];
    chipItems = [];

    cell.parts.forEach((part, index) => {
      const poly = document.createElementNS(SVG_NS, 'polyline');
      const dot = document.createElementNS(SVG_NS, 'circle');
      dot.setAttribute('r', '2.6');
      dot.setAttribute('class', 'lead-dot');
      svg.append(poly, dot);

      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'callout';
      el.innerHTML =
        `<span class="callout-index">${pad(index + 1)}</span>` + '<span class="callout-title"></span>';
      const title = el.querySelector<HTMLSpanElement>('.callout-title');
      if (title) title.textContent = part.name;
      el.addEventListener('click', () => onSelect(index));
      partsLayer.appendChild(el);

      partItems.push({
        el,
        poly,
        dot,
        x: 0,
        y: 0,
        w: 0,
        h: 0,
        tx: 0,
        ty: 0,
        px: 0,
        py: 0,
        placed: false,
        side: 'left',
        visible: false,
      });
    });

    cell.links.forEach((link) => {
      const el = document.createElement('span');
      el.className = 'link-chip';
      el.textContent = link.label;
      linksLayer.appendChild(el);
      chipItems.push({
        el,
        from: link.from,
        to: link.to,
        x: 0,
        y: 0,
        w: 0,
        h: 0,
        tx: 0,
        ty: 0,
        px: 0,
        py: 0,
        placed: false,
        visible: false,
        active: false,
      });
    });

    measure();
    if (document.fonts?.ready) {
      void document.fonts.ready.then(() => measure());
    }
  };

  const setActivePart = (index: number): void => {
    partItems.forEach((item, i) => {
      const active = i === index;
      item.el.classList.toggle('active', active);
      item.poly.classList.toggle('is-active', active);
    });
    chipItems.forEach((item) => {
      const active = item.from === index || item.to === index;
      item.active = active;
      item.el.classList.toggle('active', active);
    });
  };

  const updateParts = (anchors: readonly Anchor[], width: number, height: number): void => {
    if (!partItems.length) return;
    if (partItems[0]!.w === 0) measure();

    leftBucket.length = 0;
    rightBucket.length = 0;

    partItems.forEach((item, i) => {
      const anchor = anchors[i];
      item.visible = Boolean(anchor?.visible);
      item.el.classList.toggle('offscreen', !item.visible);
      if (!anchor || !item.visible) {
        item.poly.style.display = 'none';
        item.dot.style.display = 'none';
        return;
      }

      item.x = anchor.x;
      item.y = anchor.y;
      // 就近分侧，越界时自动换边
      let side: 'left' | 'right' = anchor.x < width / 2 ? 'left' : 'right';
      if (side === 'left' && anchor.x - GAP_X - item.w < PAD) side = 'right';
      else if (side === 'right' && anchor.x + GAP_X + item.w > width - PAD) side = 'left';
      item.side = side;
      item.tx = side === 'left' ? anchor.x - GAP_X - item.w : anchor.x + GAP_X;
      (side === 'left' ? leftBucket : rightBucket).push(item);
    });

    for (const bucket of [leftBucket, rightBucket]) {
      if (bucket.length < 1) continue;
      const ordered = bucket.slice().sort((a, b) => a.y - b.y);
      const proxy = ordered.map((item) => ({ y: item.y, h: item.h, ty: 0 }));
      stackVertically(proxy, height, PAD_TOP);
      ordered.forEach((item, i) => {
        item.ty = proxy[i]!.ty;
      });
      for (const item of ordered) {
        applyPlace(item);
        const edgeX = item.side === 'left' ? item.tx + item.w : item.tx;
        const centerY = item.ty + item.h / 2;
        const stubX = item.side === 'left' ? item.x - 14 : item.x + 14;
        item.poly.setAttribute(
          'points',
          `${item.x.toFixed(1)},${item.y.toFixed(1)} ${stubX.toFixed(1)},${item.y.toFixed(1)} ${edgeX.toFixed(1)},${centerY.toFixed(1)}`,
        );
        item.poly.style.display = '';
        item.dot.setAttribute('cx', item.x.toFixed(1));
        item.dot.setAttribute('cy', item.y.toFixed(1));
        item.dot.style.display = '';
      }
    }
  };

  const updateLinks = (
    anchors: readonly Anchor[],
    width: number,
    height: number,
    activePart: number | null,
  ): void => {
    if (!chipItems.length) return;
    if (chipItems[0]!.w === 0) measure();

    const visible: ChipItem[] = [];
    chipItems.forEach((item, i) => {
      const anchor = anchors[i];
      const active = activePart !== null && (item.from === activePart || item.to === activePart);
      if (active !== item.active) {
        item.active = active;
        item.el.classList.toggle('active', active);
      }
      item.visible = Boolean(anchor?.visible);
      item.el.classList.toggle('offscreen', !item.visible);
      if (!anchor || !item.visible) return;
      item.x = anchor.x;
      item.y = anchor.y;
      let tx = anchor.x + 14;
      if (tx + item.w > width - PAD) tx = anchor.x - 14 - item.w;
      if (tx < PAD) tx = PAD;
      item.tx = tx;
      visible.push(item);
    });

    if (!visible.length) return;
    const ordered = visible.slice().sort((a, b) => a.y - b.y);
    const proxy = ordered.map((item) => ({ y: item.y, h: item.h, ty: 0 }));
    stackVertically(proxy, height, 16);
    ordered.forEach((item, i) => {
      item.ty = proxy[i]!.ty;
    });
    for (const item of ordered) applyPlace(item);
  };

  return {
    build,
    setActivePart,
    updateParts,
    updateLinks,
  };
}
