import { describe, expect, it } from 'vitest';
import { moveAction, rotateAction } from '../src/game/actions.js';
import { parseSquare, squareName } from '../src/game/board.js';
import { BLACK, KING, PAWN, QUEEN, ROOK, WHITE } from '../src/game/pieces.js';
import {
  applyAction,
  inCheck,
  legalActions,
  legalMovesFrom,
  legalRotations,
  newGame,
  isDeadPosition,
  rotationBlockReason,
} from '../src/game/rules.js';
import { createInitialState } from '../src/game/state.js';

const TYPES = { K: 'king', Q: 'queen', R: 'rook', B: 'bishop', N: 'knight', P: 'pawn' };

// position({ e1: 'wK', e8: 'bK' }) builds a state with just those pieces.
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

const sq = parseSquare;
const targets = (state, from) => legalMovesFrom(state, sq(from)).map((m) => squareName(m.to));
const move = (state, from, to, promotion) =>
  applyAction(state, moveAction(sq(from), sq(to), promotion));
const at = (state, name) => state.board[sq(name)];

describe('piece movement', () => {
  it('gives White 20 piece moves at the start', () => {
    const moves = legalActions(newGame()).filter((a) => a.type === 'move');
    expect(moves).toHaveLength(20);
  });

  it('lets a pawn step one or two squares from its start and capture diagonally', () => {
    const state = position({ e1: 'wK', e8: 'bK', d2: 'wP', e3: 'bN' });
    expect(targets(state, 'd2').sort()).toEqual(['d3', 'd4', 'e3']);
  });

  it('blocks sliding pieces at the first piece in the way', () => {
    const state = position({ a1: 'wK', h8: 'bK', d4: 'wR', d6: 'bP', f4: 'wP' });
    expect(targets(state, 'd4').sort()).toEqual(
      ['d1', 'd2', 'd3', 'd5', 'd6', 'a4', 'b4', 'c4', 'e4'].sort(),
    );
  });

  it('lets knights jump over pieces', () => {
    expect(targets(newGame(), 'g1').sort()).toEqual(['f3', 'h3']);
  });

  it('switches turns and rejects moving out of turn', () => {
    const state = move(newGame(), 'e2', 'e4');
    expect(state.turn).toBe(BLACK);
    expect(() => move(state, 'd2', 'd4')).toThrow();
  });
});

describe('check', () => {
  it('forbids moves that leave the king in check', () => {
    const state = position({ e1: 'wK', e2: 'wB', e8: 'bR', a8: 'bK' });
    expect(targets(state, 'e2')).toEqual([]);
  });

  it('does not count fool’s mate, since White can rotate a pawn in between', () => {
    let state = newGame();
    for (const [from, to] of [
      ['f2', 'f3'],
      ['e7', 'e5'],
      ['g2', 'g4'],
      ['d8', 'h4'],
    ]) {
      state = move(state, from, to);
    }
    expect(inCheck(state)).toBe(true);
    expect(state.result).toBeNull();
    expect(legalActions(state)).toContainEqual(rotateAction(1, -1));
  });

  it('detects checkmate', () => {
    const state = move(position({ h8: 'bK', f6: 'wK', g1: 'wQ' }), 'g1', 'g7');
    expect(state.result).toMatchObject({ outcome: 'checkmate', winner: WHITE });
  });

  it('detects stalemate', () => {
    const state = move(position({ a1: 'bK', c2: 'wK', b5: 'wQ' }), 'b5', 'b3');
    expect(state.result).toMatchObject({ outcome: 'draw', reason: 'stalemate' });
  });
});

