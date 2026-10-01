import type { Cell, ModelStats } from '../types/index.ts';
import type { AppElements } from './elements.ts';
import { replayAnimation } from './elements.ts';

export type InfoController = {
  selectPart(index: number, notify?: boolean): void;
  renderInfo(cell: Cell, cellIndex: number): void;
  renderStats(stats: ModelStats): void;
  getPinButtons(): readonly HTMLButtonElement[];
};

export type InfoOptions = {
  /** 用户点击结构时回调，用于把镜头推向该结构 */
  readonly onSelectPart?: (index: number) => void;
};

const numberFormat = new Intl.NumberFormat('zh-CN');

export function createInfoController(
  els: AppElements,
  totalCells: number,
  options: InfoOptions = {},
): InfoController {
  let pinButtons: HTMLButtonElement[] = [];
  let currentCell: Cell | null = null;

  const selectPart = (index: number, notify = true): void => {
    if (!currentCell) return;
    const part = currentCell.parts[index];
    if (!part) return;
    els.featureTitle.textContent = part.name;
    els.featureDescription.textContent = part.text;
    replayAnimation(els.featureDetail, 'flip');

    const featureButtons = Array.from(els.featuresEl.children) as HTMLButtonElement[];
    featureButtons.forEach((el, i) => el.classList.toggle('active', i === index));
    pinButtons.forEach((el, i) => el.classList.toggle('active', i === index));

    if (notify) options.onSelectPart?.(index);
  };

  const renderInfo = (cell: Cell, cellIndex: number): void => {
    currentCell = cell;
    const seq = `${pad(cellIndex + 1)} / ${pad(totalCells)}`;
    els.stageCode.textContent = `Specimen ${seq}`;
    els.specimenNo.textContent = seq;
    els.stageTitle.textContent = cell.name;
    els.stageSubtitle.textContent = cell.english;
    els.cellTitle.textContent = cell.name;
    els.cellEnglish.textContent = cell.english;
    els.cellScale.textContent = cell.scale;
    els.cellDescription.textContent = cell.description;
    els.cellConcept.textContent = cell.concept;

    // 样本色写入根节点，驱动强调色 / 标注点 / 3D 轮廓光
    document.documentElement.style.setProperty('--tint', cell.tint);

    els.featuresEl.replaceChildren();
    els.pinsEl.replaceChildren();
    pinButtons = [];

    cell.parts.forEach((part, i) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'feature';
      button.innerHTML =
        `<span class="feature-index">${pad(i + 1)}</span>` +
        '<span class="feature-name"></span><span class="feature-arrow">→</span>';
      const nameEl = button.querySelector<HTMLSpanElement>('.feature-name');
      if (nameEl) nameEl.textContent = part.name;
      button.addEventListener('click', () => selectPart(i));
      els.featuresEl.appendChild(button);

      const pin = document.createElement('button');
      pin.type = 'button';
      pin.className = 'pin';
      pin.setAttribute('aria-label', `查看${part.name}`);
      pin.innerHTML = '<span class="pin-dot"></span><span class="pin-label"></span>';
      const labelEl = pin.querySelector<HTMLSpanElement>('.pin-label');
      if (labelEl) labelEl.textContent = part.name;
      pin.addEventListener('click', () => selectPart(i));
      els.pinsEl.appendChild(pin);
      pinButtons.push(pin);
    });

    replayAnimation(els.detailBody, 'reveal');
    selectPart(0, false);
  };

  const renderStats = (stats: ModelStats): void => {
    els.statVerts.textContent = numberFormat.format(stats.vertices);
    els.statFaces.textContent = numberFormat.format(stats.triangles);
    els.statMats.textContent = String(stats.materials);
  };

  return {
    selectPart,
    renderInfo,
    renderStats,
    getPinButtons: () => pinButtons,
  };
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
