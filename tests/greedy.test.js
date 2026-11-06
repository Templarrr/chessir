import { describe, expect, it } from 'vitest';
import { moveAction, rotateAction } from '../src/game/actions.js';
import { parseSquare, squareName } from '../src/game/board.js';
import { BLACK, WHITE } from '../src/game/pieces.js';
import { applyAction, legalActions, newGame } from '../src/game/rules.js';
import { createInitialState } from '../src/game/state.js';
import { chooseGreedyAction, scoreAction } from '../src/players/greedy.js';

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

const knightShuffle = ['g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1'];
function play(state, moves) {
  return moves.reduce(
    (s, m) => applyAction(s, moveAction(parseSquare(m.slice(0, 2)), parseSquare(m.slice(2)))),
    state,
  );
}

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
    // a4 and h4 advance a pawn equally far and leave the same number of moves.
    const state = position({ e1: 'wK', e8: 'bK', a2: 'wP', h2: 'wP' });
    const picks = new Set([0, 0.99].map((r) => pick(state, () => r)));
    expect(picks).toEqual(new Set(['a2a4', 'h2h4']));
  });

  it('pushes its most advanced pawn toward promotion when nothing else is going on', () => {
    // b5-b6, or turning the band that carries b5 up to b6, beats a g-pawn step.
    const state = position({ h1: 'wK', a8: 'bK', b5: 'wP', g2: 'wP' });
    const next = applyAction(state, chooseGreedyAction(state));
    expect(next.board[parseSquare('b6')]?.type).toBe('pawn');
  });

  it('does not push a pawn where it would just be taken', () => {
    // b6 is covered by the a7 pawn; the g-pawn can advance safely instead.
    const state = position({ h1: 'wK', a8: 'bK', b5: 'wP', g2: 'wP', a7: 'bP' });
    const next = applyAction(state, chooseGreedyAction(state));
    expect(next.board[parseSquare('b6')]).toBeNull();
    expect(next.board[parseSquare('g4')]?.type).toBe('pawn');
  });

  it('only ever plays legal actions, including the no-undo rotation rule', () => {
    const state = applyAction(newGame(), rotateAction(1, 1));
    const action = chooseGreedyAction(state);
    expect(legalActions(state)).toContainEqual(action);
  });

  it('avoids a threefold repetition draw when not behind', () => {
    // Nf6-g8 now would bring back the start position for the third time.
    const state = play(newGame(), knightShuffle);
    const back = moveAction(parseSquare('f6'), parseSquare('g8'));
    expect(applyAction(state, back).result?.reason).toBe('threefold repetition');
    expect(scoreAction(state, back)[0]).toBeLessThan(0);
    expect(chooseGreedyAction(state)).not.toEqual(back);
  });

  it('does not mind a repetition draw when behind on material', () => {
    // White is a rook down; Ng1-f3 now would repeat the position after White's first move twice.
    const start = createInitialState();
    const board = start.board.slice();
    board[parseSquare('a1')] = null;
    const state = play({ ...start, board }, [...knightShuffle, 'f6g8']);
    const out = moveAction(parseSquare('g1'), parseSquare('f3'));
    expect(applyAction(state, out).result?.reason).toBe('threefold repetition');
    expect(scoreAction(state, out)[0]).toBeGreaterThanOrEqual(0);
  });
});