describe('special moves', () => {
  it('castles on both sides when the path is clear and safe', () => {
    const state = position({ e1: 'wK', a1: 'wR', h1: 'wR', e8: 'bK' });
    expect(targets(state, 'e1')).toEqual(expect.arrayContaining(['g1', 'c1']));

    const short = move(state, 'e1', 'g1');
    expect(at(short, 'g1').type).toBe(KING);
    expect(at(short, 'f1').type).toBe(ROOK);
    const long = move(state, 'e1', 'c1');
    expect(at(long, 'd1').type).toBe(ROOK);
  });

  it('does not castle through an attacked square', () => {
    const state = position({ e1: 'wK', h1: 'wR', e8: 'bK', f8: 'bR' });
    expect(targets(state, 'e1')).not.toContain('g1');
  });

  it('loses castling rights once the rook has been carried by a band rotation', () => {
    let state = position({ e1: 'wK', h1: 'wR', e8: 'bK', d5: 'bP' });
    state = applyAction(state, rotateAction(0, 1));
    state = move(state, 'd5', 'd4');
    state = applyAction(state, rotateAction(0, -1));
    state = move(state, 'd4', 'd3');
    expect(at(state, 'h1').type).toBe(ROOK);
    expect(targets(state, 'e1')).not.toContain('g1');
  });

  it('captures en passant only right after the double step', () => {
    let state = position({ e1: 'wK', e8: 'bK', e5: 'wP', d7: 'bP', h7: 'bP' }, BLACK);
    state = move(state, 'd7', 'd5');
    expect(targets(state, 'e5')).toContain('d6');
    const captured = move(state, 'e5', 'd6');
    expect(at(captured, 'd5')).toBeNull();
    expect(at(captured, 'd6').type).toBe(PAWN);

    const later = move(move(state, 'e1', 'e2'), 'h7', 'h6');
    expect(targets(later, 'e5')).not.toContain('d6');
  });

  it('promotes a pawn to the chosen piece', () => {
    const state = position({ a1: 'wK', h8: 'bK', b7: 'wP' });
    expect(legalMovesFrom(state, sq('b7'))).toHaveLength(4);
    expect(at(move(state, 'b7', 'b8', QUEEN), 'b8').type).toBe(QUEEN);
    expect(() => move(state, 'b7', 'b8')).toThrow();
  });
});

describe('band rotation as a move', () => {
  it('is offered for every band that has pieces, in both directions', () => {
    expect(legalRotations(newGame()).map((r) => r.band)).toEqual([0, 0, 1, 1]);
    const state = position({ a1: 'wK', h8: 'bK', d4: 'wP' });
    expect(legalRotations(state).map((r) => r.band)).toEqual([0, 0, 3, 3]);
  });

  it('carries every piece on the band and passes the turn', () => {
    const state = applyAction(newGame(), rotateAction(0, 1));
    expect(at(state, 'a2').type).toBe(ROOK);
    expect(state.turn).toBe(BLACK);
  });

  it('may not expose the own king', () => {
    // The b2 knight on band 1 shields the a1 king from the queen on the long diagonal.
    const state = position({ a1: 'wK', b2: 'wN', h8: 'bK', e5: 'bQ' });
    expect(rotationBlockReason(state, 1, 1)).toMatch(/expose/);
  });

  it('may not turn the same band straight back after the opponent rotated it', () => {
    const state = applyAction(newGame(), rotateAction(1, 1));
    expect(rotationBlockReason(state, 1, -1)).toMatch(/before the last move/);
    expect(() => applyAction(state, rotateAction(1, -1))).toThrow();
    expect(rotationBlockReason(state, 1, 1)).toBeNull();
    expect(rotationBlockReason(state, 0, -1)).toBeNull();
    const later = move(state, 'g8', 'f6');
    expect(rotationBlockReason(later, 1, -1)).toBeNull();
  });

  it('may only rotate a band that holds at least one of the own pieces', () => {
    // After a1-a2 the white rook is alone on the outer band, so Black may not turn it.
    const state = move(position({ a1: 'wR', d3: 'wK', e6: 'bK' }), 'a1', 'a2');
    expect(rotationBlockReason(state, 0, -1)).toMatch(/none of your pieces/);
    expect(rotationBlockReason(state, 0, 1)).toMatch(/none of your pieces/);
    expect(legalRotations(state).map((r) => r.band)).toEqual([2, 2]);
  });

  it('allows rotations that cannot restore the old board', () => {
    // Two squares up the band is out of reach of a one-square turn.
    const state = move(position({ a1: 'wR', d3: 'wK', h8: 'bK' }), 'a1', 'a3');
    expect(rotationBlockReason(state, 0, -1)).toBeNull();
  });

  describe('while in check', () => {
    // Black rook on e8 checks the white king on e1 along the e-file.
    const state = position({ e1: 'wK', e8: 'bR', a8: 'bK', c4: 'wB', f6: 'wN' });

    it('locks the bands holding the king and the checking piece', () => {
      expect(inCheck(state)).toBe(true);
      expect(rotationBlockReason(state, 0, 1)).toMatch(/In check/);
    });

    it('allows rotating another band to put a piece in between', () => {
      // Turning band 2 counter-clockwise carries the f6 knight to e6.
      expect(rotationBlockReason(state, 2, -1)).toBeNull();
      const next = applyAction(state, rotateAction(2, -1));
      expect(at(next, 'e6').type).toBe('knight');
      expect(inCheck(next, WHITE)).toBe(false);
    });

    it('rejects rotations that do not end the check', () => {
      expect(rotationBlockReason(state, 2, 1)).toMatch(/does not stop/);
    });
  });
});

