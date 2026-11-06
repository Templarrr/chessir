import { describe, expect, it } from 'vitest';
import { parseSquare } from '../src/game/board.js';
import { BLACK, KING, PAWN, QUEEN, ROOK, WHITE } from '../src/game/pieces.js';
import { createInitialState, pieceAt, rotateBand } from '../src/game/state.js';

const at = (state, name) => pieceAt(state, parseSquare(name));
const pieces = (board) => board.filter(Boolean);

describe('initial position', () => {
  const state = createInitialState();

  it('starts with White to move and 16 pieces per side', () => {
    expect(state.turn).toBe(WHITE);
    expect(pieces(state.board).filter((p) => p.color === WHITE)).toHaveLength(16);
    expect(pieces(state.board).filter((p) => p.color === BLACK)).toHaveLength(16);
  });

  it('places pieces on their classic squares', () => {
    expect(at(state, 'e1')).toMatchObject({ type: KING, color: WHITE });
    expect(at(state, 'd1')).toMatchObject({ type: QUEEN, color: WHITE });
    expect(at(state, 'e8')).toMatchObject({ type: KING, color: BLACK });
    expect(at(state, 'a8')).toMatchObject({ type: ROOK, color: BLACK });
    expect(at(state, 'c2')).toMatchObject({ type: PAWN, color: WHITE });
    expect(at(state, 'f7')).toMatchObject({ type: PAWN, color: BLACK });
    expect(at(state, 'e4')).toBeNull();
  });

  it('gives every piece a unique id', () => {
    const ids = pieces(state.board).map((p) => p.id);
    expect(new Set(ids).size).toBe(32);
  });
});

describe('band rotation', () => {
  const state = createInitialState();

  it('moves outer band pieces one square clockwise', () => {
    const board = rotateBand(state.board, 0, 1);
    const rotated = { ...state, board };
    // a1 rook moves up the a-file, a8 rook moves along the 8th rank.
    expect(at(rotated, 'a2')).toBe(at(state, 'a1'));
    expect(at(rotated, 'b8')).toBe(at(state, 'a8'));
    expect(at(rotated, 'h7')).toBe(at(state, 'h8'));
    expect(at(rotated, 'g1')).toBe(at(state, 'h1'));
  });

  it('leaves other bands untouched', () => {
    const board = rotateBand(state.board, 0, 1);
    expect(at({ board }, 'c2')).toBe(at(state, 'c2'));
    expect(at({ board }, 'f7')).toBe(at(state, 'f7'));
  });

  it('keeps every piece on the board', () => {
    const board = rotateBand(rotateBand(state.board, 1, -1), 0, 1);
    expect(pieces(board)).toHaveLength(32);
  });

  it('is undone by rotating back', () => {
    const board = rotateBand(rotateBand(state.board, 1, 1), 1, -1);
    expect(board).toEqual(state.board);
  });

  it('does not modify the original state', () => {
    const before = state.board.slice();
    rotateBand(state.board, 0, 1);
    expect(state.board).toEqual(before);
  });

  it('rejects an invalid direction', () => {
    expect(() => rotateBand(state.board, 0, 2)).toThrow();
  });
});
