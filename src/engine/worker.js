import { Position, moveToAction } from './position.js';
import { createSearcher } from './search.js';

// Runs the search off the main thread so the board keeps animating while the bot thinks.
const searcher = createSearcher({ ttBits: 21 });

self.onmessage = ({ data: { state, softMs, hardMs } }) => {
  const result = searcher.think(Position.fromState(state), { softMs, hardMs });
  self.postMessage({
    action: moveToAction(result.move),
    depth: result.depth,
    score: result.score,
    ms: result.ms,
  });
};
