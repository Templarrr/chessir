import { BAND_COUNT, BOARD_SIZE, bandSquares, squareCoords, squareIndex } from './board.js';
import { moveAction, rotateAction } from './actions.js';
import { BISHOP, KING, KNIGHT, PAWN, QUEEN, ROOK, WHITE, opponent } from './pieces.js';
import { NORMAL, createInitialState, rotateBand } from './state.js';

export const PROMOTIONS = [QUEEN, ROOK, BISHOP, KNIGHT];
const FIFTY_MOVE_PLIES = 100;
const REPETITIONS_FOR_DRAW = 3;

const KNIGHT_STEPS = [
  [1, 2],
  [2, 1],
  [2, -1],
  [1, -2],
  [-1, -2],
  [-2, -1],
  [-2, 1],
  [-1, 2],
];
const KING_STEPS = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
];
const ROOK_DIRS = KING_STEPS.filter(([df, dr]) => df === 0 || dr === 0);
const BISHOP_DIRS = KING_STEPS.filter(([df, dr]) => df !== 0 && dr !== 0);
const SLIDES = { [ROOK]: ROOK_DIRS, [BISHOP]: BISHOP_DIRS, [QUEEN]: KING_STEPS };

const onBoard = (file, rank) => file >= 0 && file < BOARD_SIZE && rank >= 0 && rank < BOARD_SIZE;
const pawnDirection = (color) => (color === WHITE ? 1 : -1);
const homeRank = (color) => (color === WHITE ? 0 : BOARD_SIZE - 1);
const pawnStartRank = (color) => (color === WHITE ? 1 : BOARD_SIZE - 2);
const promotionRank = (color) => (color === WHITE ? BOARD_SIZE - 1 : 0);

const CASTLES = [
  { side: 'king', rookFile: 7, kingTo: 6, rookTo: 5, between: [5, 6] },
  { side: 'queen', rookFile: 0, kingTo: 2, rookTo: 3, between: [1, 2, 3] },
];
const KING_FILE = 4;

function step(square, df, dr) {
  const { file, rank } = squareCoords(square);
  return onBoard(file + df, rank + dr) ? squareIndex(file + df, rank + dr) : -1;
}

export function findKing(board, color) {
  return board.findIndex((p) => p && p.type === KING && p.color === color);
}

/** Squares holding pieces of `byColor` that attack `square`. */
export function attackersOf(board, square, byColor) {
  const found = [];
  const has = (sq, types) => {
    const p = board[sq];
    return p && p.color === byColor && types.includes(p.type);
  };

  for (const [df, dr] of KNIGHT_STEPS) {
    const sq = step(square, df, dr);
    if (sq >= 0 && has(sq, [KNIGHT])) found.push(sq);
  }
  for (const [df, dr] of KING_STEPS) {
    const sq = step(square, df, dr);
    if (sq >= 0 && has(sq, [KING])) found.push(sq);
  }
  // A pawn attacks diagonally forward, so look one rank behind it from the target's view.
  const back = -pawnDirection(byColor);
  for (const df of [-1, 1]) {
    const sq = step(square, df, back);
    if (sq >= 0 && has(sq, [PAWN])) found.push(sq);
  }
  for (const [dirs, types] of [
    [ROOK_DIRS, [ROOK, QUEEN]],
    [BISHOP_DIRS, [BISHOP, QUEEN]],
  ]) {
    for (const [df, dr] of dirs) {
      let sq = step(square, df, dr);
      while (sq >= 0 && !board[sq]) sq = step(sq, df, dr);
      if (sq >= 0 && has(sq, types)) found.push(sq);
    }
  }
  return found;
}

export function isAttacked(board, square, byColor) {
  return attackersOf(board, square, byColor).length > 0;
}

/** Squares of the pieces currently giving check to `color`. */
export function checkers(state, color = state.turn) {
  const king = findKing(state.board, color);
  return king < 0 ? [] : attackersOf(state.board, king, opponent(color));
}

export function inCheck(state, color = state.turn) {
  return checkers(state, color).length > 0;
}

function canCastle(state, color, castle) {
  const { board, moved } = state;
  const rank = homeRank(color);
  const king = board[squareIndex(KING_FILE, rank)];
  const rook = board[squareIndex(castle.rookFile, rank)];
  if (!king || king.type !== KING || king.color !== color || moved.includes(king.id)) return false;
  if (!rook || rook.type !== ROOK || rook.color !== color || moved.includes(rook.id)) return false;
  if (castle.between.some((f) => board[squareIndex(f, rank)])) return false;
  const enemy = opponent(color);
  // The king may not castle out of, through, or into check.
  const path = [KING_FILE, (KING_FILE + castle.kingTo) / 2, castle.kingTo];
  return path.every((f) => !isAttacked(board, squareIndex(f, rank), enemy));
}

