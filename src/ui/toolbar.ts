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
  readonly onClipToggle: (on: boolean) => void;
  readonly onLinkToggle: (on: boolean) => void;
  readonly onCalloutToggle: (on: boolean) => void;
  readonly onReset: () => void;
};

export function createToolbarController(els: AppElements): ToolbarController {
  const bindToggle = (
    button: HTMLButtonElement,
    read: () => boolean,
    write: (on: boolean) => void,
    onChange: (on: boolean) => void,
  ): void => {
    syncToggle(button, read());
    button.addEventListener('click', () => {
      const next = !read();
      write(next);
      syncToggle(button, next);
      onChange(next);
    });
  };

  return {
    init(state, callbacks) {
      bindToggle(
        els.spinBtn,
        () => state.spin,
        (on) => {
          state.spin = on;
        },
        () => callbacks.onSpinToggle(),
      );
      bindToggle(
        els.xrayBtn,
        () => state.xray,
        (on) => {
          state.xray = on;
        },
        () => callbacks.onXrayToggle(),
      );
      bindToggle(
        els.wireBtn,
        () => state.wire,
        (on) => {
          state.wire = on;
        },
        () => callbacks.onWireToggle(),
      );
      bindToggle(
        els.clipBtn,
        () => state.clip,
        (on) => {
          state.clip = on;
        },
        (on) => callbacks.onClipToggle(on),
      );
      bindToggle(
        els.linkBtn,
        () => state.links,
        (on) => {
          state.links = on;
        },
        (on) => callbacks.onLinkToggle(on),
      );
      bindToggle(
        els.calloutBtn,
        () => state.callouts,
        (on) => {
          state.callouts = on;
        },
        (on) => callbacks.onCalloutToggle(on),
      );

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
