import './styles/main.css';
import { CellularAtlasApp } from './app.ts';

const app = new CellularAtlasApp();

try {
  await app.start();
} catch (error) {
  console.error('Cell Atlas Init Error:', error);
  const message = error instanceof Error ? error.message : String(error);
  app.showError(message);
}
