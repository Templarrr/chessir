import { legalActions } from '../game/rules.js';

export const HARD_LIMIT_MS = 10000;
const SOFT_LIMIT_MS = 7000;
// If the worker has not answered shortly after its own deadline, something is wrong.
const WATCHDOG_MS = HARD_LIMIT_MS + 2000;

/**
 * The search bot (see src/engine/). It thinks in a Web Worker for up to 10 seconds per move,
 * usually 4 to 8 seconds, less when the move is forced or a mate is found.
 */
export function createDeepBot({ softMs = SOFT_LIMIT_MS, hardMs = HARD_LIMIT_MS } = {}) {
  let worker = null;
  let pending = null;

  const spawn = () =>
    new Worker(new URL('../engine/worker.js', import.meta.url), { type: 'module' });

  function cancel() {
    if (!pending) return;
    worker.terminate();
    worker = null;
    pending.resolve(null);
  }

  return {
    name: 'Deep bot',
    /** Stops a search nobody waits for any more, e.g. when a new game starts. */
    cancel,
    chooseAction(state) {
      cancel();
      worker ??= spawn();
      return new Promise((resolve) => {
        const finish = (action) => {
          clearTimeout(timer);
          pending = null;
          resolve(action);
        };
        const timer = setTimeout(() => {
          worker.terminate();
          worker = null;
          finish(legalActions(state)[0]);
        }, WATCHDOG_MS);
        pending = { resolve: finish };
        worker.onmessage = ({ data }) => finish(data.action);
        worker.postMessage({ state, softMs, hardMs });
      });
    },
  };
}
