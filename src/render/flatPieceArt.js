import { BISHOP, KING, KNIGHT, PAWN, QUEEN, ROOK } from '../game/pieces.js';

// Drawn for this project in the style of printed chess diagrams, on a 45 × 45 grid.
// `fill` parts are body-coloured with an outline; `line` parts are outline-coloured strokes.
export const ART_SIZE = 45;
export const ART_BASELINE = 39;

const circle = (cx, cy, r) =>
  `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;

export const PIECE_ART = {
  [PAWN]: [
    {
      fill: 'M 11 39 L 34 39 C 34 32 30.5 28 26.5 26 C 28.3 25 29 24 29 22.6 C 29 21.4 28 20.6 26.5 20.6 L 18.5 20.6 C 17 20.6 16 21.4 16 22.6 C 16 24 16.7 25 18.5 26 C 14.5 28 11 32 11 39 Z',
    },
    { fill: circle(22.5, 15.2, 5.4) },
  ],
  [ROOK]: [
    { fill: 'M 9 39 L 36 39 L 36 35.5 L 9 35.5 Z' },
    { fill: 'M 11.5 35.5 L 12 31.5 L 33 31.5 L 33.5 35.5 Z' },
    { fill: 'M 14.5 31.5 L 15.5 17.5 L 29.5 17.5 L 30.5 31.5 Z' },
    {
      fill: 'M 12 17.5 L 12 8.5 L 16.5 8.5 L 16.5 12 L 20.3 12 L 20.3 8.5 L 24.7 8.5 L 24.7 12 L 28.5 12 L 28.5 8.5 L 33 8.5 L 33 17.5 Z',
    },
    { line: 'M 15 21 L 30 21 M 14.8 28 L 30.2 28' },
  ],
  [KNIGHT]: [
    {
      fill: 'M 13 39 L 37.5 39 C 38 29 37.5 20.5 33 15.5 C 32 14.5 31.3 13.8 30.8 13 L 30.5 7.5 L 27 11.2 C 21.5 11.5 16.5 15 13 20.5 L 8.8 26 C 7.6 27.8 8.6 30.6 11.8 30 L 17 28 C 19 27.6 21 26.4 22.5 24.8 C 22.5 29.5 17.5 32 15 35 Z',
    },
    { line: 'M 10.8 26.2 L 12.3 25.4' },
    { line: 'M 33.5 18.5 C 35.5 24 35.8 30 35.4 36.5' },
    { dot: [20, 17.3, 1.3] },
  ],
  [BISHOP]: [
    { fill: 'M 9 39 L 36 39 L 36 36 C 30 34.8 15 34.8 9 36 Z' },
    { fill: 'M 13 35.3 L 13.6 31.5 L 31.4 31.5 L 32 35.3 Z' },
    {
      fill: 'M 15.5 31.5 C 15 26.5 13 22 16.5 17 C 18.4 14.4 20.6 13 22.5 11.4 C 24.4 13 26.6 14.4 28.5 17 C 32 22 30 26.5 29.5 31.5 Z',
    },
    { fill: circle(22.5, 8.6, 2.8) },
    { line: 'M 26.4 17.4 L 20.4 23.6' },
  ],
  [QUEEN]: [
    { fill: 'M 9 39 L 36 39 L 36 35.5 C 30 34.2 15 34.2 9 35.5 Z' },
    {
      fill: 'M 11 35 C 11 33 10.5 31.8 10 30 L 8 15 L 14.8 25 L 15.6 11.5 L 20.2 24.4 L 22.5 10.5 L 24.8 24.4 L 29.4 11.5 L 30.2 25 L 37 15 L 35 30 C 34.5 31.8 34 33 34 35 Z',
    },
    { fill: circle(8, 13, 2.3) },
    { fill: circle(15.6, 9.6, 2.3) },
    { fill: circle(22.5, 8.5, 2.3) },
    { fill: circle(29.4, 9.6, 2.3) },
    { fill: circle(37, 13, 2.3) },
    { line: 'M 10.3 31 C 17 29.6 28 29.6 34.7 31' },
  ],
  [KING]: [
    { fill: 'M 9 39 L 36 39 L 36 35.5 C 30 34.2 15 34.2 9 35.5 Z' },
    {
      fill: 'M 11.5 35 L 11.2 32.2 C 5.5 27.5 5 20 11 18.3 C 15.5 17 19.5 19.8 22.5 23.5 C 25.5 19.8 29.5 17 34 18.3 C 40 20 39.5 27.5 33.8 32.2 L 33.5 35 Z',
    },
    { fill: 'M 22.5 24.5 C 19.5 21 18.6 16.8 22.5 13.6 C 26.4 16.8 25.5 21 22.5 24.5 Z' },
    {
      fill: 'M 21.3 3 L 23.7 3 L 23.7 6 L 26.5 6 L 26.5 8.4 L 23.7 8.4 L 23.7 13.4 L 21.3 13.4 L 21.3 8.4 L 18.5 8.4 L 18.5 6 L 21.3 6 Z',
    },
    { line: 'M 11.2 32.2 C 17.5 30 27.5 30 33.8 32.2' },
  ],
};

export const LINE_WIDTH = 1.5;

/** Draws one piece onto a 2D canvas context already scaled to the 45-unit grid. */
export function drawPieceArt(ctx, type, { body, outline }) {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = LINE_WIDTH;
  ctx.strokeStyle = outline;
  for (const part of PIECE_ART[type]) {
    if (part.fill) {
      const path = new Path2D(part.fill);
      ctx.fillStyle = body;
      ctx.fill(path);
      ctx.stroke(path);
    } else if (part.line) {
      ctx.stroke(new Path2D(part.line));
    } else if (part.dot) {
      const [x, y, r] = part.dot;
      ctx.fillStyle = outline;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
