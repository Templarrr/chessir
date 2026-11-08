import { describe, expect, it } from 'vitest';
import { outerContour, signedArea, simplifyLoop } from '../src/render/contour.js';

const grid = (rows) => (x, y) => rows[y][x] === '#';

describe('outerContour', () => {
  it('traces the outline of a filled block', () => {
    const rows = ['.....', '.###.', '.###.', '.....'];
    const loop = outerContour(5, 4, grid(rows));
    const xs = loop.map(([x]) => x);
    const ys = loop.map(([, y]) => y);
    expect([Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]).toEqual([
      0.5, 3.5, 0.5, 2.5,
    ]);
  });

  it('keeps the largest shape and fills in holes', () => {
    const rows = ['#.....', '..####', '..#..#', '..####'];
    const loop = outerContour(6, 4, grid(rows));
    expect(Math.min(...loop.map(([x]) => x))).toBeGreaterThan(1);
    const withoutHole = outerContour(6, 4, grid(['#.....', '..####', '..####', '..####']));
    expect(Math.abs(signedArea(loop))).toBeCloseTo(Math.abs(signedArea(withoutHole)));
  });
});

describe('simplifyLoop', () => {
  it('reduces a traced rectangle to its corners', () => {
    const rows = ['........', '.######.', '.######.', '.######.', '........'];
    const loop = outerContour(8, 5, grid(rows));
    expect(simplifyLoop(loop, 0.6).length).toBeLessThanOrEqual(8);
    expect(Math.abs(signedArea(simplifyLoop(loop, 0.6)))).toBeGreaterThan(14);
  });
});
