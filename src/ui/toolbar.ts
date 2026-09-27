import type { AppState } from '../types/index.ts';
import type { AppElements } from './elements.ts';
import { syncToggle } from './elements.ts';

export type ToolbarController = {
  init(state: AppState, callbacks: ToolbarCallbacks): void;
};

export type ToolbarCallbacks = {
  readonly onSpinToggle: () => void;
  readonly onXrayToggle: () => void;
  readonly onWireToggle: () => void;
  readonly onReset: () => void;
};

export function createToolbarController(els: AppElements): ToolbarController {
  return {
    init(state, callbacks) {
      syncToggle(els.spinBtn, state.spin);
      els.spinBtn.addEventListener('click', () => {
        state.spin = !state.spin;
        syncToggle(els.spinBtn, state.spin);
        callbacks.onSpinToggle();
      });
      els.xrayBtn.addEventListener('click', () => {
        state.xray = !state.xray;
        syncToggle(els.xrayBtn, state.xray);
        callbacks.onXrayToggle();
      });
      els.wireBtn.addEventListener('click', () => {
        state.wire = !state.wire;
        syncToggle(els.wireBtn, state.wire);
        callbacks.onWireToggle();
      });
      els.resetBtn.addEventListener('click', () => callbacks.onReset());
    },
  };
}

export function stopSpin(els: AppElements, state: AppState): void {
  if (state.spin) {
    state.spin = false;
    syncToggle(els.spinBtn, false);
  }
}
