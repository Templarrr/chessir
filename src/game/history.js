import { capturedPieces, sortByValue } from './material.js';
import { notate } from './notation.js';
import { opponent } from './pieces.js';
import { applyAction } from './rules.js';

/**
 * A game as a list of snapshots: entry 0 is the start, entry n the position after the
 * n-th action, with that action's notation and everything captured up to then.
 */
export function startHistory(state) {
  return [{ state, captured: { white: [], black: [] }, action: null, move: null }];
}

export function recordAction(history, action) {
  const { state, captured } = history.at(-1);
  const next = applyAction(state, action);
  let nextCaptured = captured;
  for (const piece of capturedPieces(state.board, next.board)) {
    const by = opponent(piece.color);
    nextCaptured = { ...nextCaptured, [by]: sortByValue([...nextCaptured[by], piece]) };
  }
  return [
    ...history,
    { state: next, captured: nextCaptured, action, move: notate(state, action, next) },
  ];
}

/** Drops everything after entry `index`, so play continues from that position. */
export function truncateHistory(history, index) {
  return history.slice(0, index + 1);
}

export function movesOf(history) {
  return history.slice(1).map((entry) => entry.move);
}
