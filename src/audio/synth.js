// Every sound is built from oscillators and noise at play time, so no audio files ship with the
// game. The functions take any BaseAudioContext, which lets an OfflineAudioContext render them
// to a file too.

const vary = (rand, amount) => 1 + (rand() * 2 - 1) * amount;

function noiseBuffer(ctx, seconds) {
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function envelope(ctx, out, t, peak, decay, attack = 0.002) {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  gain.connect(out);
  return gain;
}

function tone(ctx, out, t, { freq, peak, decay, type = 'sine', attack }) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  osc.connect(envelope(ctx, out, t, peak, decay, attack));
  osc.start(t);
  osc.stop(t + decay + 0.05);
}

/** One wooden piece set down on a wooden board. */
export function clack(ctx, out, t, rand = Math.random, { level = 1, pitch = 1 } = {}) {
  const p = pitch * vary(rand, 0.08);
  const l = level * vary(rand, 0.15);

  // The click of the contact: a short burst of noise filtered to the "woody" band.
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer(ctx, 0.08);
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 2200 * p;
  band.Q.value = 5;
  noise.connect(band).connect(envelope(ctx, out, t, 0.9 * l, 0.035, 0.001));
  noise.start(t);

  // The body of the piece ringing for a moment, and the board's thump underneath.
  tone(ctx, out, t, { freq: 820 * p, peak: 0.35 * l, decay: 0.06, attack: 0.001 });
  tone(ctx, out, t, { freq: 190 * p, peak: 0.3 * l, decay: 0.09, attack: 0.003 });
}

/** A piece knocking an enemy piece off: a harder hit, then the taken piece tumbling. */
export function captureClack(ctx, out, t, rand = Math.random) {
  clack(ctx, out, t, rand, { level: 1.25, pitch: 1.1 });
  clack(ctx, out, t + 0.07 + rand() * 0.02, rand, { level: 0.7, pitch: 0.85 });
  clack(ctx, out, t + 0.16 + rand() * 0.03, rand, { level: 0.3, pitch: 0.9 });
}

// Inharmonic partials, roughly those of a small bell, so the ring reads as metal not music.
const BELL = [1, 2.76, 5.4, 8.93];

/** The metal ring layered on top for check; `strong` is the deeper, longer one for mate. */
export function metalRing(ctx, out, t, rand = Math.random, { strong = false } = {}) {
  const base = (strong ? 520 : 1180) * vary(rand, 0.03);
  const level = strong ? 0.32 : 0.07;
  const decay = strong ? 2.2 : 0.7;
  BELL.forEach((ratio, i) => {
    const peak = level / (i + 1);
    const partialDecay = decay / (1 + i * 0.6);
    tone(ctx, out, t, { freq: base * ratio, peak, decay: partialDecay, attack: 0.003 });
    // A slightly detuned twin makes the partial beat like a real struck plate.
    if (strong) tone(ctx, out, t, { freq: base * ratio * 1.004, peak, decay: partialDecay });
  });
  if (strong) {
    // A second, lower strike a beat later makes mate land harder than check.
    const low = base * 0.5;
    BELL.slice(0, 3).forEach((ratio, i) =>
      tone(ctx, out, t + 0.18, { freq: low * ratio, peak: 0.22 / (i + 1), decay: 2.6 / (1 + i) }),
    );
  }
}

function reverb(ctx, out, seconds) {
  const ir = ctx.createBuffer(2, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const data = ir.getChannelData(c);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 3;
    }
  }
  const convolver = ctx.createConvolver();
  convolver.buffer = ir;
  const wet = ctx.createGain();
  wet.gain.value = 0.35;
  convolver.connect(wet).connect(out);
  return convolver;
}

/** A whole band turning: a scatter of clacks as its pieces land, with a room's echo. */
export function rotationRumble(ctx, out, t, rand = Math.random, { pieces = 8 } = {}) {
  const dry = ctx.createGain();
  dry.connect(out);
  dry.connect(reverb(ctx, out, 1.2));

  // The band sliding: low filtered noise swelling and fading under the clacks.
  const slide = ctx.createBufferSource();
  slide.buffer = noiseBuffer(ctx, 0.5);
  const low = ctx.createBiquadFilter();
  low.type = 'lowpass';
  low.frequency.value = 500;
  slide.connect(low).connect(envelope(ctx, dry, t - 0.25, 0.25, 0.4, 0.2));
  slide.start(t - 0.25);

  const count = Math.max(3, Math.min(pieces, 12));
  for (let i = 0; i < count; i++) {
    const at = t - 0.08 + rand() * 0.22;
    clack(ctx, dry, at, rand, { level: 0.55 + rand() * 0.25, pitch: 0.85 + rand() * 0.3 });
  }
}

/** How long, in seconds, a sound may keep playing after it starts. */
export const TAIL_SECONDS = 3.2;

/** Plays one turn's sound into `out`; `t` is when the pieces land (rotation starts earlier). */
export function playTurn(ctx, out, t, { body, ring, pieces }, rand = Math.random) {
  if (body === 'rotation') rotationRumble(ctx, out, t, rand, { pieces });
  else if (body === 'capture') captureClack(ctx, out, t, rand);
  else clack(ctx, out, t, rand);
  if (ring) metalRing(ctx, out, t + 0.02, rand, { strong: ring === 'checkmate' });
}
