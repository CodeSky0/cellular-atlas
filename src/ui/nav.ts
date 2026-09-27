import type { Cell } from '../types/index.ts';
import type { AppElements } from './elements.ts';

export function buildNav(cells: readonly Cell[], els: AppElements, onSwitch: (id: string) => void): void {
  cells.forEach((cell, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'nav-item';
    button.dataset.id = cell.id;
    button.innerHTML =
      `<span class="nav-index">0${index + 1}</span>` +
      '<span class="nav-content"><span class="nav-title"></span><span class="nav-sub"></span></span>';
    const titleEl = button.querySelector<HTMLSpanElement>('.nav-title');
    const subEl = button.querySelector<HTMLSpanElement>('.nav-sub');
    if (titleEl) titleEl.textContent = cell.name;
    if (subEl) subEl.textContent = cell.english;
    button.addEventListener('click', () => onSwitch(cell.id));
    els.navEl.appendChild(button);
  });
}

export function setActiveNav(navEl: HTMLElement, cellId: string): void {
  Array.from(navEl.children).forEach((button) => {
    if (button instanceof HTMLElement) {
      button.classList.toggle('active', button.dataset.id === cellId);
    }
  });
}
