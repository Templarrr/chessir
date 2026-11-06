export const BOARD_SIZE = 8;
export const BAND_COUNT = BOARD_SIZE / 2;
export const FILES = 'abcdefgh';

export function squareIndex(file, rank) {
  return rank * BOARD_SIZE + file;
}

export function squareCoords(index) {
  return { file: index % BOARD_SIZE, rank: Math.floor(index / BOARD_SIZE) };
}

export function squareName(index) {
  const { file, rank } = squareCoords(index);
  return `${FILES[file]}${rank + 1}`;
}

export function parseSquare(name) {
  const file = FILES.indexOf(name[0]);
  const rank = Number(name.slice(1)) - 1;
  if (file < 0 || !Number.isInteger(rank) || rank < 0 || rank >= BOARD_SIZE) {
    throw new Error(`Invalid square: ${name}`);
  }
  return squareIndex(file, rank);
}

/** Band 0 is the outer ring, band 3 the four central squares. */
export function bandOf(index) {
  const { file, rank } = squareCoords(index);
  const last = BOARD_SIZE - 1;
  return Math.min(file, rank, last - file, last - rank);
}

/**
 * Squares of a band in clockwise order as seen from White's side, starting at the
 * band's top-left corner. Rotating a band shifts pieces one step along this ring.
 */
export function bandSquares(band) {
  if (!Number.isInteger(band) || band < 0 || band >= BAND_COUNT) {
    throw new Error(`Invalid band: ${band}`);
  }
  const lo = band;
  const hi = BOARD_SIZE - 1 - band;
  const ring = [];
  for (let f = lo; f < hi; f++) ring.push(squareIndex(f, hi));
  for (let r = hi; r > lo; r--) ring.push(squareIndex(hi, r));
  for (let f = hi; f > lo; f--) ring.push(squareIndex(f, lo));
  for (let r = lo; r < hi; r++) ring.push(squareIndex(lo, r));
  return ring;
}
