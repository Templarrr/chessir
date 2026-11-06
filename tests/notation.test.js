import { describe, expect, it } from 'vitest';
import { moveAction, rotateAction } from '../src/game/actions.js';
import { parseSquare } from '../src/game/board.js';
import { BLACK, WHITE } from '../src/game/pieces.js';
import { applyAction, newGame } from '../src/game/rules.js';
import { createInitialState } from '../src/game/state.js';
import { formatMovetext, notate } from '../src/game/notation.js';

const TYPES = { K: 'king', Q: 'queen', R: 'rook', B: 'bishop', N: 'knight', P: 'pawn' };

function position(pieces, turn = WHITE, extra = {}) {
  const board = new Array(64).fill(null);
  Object.entries(pieces).forEach(([square, code], id) => {
    board[parseSquare(square)] = {
      id,
      color: code[0] === 'w' ? WHITE : BLACK,
      type: TYPES[code[1]],
    };
  });
  return { ...createInitialState(), board, turn, ...extra };
}

const mv = (from, to, promotion) => moveAction(parseSquare(from), parseSquare(to), promotion);

function sans(state, actions) {
  const out = [];
  for (const action of actions) {
    out.push(notate(state, action));
    state = applyAction(state, action);
  }
  return out;
}

describe('move notation', () => {
  it('writes ordinary moves and captures in standard algebraic notation', () => {
    const moves = [mv('e2', 'e4'), mv('d7', 'd5'), mv('e4', 'd5'), mv('d8', 'd5'), mv('b1', 'c3')];
    expect(sans(newGame(), moves)).toEqual(['e4', 'd5', 'exd5', 'Qxd5', 'Nc3']);
  });

  it('names band rotations by letter and direction', () => {
    expect(notate(newGame(), rotateAction(0, 1))).toBe('A+');
    expect(notate(newGame(), rotateAction(1, -1))).toBe('B-');
    const centre = position({ a1: 'wK', h8: 'bK', d4: 'wP' });
    expect(notate(centre, rotateAction(3, 1))).toBe('D+');
  });

  it('turns A+ the a-file pieces toward higher ranks', () => {
    const next = applyAction(newGame(), rotateAction(0, 1));
    expect(next.board[parseSquare('a2')]).toMatchObject({ type: 'rook', color: WHITE });
  });

  it('marks check and checkmate, also on rotations', () => {
    const state = position({ e1: 'wK', a2: 'wR', h8: 'bK', g7: 'bP', h7: 'bP' });
    expect(notate(state, mv('a2', 'a8'))).toBe('Ra8#');
    // The rook rides the outer band from a6 to a7, checking the king on c7.
    const toCheck = position({ d3: 'wK', a6: 'wR', c7: 'bK' });
    expect(notate(toCheck, rotateAction(0, 1))).toBe('A++');
  });

  it('writes castling, promotion and en passant', () => {
    const castle = position({ e1: 'wK', h1: 'wR', a1: 'wR', e8: 'bK' });
    expect(notate(castle, mv('e1', 'g1'))).toBe('O-O');
    expect(notate(castle, mv('e1', 'c1'))).toBe('O-O-O');
    const promote = position({ a1: 'wK', b7: 'wP', h1: 'bK', c8: 'bN' });
    expect(notate(promote, mv('b7', 'c8', 'queen'))).toBe('bxc8=Q');
    const ep = position({ a1: 'wK', e5: 'wP', d5: 'bP', h8: 'bK' }, WHITE, {
      enPassant: parseSquare('d6'),
    });
    expect(notate(ep, mv('e5', 'd6'))).toBe('exd6');
  });

  it('adds the file or rank when two pieces of a kind can reach the square', () => {
    const files = position({ a1: 'wK', b1: 'wN', f1: 'wN', h8: 'bK' });
    expect(notate(files, mv('b1', 'd2'))).toBe('Nbd2');
    const ranks = position({ h1: 'wK', a1: 'wR', a5: 'wR', h8: 'bK' });
    expect(notate(ranks, mv('a1', 'a3'))).toBe('R1a3');
  });

  it('numbers the moves and appends the result', () => {
    expect(formatMovetext(['e4', 'e5', 'A+'], null)).toBe('1. e4 e5 2. A+');
    const mate = { outcome: 'checkmate', winner: BLACK };
    expect(formatMovetext(['f3', 'e5', 'g4', 'Qh4#'], mate)).toBe('1. f3 e5 2. g4 Qh4# 0-1');
    expect(formatMovetext([], { outcome: 'draw' })).toBe('1/2-1/2');
  });
});
