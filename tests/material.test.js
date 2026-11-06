import { describe, expect, it } from 'vitest';
import { parseSquare } from '../src/game/board.js';
import { capturedPieces, materialBalance, sortByValue } from '../src/game/material.js';
import { BISHOP, BLACK, KNIGHT, PAWN, QUEEN, ROOK, WHITE } from '../src/game/pieces.js';
import { createInitialState } from '../src/game/state.js';

const piece = (id, type, color = BLACK) => ({ id, type, color });

describe('captured pieces', () => {
  it('lists pieces that left the board, as they were before', () => {
    const before = createInitialState().board;
    const after = before.slice();
    const queen = after[parseSquare('d8')];
    after[parseSquare('d8')] = after[parseSquare('d1')];
    after[parseSquare('d1')] = null;
    expect(capturedPieces(before, after)).toEqual([queen]);
  });

  it('finds nothing when pieces only moved', () => {
    const before = createInitialState().board;
    expect(capturedPieces(before, before.slice().reverse())).toEqual([]);
  });

  it('sorts most valuable first, bishops ahead of knights', () => {
    const pieces = [
      piece(1, PAWN),
      piece(2, KNIGHT),
      piece(3, QUEEN),
      piece(4, BISHOP),
      piece(5, ROOK),
    ];
    expect(sortByValue(pieces).map((p) => p.type)).toEqual([QUEEN, ROOK, BISHOP, KNIGHT, PAWN]);
  });
});

describe('material balance', () => {
  it('is even at the start', () => {
    expect(materialBalance(createInitialState().board)).toBe(0);
  });

  it('counts White ahead as positive and Black ahead as negative', () => {
    const board = createInitialState().board.slice();
    board[parseSquare('a8')] = null;
    expect(materialBalance(board)).toBe(5);
    board[parseSquare('d1')] = null;
    board[parseSquare('e3')] = piece(99, QUEEN, WHITE);
    expect(materialBalance(board)).toBe(5);
    board[parseSquare('e3')] = null;
    expect(materialBalance(board)).toBe(-4);
  });
});
