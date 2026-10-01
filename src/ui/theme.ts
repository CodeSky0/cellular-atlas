import type { ThemeName } from '../types/index.ts';

const STORAGE_KEY = 'atlas-theme';
const ANIM_CLASS = 'theme-anim';

export type ThemeController = {
  get(): ThemeName;
  toggle(): void;
  init(): void;
};

function stored(): ThemeName | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

function current(): ThemeName {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

export function createThemeController(
  toggleButton: HTMLButtonElement,
  onChange: (theme: ThemeName) => void,
): ThemeController {
  let theme: ThemeName = stored() ?? current();
  let timer = 0;

  const apply = (next: ThemeName, animate: boolean): void => {
    theme = next;
    const root = document.documentElement;
    if (animate) {
      root.classList.add(ANIM_CLASS);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => root.classList.remove(ANIM_CLASS), 560);
    }
    root.setAttribute('data-theme', next);
    toggleButton.setAttribute('aria-checked', String(next === 'dark'));
    toggleButton.title = next === 'dark' ? '切换到浅色主题' : '切换到深色主题';
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', next === 'dark' ? '#06070a' : '#f0efeb');
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* 无痕模式忽略 */
    }
    onChange(next);
  };

  return {
    get: () => theme,
    toggle: () => apply(theme === 'dark' ? 'light' : 'dark', true),
    init: () => {
      apply(theme, false);
      toggleButton.addEventListener('click', () => apply(theme === 'dark' ? 'light' : 'dark', true));
    },
  };
}
