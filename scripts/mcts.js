import { createSearcher } from '../src/engine/search.js';

const EXPLORATION = 0.9;

/**
 * Monte Carlo tree search with UCT, where each new leaf is scored by a quiescence search
 * instead of a random playout (random games of Chessir say almost nothing about a position).
 * Kept for the comparison matches; alpha-beta beat it clearly.
 */
export function createMcts({ now = () => performance.now() } = {}) {
  const searcher = createSearcher({ ttBits: 12, now });

  function newNode(pos) {
    const moves = pos.legalMoves();
    return { moves, children: new Array(moves.length).fill(null), visits: 0, value: 0 };
  }

  // Value in [0, 1] for the side that just moved into this node.
  function leafValue(pos, node) {
    if (node.moves.length === 0) return pos.inCheck() ? 1 : 0.5;
    if (pos.isRuleDraw(0)) return 0.5;
    const score = searcher.quietScore(pos);
    return 1 - 1 / (1 + Math.exp(-score / 250));
  }

  function think(pos, { softMs = 1000 } = {}) {
    const start = now();
    const root = newNode(pos);
    if (root.moves.length <= 1) return { move: root.moves[0] ?? 0, depth: 0, nodes: 0 };
    let iterations = 0;
    while (now() - start < softMs) {
      const path = [root];
      let node = root;
      let made = 0;
      while (node.moves.length) {
        let pick = node.children.indexOf(null);
        if (pick < 0) {
          let best = -1;
          const logN = Math.log(node.visits);
          node.children.forEach((c, i) => {
            const u = c.value / c.visits + EXPLORATION * Math.sqrt(logN / c.visits);
            if (u > best) {
              best = u;
              pick = i;
            }
          });
        }
        pos.make(node.moves[pick]);
        made++;
        if (!node.children[pick]) {
          node.children[pick] = newNode(pos);
          path.push(node.children[pick]);
          break;
        }
        node = node.children[pick];
        path.push(node);
        if (pos.isRuleDraw(0)) break;
      }
      const leaf = path[path.length - 1];
      let value = leaf.visits === 0 ? leafValue(pos, leaf) : leaf.value / leaf.visits;
      for (let i = path.length - 1; i >= 0; i--) {
        path[i].visits++;
        path[i].value += value;
        value = 1 - value;
      }
      while (made--) pos.unmake();
      iterations++;
    }
    let best = 0;
    root.children.forEach((c, i) => {
      if (c && c.visits > (root.children[best]?.visits ?? -1)) best = i;
    });
    return { move: root.moves[best], depth: 0, nodes: iterations, ms: now() - start };
  }

  return { think };
}
