// The engine variants compared by scripts/match.js. Each takes a time budget per move.
// `deep` is what the Deep bot plays; the others each differ from it as their names say.
import { createEvaluator, evaluateMaterial } from '../src/engine/evaluate.js';
import { Position, moveToAction } from '../src/engine/position.js';
import { createSearcher } from '../src/engine/search.js';
import { createMcts } from './mcts.js';

function searchBot(options) {
  return (ms) => {
    const searcher = createSearcher({ ttBits: 18, ...options });
    return (state) =>
      moveToAction(searcher.think(Position.fromState(state), { softMs: ms, hardMs: ms }).move);
  };
}

// The first version: classic king safety, single mobility, table cleared every move.
const first = { kingSafety: true, mobilityWeight: 1 };
const firstWith = ({ keepTable = false, ...evaluation }, search = {}) =>
  searchBot({ keepTable, ...search, evaluate: createEvaluator({ ...first, ...evaluation }) });

export const BOTS = {
  deep: searchBot({}),
  first: firstWith({}),
  material: searchBot({ keepTable: false, evaluate: evaluateMaterial }),
  norotate: firstWith({}, { rotations: false }),
  plain: firstWith({}, { nullMove: false, lmr: false }),
  noking: firstWith({ kingSafety: false }),
  nomob: firstWith({ mobilityWeight: 0 }),
  king5: firstWith({ kingWeight: 5 }),
  keep: firstWith({ kingSafety: false, keepTable: true }),
  mob2: firstWith({ kingSafety: false, mobilityWeight: 2 }),
  mcts: (ms) => {
    const mcts = createMcts();
    return (state) => moveToAction(mcts.think(Position.fromState(state), { softMs: ms }).move);
  },
};
