import { BISHOP, PIECE_VALUES, WHITE } from './pieces.js';

/** Pieces on `before` that are gone from `after`, as they stood before the capture. */
export function capturedPieces(before, after) {
  const remaining = new Set(after.filter(Boolean).map((p) => p.id));
  return before.filter((p) => p && !remaining.has(p.id));
}

// Most valuable first; a bishop goes ahead of a knight, as it is usually worth a bit more.
export function sortByValue(pieces) {
  const rank = (p) => PIECE_VALUES[p.type] * 2 + (p.type === BISHOP ? 1 : 0);
  return [...pieces].sort((a, b) => rank(b) - rank(a));
}

/** White's material minus Black's; promotions count, so it can differ from the captures. */
export function materialBalance(board) {
  return board.reduce((sum, p) => {
    if (!p) return sum;
    return sum + (p.color === WHITE ? 1 : -1) * PIECE_VALUES[p.type];
  }, 0);
}
