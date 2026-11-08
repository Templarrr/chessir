import { playTurn } from './synth.js';

const STORAGE_KEY = 'chessir.sound.muted';

function savedMuted() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Plays turn sounds; `landDelay` lines the clack up with the end of the piece animation. */
export function createSoundPlayer({ landDelay = 0.3 } = {}) {
  let ctx = null;
  let out = null;
  let muted = savedMuted();

  // Browsers only let a page start audio after the user interacts with it, so the context is
  // created (or resumed) on the first tap or key press.
  function unlock() {
    if (!ctx) {
      const Context = window.AudioContext ?? window.webkitAudioContext;
      if (!Context) return;
      ctx = new Context();
      // Overlapping layers (mate on a capture) could clip; the compressor keeps them clean.
      const compressor = ctx.createDynamicsCompressor();
      compressor.connect(ctx.destination);
      out = ctx.createGain();
      out.gain.value = 0.8;
      out.connect(compressor);
    }
    if (ctx.state === 'suspended') ctx.resume();
  }
  for (const event of ['pointerdown', 'keydown']) {
    window.addEventListener(event, unlock, { capture: true });
  }

  return {
    get muted() {
      return muted;
    },
    setMuted(value) {
      muted = value;
      try {
        localStorage.setItem(STORAGE_KEY, muted ? '1' : '0');
      } catch {
        // Not remembering the choice is fine.
      }
    },
    play(sound) {
      if (muted || !ctx || ctx.state !== 'running') return;
      playTurn(ctx, out, ctx.currentTime + landDelay, sound);
    },
  };
}
