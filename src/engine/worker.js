import { Position, moveToAction } from './position.js';
import { createSearcher } from './search.js';

// Runs the search off the main thread so the board keeps animating while the bot thinks.
let searcher = null;
let searcherMode = null;

self.onmessage = ({ data: { state, softMs, hardMs } }) => {
  // The table kept between moves knows nothing of the mode, so a new mode starts a fresh one.
  if (state.mode !== searcherMode) {
    searcher = createSearcher({ ttBits: 21 });
    searcherMode = state.mode;
  }
  const result = searcher.think(Position.fromState(state), { softMs, hardMs });
  self.postMessage({
    action: moveToAction(result.move),
    depth: result.depth,
    score: result.score,
    ms: result.ms,
  });
};
