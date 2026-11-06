import { FILES, squareCoords, squareName } from './board.js';
import { BISHOP, KING, KNIGHT, PAWN, QUEEN, ROOK, WHITE } from './pieces.js';
import { applyAction, inCheck, legalMovesFrom } from './rules.js';

export const BAND_LETTERS = 'ABCD';
const PIECE_LETTERS = { [KNIGHT]: 'N', [BISHOP]: 'B', [ROOK]: 'R', [QUEEN]: 'Q', [KING]: 'K' };

/**
 * Bands are named after the first file they cover (a, b, c, d). Clockwise (direction 1)
 * carries the pieces on that file toward higher ranks, which is "+".
 */
export function bandMoveName(band, direction) {
  return `${BAND_LETTERS[band]}${direction === 1 ? '+' : '-'}`;
}

function disambiguation(state, { from, to }) {
  const piece = state.board[from];
  const rivals = [];
  state.board.forEach((p, sq) => {
    if (sq === from || p?.type !== piece.type || p.color !== piece.color) return;
    if (legalMovesFrom(state, sq).some((m) => m.to === to)) rivals.push(squareCoords(sq));
  });
  if (rivals.length === 0) return '';
  const { file, rank } = squareCoords(from);
  if (rivals.every((r) => r.file !== file)) return FILES[file];
  if (rivals.every((r) => r.rank !== rank)) return String(rank + 1);
  return squareName(from);
}

function moveSan(state, action) {
  const { from, to, promotion } = action;
  const piece = state.board[from];
  const fromFile = squareCoords(from).file;
  const toFile = squareCoords(to).file;

  if (piece.type === KING && Math.abs(toFile - fromFile) === 2) {
    return toFile > fromFile ? 'O-O' : 'O-O-O';
  }
  if (piece.type === PAWN) {
    const capture = fromFile !== toFile ? `${FILES[fromFile]}x` : '';
    const promo = promotion ? `=${PIECE_LETTERS[promotion]}` : '';
    return `${capture}${squareName(to)}${promo}`;
  }
  const capture = state.board[to] ? 'x' : '';
  return `${PIECE_LETTERS[piece.type]}${disambiguation(state, action)}${capture}${squareName(to)}`;
}

/** Standard algebraic notation for a move, or the band name for a rotation, plus + or #. */
export function notate(state, action, next = applyAction(state, action)) {
  const text =
    action.type === 'rotate' ? bandMoveName(action.band, action.direction) : moveSan(state, action);
  if (next.result?.outcome === 'checkmate') return `${text}#`;
  return inCheck(next) ? `${text}+` : text;
}

export function resultToken(result) {
  if (!result) return '';
  if (result.outcome === 'checkmate') return result.winner === WHITE ? '1-0' : '0-1';
  return '1/2-1/2';
}

/** Moves as "1. e4 e5 2. A+ Nf6", followed by the result once the game is over. */
export function formatMovetext(moves, result) {
  const parts = [];
  moves.forEach((san, i) => {
    if (i % 2 === 0) parts.push(`${i / 2 + 1}.`);
    parts.push(san);
  });
  const token = resultToken(result);
  if (token) parts.push(token);
  return parts.join(' ');
}