/** Moves that follow how each piece moves, ignoring whether they leave the own king in check. */
function pseudoMovesFrom(state, from) {
  const { board } = state;
  const piece = board[from];
  if (!piece) return [];
  const moves = [];
  const add = (to) => {
    const { rank } = squareCoords(to);
    if (piece.type === PAWN && rank === promotionRank(piece.color)) {
      for (const type of PROMOTIONS) moves.push(moveAction(from, to, type));
    } else {
      moves.push(moveAction(from, to));
    }
  };
  const target = (sq) => (sq < 0 ? 'off' : !board[sq] ? 'empty' : board[sq].color);

  if (piece.type === PAWN) {
    const dir = pawnDirection(piece.color);
    const one = step(from, 0, dir);
    if (target(one) === 'empty') {
      add(one);
      const two = step(one, 0, dir);
      if (squareCoords(from).rank === pawnStartRank(piece.color) && target(two) === 'empty') {
        add(two);
      }
    }
    for (const df of [-1, 1]) {
      const sq = step(from, df, dir);
      if (sq < 0) continue;
      if (target(sq) === opponent(piece.color) || sq === state.enPassant) add(sq);
    }
  } else if (piece.type === KNIGHT || piece.type === KING) {
    for (const [df, dr] of piece.type === KNIGHT ? KNIGHT_STEPS : KING_STEPS) {
      const sq = step(from, df, dr);
      const t = target(sq);
      if (t === 'empty' || t === opponent(piece.color)) add(sq);
    }
    if (piece.type === KING) {
      for (const castle of CASTLES) {
        if (canCastle(state, piece.color, castle)) {
          add(squareIndex(castle.kingTo, homeRank(piece.color)));
        }
      }
    }
  } else {
    for (const [df, dr] of SLIDES[piece.type]) {
      let sq = step(from, df, dr);
      while (sq >= 0) {
        const t = target(sq);
        if (t === piece.color) break;
        add(sq);
        if (t !== 'empty') break;
        sq = step(sq, df, dr);
      }
    }
  }
  return moves;
}

function moveBoard(state, { from, to, promotion }) {
  const board = state.board.slice();
  const piece = board[from];
  const { file: fromFile, rank: fromRank } = squareCoords(from);
  const { file: toFile } = squareCoords(to);
  let captured = board[to];

  if (piece.type === PAWN && to === state.enPassant && !captured) {
    const victim = squareIndex(toFile, fromRank);
    captured = board[victim];
    board[victim] = null;
  }
  if (piece.type === KING && Math.abs(toFile - fromFile) === 2) {
    const castle = CASTLES.find((c) => c.kingTo === toFile);
    const rookFrom = squareIndex(castle.rookFile, fromRank);
    board[squareIndex(castle.rookTo, fromRank)] = board[rookFrom];
    board[rookFrom] = null;
  }
  board[to] = promotion ? { ...piece, type: promotion } : piece;
  board[from] = null;
  return { board, captured };
}

function leavesKingSafe(board, color) {
  const king = findKing(board, color);
  return king < 0 || !isAttacked(board, king, opponent(color));
}

export function legalMovesFrom(state, from) {
  const piece = state.board[from];
  if (!piece || piece.color !== state.turn || state.result) return [];
  return pseudoMovesFrom(state, from).filter((m) =>
    leavesKingSafe(moveBoard(state, m).board, piece.color),
  );
}

const sameLayout = (a, b) =>
  a.every((p, sq) => (p ? b[sq]?.type === p.type && b[sq]?.color === p.color : !b[sq]));

/**
 * True if this rotation would put every piece back where it stood before the opponent's
 * last action, e.g. turning a band straight back, or carrying a piece back to where it moved from.
 */
function restoresPreviousBoard(state, band, direction) {
  const before = state.previousBoard;
  return Boolean(before) && sameLayout(rotateBand(state.board, band, direction), before);
}

/**
 * Why a band rotation is not allowed right now, or null if it is. In check, the bands
 * holding the king or a checking piece are locked; any other rotation must end the check.
 */
export function rotationBlockReason(state, band, direction) {
  if (state.result) return 'The game is over';
  if (state.mode === NORMAL) return 'Bands do not turn in normal mode';
  const ring = bandSquares(band);
  if (!ring.some((sq) => state.board[sq])) return 'This band is empty';
  // Turning a band that carries only enemy pieces would move nothing but theirs.
  if (!ring.some((sq) => state.board[sq]?.color === state.turn)) {
    return 'This band holds none of your pieces';
  }
  if (restoresPreviousBoard(state, band, direction)) {
    return 'This would bring back the position from before the last move';
  }
  const locked = [findKing(state.board, state.turn), ...checkers(state)];
  if (locked.length > 1 && locked.some((sq) => ring.includes(sq))) {
    return 'In check: this band holds your king or the checking piece';
  }
  if (!leavesKingSafe(rotateBand(state.board, band, direction), state.turn)) {
    return locked.length > 1
      ? 'This rotation does not stop the check'
      : 'This would expose your king';
  }
  return null;
}

export function legalRotations(state) {
  const rotations = [];
  for (let band = 0; band < BAND_COUNT; band++) {
    for (const direction of [1, -1]) {
      if (!rotationBlockReason(state, band, direction)) {
        rotations.push(rotateAction(band, direction));
      }
    }
  }
  return rotations;
}

