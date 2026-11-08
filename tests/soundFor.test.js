import { describe, expect, it } from 'vitest';
import { moveAction, rotateAction } from '../src/game/actions.js';
import { parseSquare } from '../src/game/board.js';
import { BLACK, KING, QUEEN, WHITE } from '../src/game/pieces.js';
import { applyAction, newGame } from '../src/game/rules.js';
import { createInitialState } from '../src/game/state.js';
import { soundFor } from '../src/audio/soundFor.js';

function play(moves, state = newGame()) {
  let sound;
  for (const m of moves) {
    const action = typeof m === 'string' ? moveAction(...m.split('-').map(parseSquare)) : m;
    const next = applyAction(state, action);
    sound = soundFor(state, action, next);
    state = next;
  }
  return sound;
}

describe('turn sounds', () => {
  it('plays a plain move', () => {
    expect(play(['e2-e4'])).toEqual({ body: 'move', ring: null, pieces: 1 });
  });

  it('plays a capture', () => {
    expect(play(['e2-e4', 'd7-d5', 'e4-d5']).body).toBe('capture');
  });

  it('adds a ring for check and a strong one for mate', () => {
    expect(play(['e2-e4', 'f7-f6', 'd1-h5']).ring).toBe('check');

    const board = new Array(64).fill(null);
    board[parseSquare('h8')] = { id: 0, color: BLACK, type: KING };
    board[parseSquare('f6')] = { id: 1, color: WHITE, type: KING };
    board[parseSquare('g1')] = { id: 2, color: WHITE, type: QUEEN };
    expect(play(['g1-g7'], { ...createInitialState(), board }).ring).toBe('checkmate');
  });

  it('plays a rotation with the number of pieces on the band', () => {
    expect(play([rotateAction(0, 1)])).toEqual({ body: 'rotation', ring: null, pieces: 20 });
  });
});
