import { createFlatSet } from './flatPieceModels.js';
import { createWoodenSet } from './pieceModels.js';

export const PIECE_SETS = [
  { id: 'wooden', label: 'Wooden 3d', create: createWoodenSet },
  { id: 'flat', label: 'High visibility 2d', create: createFlatSet },
];
export const DEFAULT_PIECE_SET = 'wooden';

const created = new Map();

/** The set with this id, built once and then shared by the board and the captured ledges. */
export function pieceSet(id) {
  if (!created.has(id)) created.set(id, PIECE_SETS.find((s) => s.id === id).create());
  return created.get(id);
}
