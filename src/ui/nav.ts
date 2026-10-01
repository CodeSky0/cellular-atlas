import type { Cell } from '../types/index.ts';
import type { AppElements } from './elements.ts';

export function buildNav(cells: readonly Cell[], els: AppElements, onSwitch: (id: string) => void): void {
  els.navEl.replaceChildren();

  cells.forEach((cell, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'nav-item';
    button.dataset.id = cell.id;
    button.innerHTML =
      `<span class="nav-index">${pad(index + 1)}</span>` +
      '<span class="nav-content"><span class="nav-title"></span><span class="nav-sub"></span></span>' +
      '<span class="nav-arrow">→</span>';

    const titleEl = button.querySelector<HTMLSpanElement>('.nav-title');
    const subEl = button.querySelector<HTMLSpanElement>('.nav-sub');
    if (titleEl) titleEl.append(document.createTextNode(cell.name));
    if (subEl) subEl.textContent = cell.english;

    // 每一行保留自己的样本色，未选中时也能辨认
    button.style.setProperty('--tint', cell.tint);

    // 指针跟随的柔光
    button.addEventListener('pointermove', (event) => {
      const rect = button.getBoundingClientRect();
      button.style.setProperty('--mx', `${event.clientX - rect.left}px`);
      button.style.setProperty('--my', `${event.clientY - rect.top}px`);
    });

    button.addEventListener('click', () => onSwitch(cell.id));
    els.navEl.appendChild(button);
  });
}

export function setActiveNav(navEl: HTMLElement, cellId: string): void {
  Array.from(navEl.children).forEach((child) => {
    if (child instanceof HTMLElement) {
      child.classList.toggle('active', child.dataset.id === cellId);
    }
  });
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