describe('draws', () => {
  it('declares a draw on threefold repetition', () => {
    let state = newGame();
    const shuffle = [
      ['g1', 'f3'],
      ['g8', 'f6'],
      ['f3', 'g1'],
      ['f6', 'g8'],
    ];
    for (const [from, to] of [...shuffle, ...shuffle]) state = move(state, from, to);
    expect(state.result).toMatchObject({ outcome: 'draw', reason: 'threefold repetition' });
  });
});

describe('insufficient material', () => {
  const dead = (pieces, mode) => isDeadPosition(position(pieces).board, mode);

  it('is a draw with a lone minor piece in both modes', () => {
    for (const mode of ['normal', 'roundabout']) {
      expect(dead({ e1: 'wK', e8: 'bK' }, mode)).toBe(true);
      expect(dead({ e1: 'wK', e8: 'bK', c1: 'wB' }, mode)).toBe(true);
      expect(dead({ e1: 'wK', e8: 'bK', g8: 'bN' }, mode)).toBe(true);
      expect(dead({ e1: 'wK', e8: 'bK', a2: 'wP' }, mode)).toBe(false);
      expect(dead({ e1: 'wK', e8: 'bK', a1: 'wR' }, mode)).toBe(false);
      expect(dead({ e1: 'wK', e8: 'bK', c1: 'wB', g8: 'bN' }, mode)).toBe(false);
    }
  });

  it('is a draw with same-coloured bishops only in normal mode', () => {
    const light = { e1: 'wK', e8: 'bK', f1: 'wB', c8: 'bB' };
    const opposite = { e1: 'wK', e8: 'bK', c1: 'wB', c8: 'bB' };
    expect(dead(light, 'normal')).toBe(true);
    expect(dead({ ...light, d3: 'wB' }, 'normal')).toBe(true);
    expect(dead(opposite, 'normal')).toBe(false);
    expect(dead(light, 'roundabout')).toBe(false);
  });

  it('allows mate with opposite-coloured bishops, which rotations can bring about', () => {
    const state = move(position({ f7: 'wK', a1: 'wB', h8: 'bK', h7: 'bB' }), 'a1', 'd4');
    expect(state.result).toMatchObject({ outcome: 'checkmate', winner: WHITE });
  });

  it('ends the game when a capture leaves too little to mate', () => {
    const state = move(position({ e1: 'wK', d1: 'wN', h8: 'bK', e3: 'bR' }), 'd1', 'e3');
    expect(state.result).toMatchObject({ outcome: 'draw', reason: 'insufficient material' });
  });

  it('ends a normal game at same-coloured bishops but keeps a roundabout one going', () => {
    const pieces = { e1: 'wK', f1: 'wB', e2: 'bN', e8: 'bK', c8: 'bB' };
    const normal = move(position(pieces, WHITE, { mode: 'normal' }), 'e1', 'e2');
    expect(normal.result).toMatchObject({ outcome: 'draw', reason: 'insufficient material' });
    expect(move(position(pieces), 'e1', 'e2').result).toBeNull();
  });
});

describe('game modes', () => {
  it('starts in roundabout mode, where bands turn', () => {
    const state = newGame();
    expect(state.mode).toBe('roundabout');
    expect(legalRotations(state).length).toBeGreaterThan(0);
  });

  it('allows no rotations in normal mode', () => {
    const state = newGame({ mode: 'normal' });
    expect(legalActions(state)).toHaveLength(20);
    expect(rotationBlockReason(state, 0, 1)).toBe('Bands do not turn in normal mode');
    expect(() => applyAction(state, rotateAction(0, 1))).toThrow();
  });

  it('keeps the mode for the whole game', () => {
    const state = applyAction(newGame({ mode: 'normal' }), moveAction(sq('e2'), sq('e4')));
    expect(state.mode).toBe('normal');
    expect(legalRotations(state)).toEqual([]);
  });
});
