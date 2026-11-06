import { describe, expect, it } from 'vitest';
import { rotateAction } from '../src/game/actions.js';
import { parseSquare, squareName } from '../src/game/board.js';
import { BLACK, WHITE } from '../src/game/pieces.js';
import { applyAction, legalActions, newGame } from '../src/game/rules.js';
import { createInitialState } from '../src/game/state.js';
import { chooseGreedyAction } from '../src/players/greedy.js';

const TYPES = { K: 'king', Q: 'queen', R: 'rook', B: 'bishop', N: 'knight', P: 'pawn' };

function position(pieces, turn = WHITE) {
  const board = new Array(64).fill(null);
  Object.entries(pieces).forEach(([square, code], id) => {
    board[parseSquare(square)] = {
      id,
      color: code[0] === 'w' ? WHITE : BLACK,
      type: TYPES[code[1]],
    };
  });
  return { ...createInitialState(), board, turn };
}

const describeMove = (a) =>
  a.type === 'move' ? `${squareName(a.from)}${squareName(a.to)}` : `rotate ${a.band}`;
const pick = (state, random) => describeMove(chooseGreedyAction(state, random));

describe('greedy bot', () => {
  it('takes the most valuable piece on offer', () => {
    const state = position({ a1: 'wK', h8: 'bK', d4: 'wN', c6: 'bP', e6: 'bR' });
    expect(pick(state)).toBe('d4e6');
  });

  it('does not grab a pawn if the capturing piece would then be lost', () => {
    // Queen takes b6 would be recaptured by the a7 pawn; the rook on a5 can take safely.
    const state = position({ h1: 'wK', h8: 'bK', d4: 'wQ', b6: 'bP', a7: 'bP', g5: 'bP' });
    expect(pick(state)).not.toBe('d4b6');
  });

  it('delivers checkmate when it can', () => {
    // Back-rank mate: no rotation can put a piece on the 8th rank, since that band holds the king.
    const state = position({ g1: 'wK', a1: 'wR', g8: 'bK', f7: 'bP', g7: 'bP', h7: 'bP' });
    const next = applyAction(state, chooseGreedyAction(state));
    expect(next.result).toMatchObject({ outcome: 'checkmate', winner: WHITE });
  });

  it('moves a threatened piece out of danger', () => {
    // The black pawn on c6 attacks the knight on d5; nothing can be captured.
    const state = position({ a1: 'wK', h8: 'bK', d5: 'wN', c6: 'bP' }, WHITE);
    const next = applyAction(state, chooseGreedyAction(state));
    expect(next.board[parseSquare('d5')]).toBeNull();
  });

  it('sets up a capture for next turn when none is available now', () => {
    const state = position({ a1: 'wK', h8: 'bK', b1: 'wR', e5: 'bN' });
    const next = applyAction(state, chooseGreedyAction(state));
    // Any move that leaves the knight under attack by the rook counts.
    const rook = next.board.findIndex((p) => p && p.type === 'rook');
    const rookSquare = squareName(rook);
    expect(rookSquare[0] === 'e' || rookSquare[1] === '5').toBe(true);
  });

  it('breaks ties at random among equally good actions', () => {
    // Kd2, Ke2 and Kf2 all leave the white pieces with 12 squares to go to.
    const state = position({ e1: 'wK', e8: 'bK', a2: 'wP', h2: 'wP' });
    const picks = new Set([0, 0.5, 0.99].map((r) => pick(state, () => r)));
    expect(picks).toEqual(new Set(['e1f2', 'e1e2', 'e1d2']));
  });

  it('only ever plays legal actions, including the no-undo rotation rule', () => {
    const state = applyAction(newGame(), rotateAction(1, 1));
    const action = chooseGreedyAction(state);
    expect(legalActions(state)).toContainEqual(action);
  });
});
