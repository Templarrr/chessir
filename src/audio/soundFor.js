import { bandSquares } from '../game/board.js';
import { capturedPieces } from '../game/material.js';
import { inCheck } from '../game/rules.js';

/**
 * Which sound a turn makes: `body` is the wood (move, capture or rotation) and `ring` the
 * metal layered on top when the turn gives check or mate. `pieces` is how many pieces moved.
 */
export function soundFor(before, action, after) {
  let body = 'move';
  let pieces = 1;
  if (action.type === 'rotate') {
    body = 'rotation';
    pieces = bandSquares(action.band).filter((sq) => before.board[sq]).length;
  } else if (capturedPieces(before.board, after.board).length > 0) body = 'capture';

  let ring = null;
  if (after.result?.outcome === 'checkmate') ring = 'checkmate';
  else if (inCheck(after)) ring = 'check';
  return { body, ring, pieces };
}
