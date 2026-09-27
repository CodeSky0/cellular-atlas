import type { Cell } from '../types/index.ts';
import type { AppElements } from './elements.ts';

export type InfoController = {
  selectPart(index: number): void;
  renderInfo(cell: Cell, cellIndex: number): void;
  getPinButtons(): readonly HTMLButtonElement[];
};

export function createInfoController(els: AppElements, totalCells: number): InfoController {
  let pinButtons: HTMLButtonElement[] = [];
  let currentCell: Cell | null = null;

  const selectPart = (index: number): void => {
    if (!currentCell) return;
    const part = currentCell.parts[index];
    if (!part) return;
    els.featureTitle.textContent = part.name;
    els.featureDescription.textContent = part.text;

    const featureButtons = Array.from(els.featuresEl.children) as HTMLButtonElement[];
    featureButtons.forEach((el, i) => {
      el.classList.toggle('active', i === index);
    });
    pinButtons.forEach((el, i) => {
      el.classList.toggle('active', i === index);
    });
  };

  const renderInfo = (cell: Cell, cellIndex: number): void => {
    currentCell = cell;
    const seq = `0${cellIndex + 1} / 0${totalCells}`;
    els.stageCode.textContent = `SPECIMEN ${seq}`;
    els.specimenNo.textContent = seq;
    els.stageTitle.textContent = cell.name;
    els.stageSubtitle.textContent = cell.english;
    els.cellTitle.textContent = cell.name;
    els.cellEnglish.textContent = cell.english;
    els.cellScale.textContent = cell.scale;
    els.cellDescription.textContent = cell.description;
    els.cellConcept.textContent = cell.concept;

    els.featuresEl.replaceChildren();
    els.pinsEl.replaceChildren();
    pinButtons = [];

    cell.parts.forEach((part, i) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'feature';
      button.innerHTML =
        `<span class="feature-index">0${i + 1}</span>` +
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

    selectPart(0);
  };

  return {
    selectPart,
    renderInfo,
    getPinButtons: () => pinButtons,
  };
}