export function legalActions(state) {
  if (state.result) return [];
  const moves = [];
  state.board.forEach((piece, square) => {
    if (piece && piece.color === state.turn) moves.push(...legalMovesFrom(state, square));
  });
  return [...moves, ...legalRotations(state)];
}

function isLegal(state, action) {
  if (action.type === 'rotate') {
    return !rotationBlockReason(state, action.band, action.direction);
  }
  return legalMovesFrom(state, action.from).some(
    (m) => m.to === action.to && m.promotion === action.promotion,
  );
}

function positionKey(state) {
  const squares = state.board.map((p) => (p ? `${p.color[0]}${p.type}` : '-')).join(',');
  const castling = [WHITE, opponent(WHITE)]
    .flatMap((color) =>
      CASTLES.map((c) => {
        const rank = homeRank(color);
        const king = state.board[squareIndex(KING_FILE, rank)];
        const rook = state.board[squareIndex(c.rookFile, rank)];
        return king && rook && !state.moved.includes(king.id) && !state.moved.includes(rook.id)
          ? 1
          : 0;
      }),
    )
    .join('');
  // Rotations blocked by the no-undo rule change which turns are available, so they count.
  const blocked = [];
  for (let band = 0; band < BAND_COUNT; band++) {
    for (const direction of [1, -1]) {
      if (restoresPreviousBoard(state, band, direction)) blocked.push(`${band}${direction}`);
    }
  }
  return `${squares}|${state.turn}|${castling}|${state.enPassant}|${blocked.join(' ')}`;
}

const squareShade = (square) => {
  const { file, rank } = squareCoords(square);
  return (file + rank) % 2;
};

/**
 * Whether neither side can ever checkmate, whatever is played: a draw by insufficient
 * material. K v K, K+B v K and K+N v K are dead in both modes, as no mating position exists
 * with that material, and a lone king can only answer check with a king move (its band is
 * locked while in check), so rotations add no new mates. In normal mode, kings with bishops
 * that all stand on one square colour are dead too. In roundabout mode they are not: a
 * rotation moves every piece on the band to a neighbouring square of the other colour, so
 * bishops can end up on opposite colours, where mates exist.
 */
export function isDeadPosition(board, mode) {
  const others = [];
  board.forEach((p, square) => {
    if (p && p.type !== KING) others.push({ type: p.type, square });
  });
  if (others.length === 0) return true;
  if (others.length === 1 && [BISHOP, KNIGHT].includes(others[0].type)) return true;
  if (mode !== NORMAL || others.some((o) => o.type !== BISHOP)) return false;
  return others.every((o) => squareShade(o.square) === squareShade(others[0].square));
}

function decideResult(state) {
  if (isDeadPosition(state.board, state.mode)) {
    return { outcome: 'draw', reason: 'insufficient material' };
  }
  if (state.positions[positionKey(state)] >= REPETITIONS_FOR_DRAW) {
    return { outcome: 'draw', reason: 'threefold repetition' };
  }
  if (state.halfmoveClock >= FIFTY_MOVE_PLIES) {
    return { outcome: 'draw', reason: 'fifty-move rule' };
  }
  if (legalActions(state).length > 0) return null;
  return inCheck(state)
    ? { outcome: 'checkmate', winner: opponent(state.turn), reason: 'checkmate' }
    : { outcome: 'draw', reason: 'stalemate' };
}

function withPositionRecorded(state) {
  const key = positionKey(state);
  return { ...state, positions: { ...state.positions, [key]: (state.positions[key] ?? 0) + 1 } };
}

export function newGame(options) {
  return Object.freeze(withPositionRecorded(createInitialState(options)));
}

/** Plays a legal action and returns the next state; throws on illegal input. */
export function applyAction(state, action) {
  if (!isLegal(state, action)) throw new Error(`Illegal action: ${JSON.stringify(action)}`);

  let board;
  let movedIds;
  let enPassant = null;
  let resetsClock = false;

  if (action.type === 'rotate') {
    const ring = bandSquares(action.band);
    board = rotateBand(state.board, action.band, action.direction);
    movedIds = ring.map((sq) => state.board[sq]?.id).filter((id) => id !== undefined);
  } else {
    const piece = state.board[action.from];
    const result = moveBoard(state, action);
    board = result.board;
    movedIds = [piece.id];
    resetsClock = piece.type === PAWN || Boolean(result.captured);
    const { rank: fromRank } = squareCoords(action.from);
    const { file, rank: toRank } = squareCoords(action.to);
    if (piece.type === PAWN && Math.abs(toRank - fromRank) === 2) {
      enPassant = squareIndex(file, (fromRank + toRank) / 2);
    }
  }

  const next = withPositionRecorded({
    ...state,
    board: Object.freeze(board),
    turn: opponent(state.turn),
    enPassant,
    moved: Object.freeze([...new Set([...state.moved, ...movedIds])]),
    halfmoveClock: resetsClock ? 0 : state.halfmoveClock + 1,
    lastAction: action,
    previousBoard: state.board,
  });
  return Object.freeze({ ...next, result: decideResult(next) });
}
