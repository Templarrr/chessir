import { describe, expect, it } from 'vitest';
import { BAND_COUNT, bandOf, bandSquares, parseSquare, squareName } from '../src/game/board.js';

describe('board bands', () => {
  it('split the board into four rings of 28, 20, 12 and 4 squares', () => {
    const sizes = Array.from({ length: BAND_COUNT }, (_, band) => bandSquares(band).length);
    expect(sizes).toEqual([28, 20, 12, 4]);

    const all = Array.from({ length: BAND_COUNT }, (_, band) => bandSquares(band)).flat();
    expect(new Set(all).size).toBe(64);
  });

  it('assign every square to the band whose ring contains it', () => {
    for (let band = 0; band < BAND_COUNT; band++) {
      for (const square of bandSquares(band)) expect(bandOf(square)).toBe(band);
    }
  });

  it('put the corners on the outer band and the centre on the inner band', () => {
    expect(['a1', 'h1', 'a8', 'h8', 'd1', 'a5'].map((s) => bandOf(parseSquare(s)))).toEqual([
      0, 0, 0, 0, 0, 0,
    ]);
    expect(['d4', 'e4', 'd5', 'e5'].map((s) => bandOf(parseSquare(s)))).toEqual([3, 3, 3, 3]);
  });

  it('list the inner band clockwise from White’s view', () => {
    expect(bandSquares(3).map(squareName)).toEqual(['d5', 'e5', 'e4', 'd4']);
  });

  it('reject bands that do not exist', () => {
    expect(() => bandSquares(4)).toThrow();
    expect(() => bandSquares(-1)).toThrow();
  });
});

describe('square names', () => {
  it('round-trip between names and indexes', () => {
    for (const name of ['a1', 'h1', 'e4', 'a8', 'h8']) {
      expect(squareName(parseSquare(name))).toBe(name);
    }
  });

  it('reject squares off the board', () => {
    expect(() => parseSquare('i1')).toThrow();
    expect(() => parseSquare('a9')).toThrow();
  });
});
