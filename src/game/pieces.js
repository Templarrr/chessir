export const WHITE = 'white';
export const BLACK = 'black';

export const PAWN = 'pawn';
export const KNIGHT = 'knight';
export const BISHOP = 'bishop';
export const ROOK = 'rook';
export const QUEEN = 'queen';
export const KING = 'king';

export const BACK_RANK = [ROOK, KNIGHT, BISHOP, QUEEN, KING, BISHOP, KNIGHT, ROOK];

export function opponent(color) {
  return color === WHITE ? BLACK : WHITE;
}
