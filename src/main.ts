import './styles/main.css';
import { CellularAtlasApp } from './app.ts';

try {
  const app = new CellularAtlasApp();
  await app.start();
} catch (error) {
  console.error('Cell Atlas Init Error:', error);
  const loader = document.getElementById('loader');
  if (loader) {
    const message = error instanceof Error ? error.message : String(error);
    loader.innerHTML =
      `<div class="loader-content"><div class="loader-text" style="color:var(--error)">初始化失败：${message}</div></div>`;
  }
}
