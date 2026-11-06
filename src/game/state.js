import { BOARD_SIZE, bandSquares, squareIndex } from './board.js';
import { BACK_RANK, BLACK, PAWN, WHITE } from './pieces.js';

/**
 * State is treated as immutable so that a future AI can explore positions without
 * copying or undoing anything. Pieces carry stable ids so the renderer can follow
 * them when a band rotation moves many pieces at once.
 */
export function createInitialState() {
  const board = new Array(BOARD_SIZE * BOARD_SIZE).fill(null);
  let nextId = 0;
  const place = (file, rank, type, color) => {
    board[squareIndex(file, rank)] = { id: nextId++, type, color };
  };

  for (let file = 0; file < BOARD_SIZE; file++) {
    place(file, 0, BACK_RANK[file], WHITE);
    place(file, 1, PAWN, WHITE);
    place(file, 6, PAWN, BLACK);
    place(file, 7, BACK_RANK[file], BLACK);
  }

  return Object.freeze({
    board: Object.freeze(board),
    turn: WHITE,
    // Square a pawn just skipped with its double step, capturable en passant this turn.
    enPassant: null,
    // Ids of pieces that ever left their square, by move or rotation; used for castling.
    moved: Object.freeze([]),
    halfmoveClock: 0,
    positions: {},
    lastAction: null,
    result: null,
  });
}

export function pieceAt(state, index) {
  return state.board[index];
}

/** Returns a new board with every piece on the band shifted one square (1 = clockwise). */
export function rotateBand(board, band, direction) {
  if (direction !== 1 && direction !== -1) {
    throw new Error(`Invalid direction: ${direction}`);
  }
  const ring = bandSquares(band);
  const next = board.slice();
  ring.forEach((square, i) => {
    const target = ring[(i + direction + ring.length) % ring.length];
    next[target] = board[square];
  });
  return Object.freeze(next);
}
