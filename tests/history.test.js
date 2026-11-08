import { describe, expect, it } from 'vitest';
import { moveAction } from '../src/game/actions.js';
import { parseSquare } from '../src/game/board.js';
import { movesOf, recordAction, startHistory, truncateHistory } from '../src/game/history.js';
import { newGame } from '../src/game/rules.js';

const mv = (from, to) => moveAction(parseSquare(from), parseSquare(to));

function play(...actions) {
  return actions.reduce(recordAction, startHistory(newGame()));
}

describe('game history', () => {
  it('keeps every position with its notation and captures', () => {
    const history = play(mv('e2', 'e4'), mv('d7', 'd5'), mv('e4', 'd5'));
    expect(history).toHaveLength(4);
    expect(movesOf(history)).toEqual(['e4', 'd5', 'exd5']);
    expect(history[2].captured.white).toEqual([]);
    expect(history[3].captured.white.map((p) => p.type)).toEqual(['pawn']);
    expect(history[3].state.turn).toBe('black');
  });

  it('resets to an earlier position and plays on from there', () => {
    const history = play(mv('e2', 'e4'), mv('d7', 'd5'), mv('e4', 'd5'));
    const reset = truncateHistory(history, 1);
    expect(movesOf(reset)).toEqual(['e4']);
    expect(reset[1].state).toBe(history[1].state);
    const replayed = recordAction(reset, mv('e7', 'e5'));
    expect(movesOf(replayed)).toEqual(['e4', 'e5']);
    expect(replayed[2].captured).toEqual({ white: [], black: [] });
  });
});
