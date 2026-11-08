import { describe, expect, it } from 'vitest';
import { parseSquare } from '../src/game/board.js';
import { BLACK, WHITE } from '../src/game/pieces.js';
import { applyAction, isDeadPosition, legalActions, newGame } from '../src/game/rules.js';
import { createInitialState } from '../src/game/state.js';
import { createSearcher } from '../src/engine/search.js';
import { Position, historyKey, moveToAction } from '../src/engine/position.js';

const describeAction = (a) =>
  a.type === 'rotate'
    ? `r${a.band}${a.direction}`
    : `${a.from}-${a.to}${a.promotion ? `=${a.promotion}` : ''}`;

function seeded(seed) {
  return () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
}

function randomGames(count, plies, seed, check, options) {
  const random = seeded(seed);
  for (let g = 0; g < count; g++) {
    let state = newGame(options);
    for (let ply = 0; ply < plies && !state.result; ply++) {
      check(state);
      const actions = legalActions(state);
      const pick = actions[Math.floor(random() * actions.length)];
      state = applyAction(state, pick);
    }
  }
}

describe('engine position', () => {
  it('generates exactly the legal actions of the rules on random games', () => {
    randomGames(30, 120, 7, (state) => {
      const pos = Position.fromState(state);
      const mine = pos.legalMoves().map(moveToAction).map(describeAction).sort();
      const theirs = legalActions(state).map(describeAction).sort();
      expect(mine).toEqual(theirs);
    });
  }, 60000);

  it('generates no rotations in normal mode, matching the rules', () => {
    randomGames(
      10,
      80,
      5,
      (state) => {
        const mine = Position.fromState(state).legalMoves().map(moveToAction);
        expect(mine.some((a) => a.type === 'rotate')).toBe(false);
        expect(mine.map(describeAction).sort()).toEqual(
          legalActions(state).map(describeAction).sort(),
        );
      },
      { mode: 'normal' },
    );
  }, 60000);

  it('keeps the incremental hash and the board in step through make and unmake', () => {
    randomGames(4, 100, 11, (state) => {
      const pos = Position.fromState(state);
      const board = pos.board.slice();
      const hash = [pos.hashLo, pos.hashHi];
      for (const m of pos.legalMoves()) {
        pos.make(m);
        const next = Position.fromState(applyAction(state, moveToAction(m)));
        expect([pos.hashLo, pos.hashHi]).toEqual([next.hashLo, next.hashHi]);
        expect(Array.from(pos.board)).toEqual(Array.from(next.board));
        expect(pos.castling).toBe(next.castling);
        pos.unmake();
      }
      expect(Array.from(pos.board)).toEqual(Array.from(board));
      expect([pos.hashLo, pos.hashHi]).toEqual(hash);
    });
  }, 60000);

  it('reads the game history with the same hash', () => {
    randomGames(5, 60, 3, (state) => {
      const pos = Position.fromState(state);
      expect(pos.history.get(historyKey(pos.hashLo, pos.hashHi))).toBeGreaterThan(0);
    });
  });
});

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
  return withHistory({ ...createInitialState(), board, turn, moved: [...Array(64).keys()] });
}

const withHistory = (state) => ({ ...state, positions: {} });

function best(state, ms = 300) {
  const searcher = createSearcher({ ttBits: 16 });
  return moveToAction(searcher.think(Position.fromState(state), { softMs: ms, hardMs: ms }).move);
}

describe('engine insufficient material', () => {
  it('agrees with the rules on which positions are dead', () => {
    const cases = [
      { e1: 'wK', e8: 'bK' },
      { e1: 'wK', e8: 'bK', c1: 'wB' },
      { e1: 'wK', e8: 'bK', g8: 'bN' },
      { e1: 'wK', e8: 'bK', f1: 'wB', c8: 'bB' },
      { e1: 'wK', e8: 'bK', f1: 'wB', c8: 'bB', d3: 'wB' },
      { e1: 'wK', e8: 'bK', c1: 'wB', c8: 'bB' },
      { e1: 'wK', e8: 'bK', c1: 'wB', g8: 'bN' },
      { e1: 'wK', e8: 'bK', a1: 'wR' },
      { e1: 'wK', e8: 'bK', a2: 'wP' },
    ];
    for (const mode of ['normal', 'roundabout']) {
      for (const pieces of cases) {
        const state = { ...position(pieces), mode };
        expect(Position.fromState(state).isDead(), JSON.stringify({ mode, pieces })).toBe(
          isDeadPosition(state.board, mode),
        );
      }
    }
  });
});

describe('engine search', () => {
  it('mates in one', () => {
    const state = position({ g1: 'wK', a7: 'wR', b2: 'wR', h8: 'bK' });
    const next = applyAction(state, best(state));
    expect(next.result?.outcome).toBe('checkmate');
  });

  it('plays a move, not a rotation, in normal mode', () => {
    let state = newGame({ mode: 'normal' });
    for (let ply = 0; ply < 6; ply++) {
      const action = best(state, 100);
      expect(action.type).toBe('move');
      state = applyAction(state, action);
    }
  });

  it('wins a hanging queen', () => {
    const state = position({ a1: 'wK', h8: 'bK', d4: 'wN', e6: 'bQ', a7: 'bP' });
    expect(best(state)).toEqual({ type: 'move', from: parseSquare('d4'), to: parseSquare('e6') });
  });
});
