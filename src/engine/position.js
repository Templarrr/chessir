import { BAND_COUNT, bandOf, bandSquares } from '../game/board.js';
import { WHITE as WHITE_NAME } from '../game/pieces.js';
import { NORMAL as NORMAL_MODE } from '../game/state.js';

// A compact mutable position with make/unmake, so the search does not allocate per node.
// It mirrors src/game/rules.js exactly; tests/engine.test.js checks that on random games.

export const PAWN = 1;
export const KNIGHT = 2;
export const BISHOP = 3;
export const ROOK = 4;
export const QUEEN = 5;
export const KING = 6;
export const WHITE = 0;
export const BLACK = 8;
export const TYPE_NAMES = ['', 'pawn', 'knight', 'bishop', 'rook', 'queen', 'king'];

// Move layout: from | to << 6 | promotion << 12 | kind << 15. A rotation keeps its band in
// `from` and its direction in `to` (0 = clockwise, 1 = counter-clockwise).
export const NORMAL = 0;
export const DOUBLE = 1;
export const EN_PASSANT = 2;
export const CASTLE = 3;
export const ROTATE = 4;
export const NULL_MOVE = 0x7fffffff;

export const moveFrom = (m) => m & 63;
export const moveTo = (m) => (m >> 6) & 63;
export const movePromotion = (m) => (m >> 12) & 7;
export const moveKind = (m) => (m >> 15) & 7;
const encode = (from, to, promotion, kind) => from | (to << 6) | (promotion << 12) | (kind << 15);
export const rotationMove = (band, direction) => encode(band, direction === 1 ? 0 : 1, 0, ROTATE);

const fileOf = (sq) => sq & 7;
const rankOf = (sq) => sq >> 3;
const onBoard = (f, r) => f >= 0 && f < 8 && r >= 0 && r < 8;

function targets(steps) {
  const table = [];
  for (let sq = 0; sq < 64; sq++) {
    const list = [];
    for (const [df, dr] of steps) {
      if (onBoard(fileOf(sq) + df, rankOf(sq) + dr)) list.push(sq + df + dr * 8);
    }
    table.push(list);
  }
  return table;
}

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
// Rook directions first, then bishop directions.
const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [-1, 1],
  [1, -1],
  [-1, -1],
];
export const KNIGHT_TARGETS = targets(KNIGHT_STEPS);
export const KING_TARGETS = targets(DIRS);
export const RAYS = DIRS.map(([df, dr]) => {
  const table = [];
  for (let sq = 0; sq < 64; sq++) {
    const ray = [];
    let f = fileOf(sq) + df;
    let r = rankOf(sq) + dr;
    while (onBoard(f, r)) {
      ray.push(f + r * 8);
      f += df;
      r += dr;
    }
    table.push(ray);
  }
  return table;
});
// PAWN_ATTACKS[side >> 3][sq]: squares a pawn of that side on sq attacks.
export const PAWN_ATTACKS = [
  targets([
    [-1, 1],
    [1, 1],
  ]),
  targets([
    [-1, -1],
    [1, -1],
  ]),
];
export const RINGS = Array.from({ length: BAND_COUNT }, (_, b) => bandSquares(b));
export const BAND_OF = Array.from({ length: 64 }, (_, sq) => bandOf(sq));

const CASTLE_WK = 1;
const CASTLE_WQ = 2;
const CASTLE_BK = 4;
const CASTLE_BQ = 8;
// Moving from or to one of these squares loses the matching rights.
const CASTLE_MASK = new Uint8Array(64).fill(15);
CASTLE_MASK[4] = 15 & ~(CASTLE_WK | CASTLE_WQ);
CASTLE_MASK[7] = 15 & ~CASTLE_WK;
CASTLE_MASK[0] = 15 & ~CASTLE_WQ;
CASTLE_MASK[60] = 15 & ~(CASTLE_BK | CASTLE_BQ);
CASTLE_MASK[63] = 15 & ~CASTLE_BK;
CASTLE_MASK[56] = 15 & ~CASTLE_BQ;

// Zobrist keys as pairs of 32-bit halves, from a fixed seed so hashes are reproducible.
let seed = 0x9e3779b9;
function random32() {
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return seed | 0;
}
const PIECE_KEYS = Int32Array.from({ length: 16 * 64 * 2 }, random32);
const SIDE_KEY = [random32(), random32()];
const CASTLE_KEYS = Int32Array.from({ length: 4 * 2 }, random32);
const EP_KEYS = Int32Array.from({ length: 64 * 2 }, random32);
const BLOCK_KEYS = Int32Array.from({ length: 8 * 2 }, random32);

export const MAX_PLY = 128;
const MAX_HISTORY = 1024;

function rotateInto(board, band, direction) {
  const ring = RINGS[band];
  const n = ring.length;
  if (direction === 1) {
    const last = board[ring[n - 1]];
    for (let i = n - 1; i > 0; i--) board[ring[i]] = board[ring[i - 1]];
    board[ring[0]] = last;
  } else {
    const first = board[ring[0]];
    for (let i = 0; i < n - 1; i++) board[ring[i]] = board[ring[i + 1]];
    board[ring[n - 1]] = first;
  }
}

/** Bitmask over (band * 2 + (direction === 1 ? 0 : 1)) of rotations that turn `board` into `prev`. */
function restoringRotations(board, prev) {
  let diffBands = 0;
  for (let sq = 0; sq < 64; sq++) if (board[sq] !== prev[sq]) diffBands |= 1 << BAND_OF[sq];
  if (diffBands & (diffBands - 1)) return 0;
  let mask = 0;
  for (let band = 0; band < BAND_COUNT; band++) {
    // Only the band that changed can undo it, unless nothing changed at all.
    if (diffBands && !(diffBands & (1 << band))) continue;
    const ring = RINGS[band];
    const n = ring.length;
    for (let d = 0; d < 2; d++) {
      const shift = d === 0 ? 1 : n - 1;
      let same = true;
      for (let i = 0; i < n && same; i++) same = board[ring[i]] === prev[ring[(i + shift) % n]];
      if (same) mask |= 1 << (band * 2 + d);
    }
  }
  return mask;
}

export class Position {
  constructor() {
    this.board = new Int8Array(64);
    this.side = WHITE;
    this.castling = 0;
    this.ep = -1;
    this.halfmove = 0;
    this.kings = new Int8Array(2);
    this.hashLo = 0;
    this.hashHi = 0;
    // Rotations blocked by the no-undo rule in the current position, as restoringRotations.
    this.blocked = 0;
    // False in normal mode, where neither side may turn a band.
    this.rotations = true;
    this.ply = 0;
    this.prevBoard = new Int8Array(64);
    this.scratch = new Int8Array(64);
    const n = MAX_PLY + MAX_HISTORY;
    this.stackMove = new Int32Array(n);
    this.stackCaptured = new Int8Array(n);
    this.stackCastling = new Uint8Array(n);
    this.stackEp = new Int8Array(n);
    this.stackHalfmove = new Int16Array(n);
    this.stackBlocked = new Uint8Array(n);
    this.stackHashLo = new Int32Array(n);
    this.stackHashHi = new Int32Array(n);
    this.history = new Map();
  }

  /** Builds a position from a src/game state object. */
  static fromState(state) {
    const pos = new Position();
    state.board.forEach((p, sq) => {
      if (p) pos.board[sq] = codeOf(p);
    });
    pos.side = state.turn === WHITE_NAME ? WHITE : BLACK;
    for (const [king, rook, bit] of [
      [4, 7, CASTLE_WK],
      [4, 0, CASTLE_WQ],
      [60, 63, CASTLE_BK],
      [60, 56, CASTLE_BQ],
    ]) {
      const k = state.board[king];
      const r = state.board[rook];
      if (k && r && !state.moved.includes(k.id) && !state.moved.includes(r.id)) pos.castling |= bit;
    }
    pos.rotations = state.mode !== NORMAL_MODE;
    pos.ep = state.enPassant ?? -1;
    pos.halfmove = state.halfmoveClock;
    for (let sq = 0; sq < 64; sq++) {
      if ((pos.board[sq] & 7) === KING) pos.kings[pos.board[sq] >> 3] = sq;
    }
    if (state.previousBoard) {
      const prev = new Int8Array(64);
      state.previousBoard.forEach((p, sq) => {
        if (p) prev[sq] = codeOf(p);
      });
      pos.blocked = restoringRotations(pos.board, prev);
    }
    pos.computeHash();
    for (const [key, count] of Object.entries(state.positions ?? {})) {
      const h = hashOfPositionKey(key);
      pos.history.set(historyKey(h[0], h[1]), count);
    }
    return pos;
  }

  computeHash() {
    let lo = 0;
    let hi = 0;
    for (let sq = 0; sq < 64; sq++) {
      const p = this.board[sq];
      if (p) {
        lo ^= PIECE_KEYS[(p * 64 + sq) * 2];
        hi ^= PIECE_KEYS[(p * 64 + sq) * 2 + 1];
      }
    }
    if (this.side === BLACK) {
      lo ^= SIDE_KEY[0];
      hi ^= SIDE_KEY[1];
    }
    for (let i = 0; i < 4; i++) {
      if (this.castling & (1 << i)) {
        lo ^= CASTLE_KEYS[i * 2];
        hi ^= CASTLE_KEYS[i * 2 + 1];
      }
    }
    if (this.ep >= 0) {
      lo ^= EP_KEYS[this.ep * 2];
      hi ^= EP_KEYS[this.ep * 2 + 1];
    }
    for (let i = 0; i < 8; i++) {
      if (this.blocked & (1 << i)) {
        lo ^= BLOCK_KEYS[i * 2];
        hi ^= BLOCK_KEYS[i * 2 + 1];
      }
    }
    this.hashLo = lo;
    this.hashHi = hi;
  }

  /** True if a piece of side `by` attacks `sq`. */
  attacked(sq, by) {
    const b = this.board;
    for (const t of KNIGHT_TARGETS[sq]) if (b[t] === (KNIGHT | by)) return true;
    for (const t of KING_TARGETS[sq]) if (b[t] === (KING | by)) return true;
    for (const t of PAWN_ATTACKS[(by ^ 8) >> 3][sq]) if (b[t] === (PAWN | by)) return true;
    const rook = ROOK | by;
    const bishop = BISHOP | by;
    const queen = QUEEN | by;
    for (let d = 0; d < 8; d++) {
      const ray = RAYS[d][sq];
      for (let i = 0; i < ray.length; i++) {
        const p = b[ray[i]];
        if (p) {
          if (p === queen || p === (d < 4 ? rook : bishop)) return true;
          break;
        }
      }
    }
    return false;
  }

  /** Bitmask of the bands holding pieces of `by` that attack `sq`. */
  attackerBands(sq, by) {
    const b = this.board;
    let bands = 0;
    for (const t of KNIGHT_TARGETS[sq]) if (b[t] === (KNIGHT | by)) bands |= 1 << BAND_OF[t];
    for (const t of KING_TARGETS[sq]) if (b[t] === (KING | by)) bands |= 1 << BAND_OF[t];
    for (const t of PAWN_ATTACKS[(by ^ 8) >> 3][sq]) {
      if (b[t] === (PAWN | by)) bands |= 1 << BAND_OF[t];
    }
    for (let d = 0; d < 8; d++) {
      const ray = RAYS[d][sq];
      for (let i = 0; i < ray.length; i++) {
        const p = b[ray[i]];
        if (p) {
          if (p === (QUEEN | by) || p === ((d < 4 ? ROOK : BISHOP) | by)) {
            bands |= 1 << BAND_OF[ray[i]];
          }
          break;
        }
      }
    }
    return bands;
  }

  inCheck() {
    return this.attacked(this.kings[this.side >> 3], this.side ^ 8);
  }

  /** Writes pseudo-legal piece moves and fully checked-in-advance rotation candidates into `out`. */
  generate(out, capturesOnly = false) {
    const b = this.board;
    const us = this.side;
    const them = us ^ 8;
    let n = 0;
    const forward = us === WHITE ? 8 : -8;
    const startRank = us === WHITE ? 1 : 6;
    const lastRank = us === WHITE ? 7 : 0;
    for (let from = 0; from < 64; from++) {
      const p = b[from];
      if (!p || (p & 8) !== us) continue;
      const type = p & 7;
      if (type === PAWN) {
        const one = from + forward;
        if (one >= 0 && one < 64) {
          const promo = rankOf(one) === lastRank;
          if (!b[one] && (!capturesOnly || promo)) {
            if (promo) {
              for (let t = QUEEN; t >= KNIGHT; t--) out[n++] = encode(from, one, t, NORMAL);
            } else {
              out[n++] = encode(from, one, 0, NORMAL);
              const two = one + forward;
              if (!capturesOnly && rankOf(from) === startRank && !b[two]) {
                out[n++] = encode(from, two, 0, DOUBLE);
              }
            }
          }
          for (const to of PAWN_ATTACKS[us >> 3][from]) {
            const q = b[to];
            if (q && (q & 8) === them) {
              if (rankOf(to) === lastRank) {
                for (let t = QUEEN; t >= KNIGHT; t--) out[n++] = encode(from, to, t, NORMAL);
              } else {
                out[n++] = encode(from, to, 0, NORMAL);
              }
            } else if (to === this.ep && !q) {
              out[n++] = encode(from, to, 0, EN_PASSANT);
            }
          }
        }
      } else if (type === KNIGHT || type === KING) {
        for (const to of type === KNIGHT ? KNIGHT_TARGETS[from] : KING_TARGETS[from]) {
          const q = b[to];
          if (q ? (q & 8) === them : !capturesOnly) out[n++] = encode(from, to, 0, NORMAL);
        }
      } else {
        const d0 = type === BISHOP ? 4 : 0;
        const d1 = type === ROOK ? 4 : 8;
        for (let d = d0; d < d1; d++) {
          const ray = RAYS[d][from];
          for (let i = 0; i < ray.length; i++) {
            const to = ray[i];
            const q = b[to];
            if (q) {
              if ((q & 8) === them) out[n++] = encode(from, to, 0, NORMAL);
              break;
            }
            if (!capturesOnly) out[n++] = encode(from, to, 0, NORMAL);
          }
        }
      }
    }
    if (capturesOnly) return n;

    const king = this.kings[us >> 3];
    if (this.castling && king === (us === WHITE ? 4 : 60)) {
      const rank = us === WHITE ? 0 : 56;
      const kSide = us === WHITE ? CASTLE_WK : CASTLE_BK;
      const qSide = us === WHITE ? CASTLE_WQ : CASTLE_BQ;
      if (
        this.castling & kSide &&
        !b[rank + 5] &&
        !b[rank + 6] &&
        !this.attacked(rank + 4, them) &&
        !this.attacked(rank + 5, them) &&
        !this.attacked(rank + 6, them)
      ) {
        out[n++] = encode(rank + 4, rank + 6, 0, CASTLE);
      }
      if (
        this.castling & qSide &&
        !b[rank + 1] &&
        !b[rank + 2] &&
        !b[rank + 3] &&
        !this.attacked(rank + 4, them) &&
        !this.attacked(rank + 3, them) &&
        !this.attacked(rank + 2, them)
      ) {
        out[n++] = encode(rank + 4, rank + 2, 0, CASTLE);
      }
    }

    if (!this.rotations) return n;
    // In check, the bands holding the king or a checker are locked.
    const checkerBands = this.attackerBands(king, them);
    const locked = checkerBands ? checkerBands | (1 << BAND_OF[king]) : 0;
    for (let band = 0; band < BAND_COUNT; band++) {
      if (locked & (1 << band)) continue;
      const ring = RINGS[band];
      let ours = false;
      for (let i = 0; i < ring.length && !ours; i++)
        ours = b[ring[i]] !== 0 && (b[ring[i]] & 8) === us;
      if (!ours) continue;
      for (let d = 0; d < 2; d++) {
        if (!(this.blocked & (1 << (band * 2 + d)))) out[n++] = encode(band, d, 0, ROTATE);
      }
    }
    return n;
  }

  /** Plays a pseudo-legal move; returns false (with the move already taken back) if it leaves the own king attacked. */
  make(m) {
    const b = this.board;
    const us = this.side;
    const i = this.ply++;
    this.stackMove[i] = m;
    this.stackCastling[i] = this.castling;
    this.stackEp[i] = this.ep;
    this.stackHalfmove[i] = this.halfmove;
    this.stackBlocked[i] = this.blocked;
    this.stackHashLo[i] = this.hashLo;
    this.stackHashHi[i] = this.hashHi;

    let lo = this.hashLo ^ SIDE_KEY[0];
    let hi = this.hashHi ^ SIDE_KEY[1];
    if (this.ep >= 0) {
      lo ^= EP_KEYS[this.ep * 2];
      hi ^= EP_KEYS[this.ep * 2 + 1];
    }
    for (let k = 0; k < 8; k++) {
      if (this.blocked & (1 << k)) {
        lo ^= BLOCK_KEYS[k * 2];
        hi ^= BLOCK_KEYS[k * 2 + 1];
      }
    }
    const oldCastling = this.castling;
    this.ep = -1;
    let captured = 0;
    let checkBlocked;
    const kind = moveKind(m);

    if (kind === ROTATE) {
      const band = moveFrom(m);
      const ring = RINGS[band];
      const prev = this.scratch;
      for (let k = 0; k < ring.length; k++) prev[ring[k]] = b[ring[k]];
      rotateInto(b, band, moveTo(m) === 0 ? 1 : -1);
      for (let k = 0; k < ring.length; k++) {
        const sq = ring[k];
        const before = prev[sq];
        const after = b[sq];
        if (before !== after) {
          if (before) {
            lo ^= PIECE_KEYS[(before * 64 + sq) * 2];
            hi ^= PIECE_KEYS[(before * 64 + sq) * 2 + 1];
          }
          if (after) {
            lo ^= PIECE_KEYS[(after * 64 + sq) * 2];
            hi ^= PIECE_KEYS[(after * 64 + sq) * 2 + 1];
          }
        }
        if ((after & 7) === KING) this.kings[after >> 3] = sq;
      }
      // Every castling square is on the outer band, and turning it moves whatever stands there.
      if (band === 0) this.castling = 0;
      this.halfmove++;
      checkBlocked = true;
    } else {
      const from = moveFrom(m);
      const to = moveTo(m);
      const piece = b[from];
      captured = b[to];
      const promotion = movePromotion(m);
      const placed = promotion ? promotion | us : piece;
      if (captured) {
        lo ^= PIECE_KEYS[(captured * 64 + to) * 2];
        hi ^= PIECE_KEYS[(captured * 64 + to) * 2 + 1];
      }
      lo ^= PIECE_KEYS[(piece * 64 + from) * 2] ^ PIECE_KEYS[(placed * 64 + to) * 2];
      hi ^= PIECE_KEYS[(piece * 64 + from) * 2 + 1] ^ PIECE_KEYS[(placed * 64 + to) * 2 + 1];
      b[to] = placed;
      b[from] = 0;
      if (kind === EN_PASSANT) {
        const victim = (to & 7) | (from & 56);
        captured = b[victim];
        b[victim] = 0;
        lo ^= PIECE_KEYS[(captured * 64 + victim) * 2];
        hi ^= PIECE_KEYS[(captured * 64 + victim) * 2 + 1];
      } else if (kind === CASTLE) {
        const rookFrom = to > from ? from + 3 : from - 4;
        const rookTo = to > from ? from + 1 : from - 1;
        const rook = b[rookFrom];
        b[rookTo] = rook;
        b[rookFrom] = 0;
        lo ^= PIECE_KEYS[(rook * 64 + rookFrom) * 2] ^ PIECE_KEYS[(rook * 64 + rookTo) * 2];
        hi ^= PIECE_KEYS[(rook * 64 + rookFrom) * 2 + 1] ^ PIECE_KEYS[(rook * 64 + rookTo) * 2 + 1];
      } else if (kind === DOUBLE) {
        this.ep = (from + to) >> 1;
        lo ^= EP_KEYS[this.ep * 2];
        hi ^= EP_KEYS[this.ep * 2 + 1];
      }
      if ((piece & 7) === KING) this.kings[us >> 3] = to;
      this.castling &= CASTLE_MASK[from] & CASTLE_MASK[to];
      this.halfmove = (piece & 7) === PAWN || captured ? 0 : this.halfmove + 1;
      // A rotation can only undo a quiet move that stayed on one band.
      checkBlocked = !captured && !promotion && BAND_OF[from] === BAND_OF[to];
      if (checkBlocked && kind !== CASTLE) {
        const prev = this.scratch;
        const ring = RINGS[BAND_OF[from]];
        for (let k = 0; k < ring.length; k++) prev[ring[k]] = b[ring[k]];
        prev[from] = piece;
        prev[to] = 0;
      }
      if (kind === CASTLE) {
        const prev = this.scratch;
        for (let k = 0; k < 28; k++) prev[RINGS[0][k]] = b[RINGS[0][k]];
        const rookFrom = to > from ? from + 3 : from - 4;
        const rookTo = to > from ? from + 1 : from - 1;
        prev[from] = piece;
        prev[to] = 0;
        prev[rookFrom] = b[rookTo];
        prev[rookTo] = 0;
      }
    }
    this.stackCaptured[i] = captured;

    const changed = oldCastling ^ this.castling;
    for (let k = 0; k < 4; k++) {
      if (changed & (1 << k)) {
        lo ^= CASTLE_KEYS[k * 2];
        hi ^= CASTLE_KEYS[k * 2 + 1];
      }
    }

    // `scratch` holds the previous contents of the one band the action touched.
    this.blocked = 0;
    if (checkBlocked) {
      const band = kind === ROTATE ? moveFrom(m) : BAND_OF[moveFrom(m)];
      this.blocked = this.ringRestorers(band);
      for (let k = 0; k < 8; k++) {
        if (this.blocked & (1 << k)) {
          lo ^= BLOCK_KEYS[k * 2];
          hi ^= BLOCK_KEYS[k * 2 + 1];
        }
      }
    }
    this.hashLo = lo;
    this.hashHi = hi;
    this.side = us ^ 8;

    if (this.attacked(this.kings[us >> 3], us ^ 8)) {
      this.unmake();
      return false;
    }
    return true;
  }

  /**
   * Rotations that restore the previous board, given that only `band` changed and its old
   * contents are in `scratch`. If the action left the band looking the same, any band that
   * looks the same after a turn would also restore it; that needs four identical pieces.
   */
  ringRestorers(band) {
    const b = this.board;
    const prev = this.scratch;
    const ring = RINGS[band];
    const n = ring.length;
    let unchanged = true;
    for (let k = 0; k < n && unchanged; k++) unchanged = b[ring[k]] === prev[ring[k]];
    if (unchanged) {
      const copy = this.prevBoard;
      copy.set(b);
      return restoringRotations(b, copy);
    }
    let mask = 0;
    for (let d = 0; d < 2; d++) {
      const shift = d === 0 ? 1 : n - 1;
      let same = true;
      for (let k = 0; k < n && same; k++) same = b[ring[k]] === prev[ring[(k + shift) % n]];
      if (same) mask |= 1 << (band * 2 + d);
    }
    return mask;
  }

  unmake() {
    const i = --this.ply;
    const m = this.stackMove[i];
    const b = this.board;
    this.side ^= 8;
    const us = this.side;
    this.castling = this.stackCastling[i];
    this.ep = this.stackEp[i];
    this.halfmove = this.stackHalfmove[i];
    this.blocked = this.stackBlocked[i];
    this.hashLo = this.stackHashLo[i];
    this.hashHi = this.stackHashHi[i];
    if (m === NULL_MOVE) return;
    const kind = moveKind(m);
    if (kind === ROTATE) {
      const band = moveFrom(m);
      rotateInto(b, band, moveTo(m) === 0 ? -1 : 1);
      const ring = RINGS[band];
      for (let k = 0; k < ring.length; k++) {
        const p = b[ring[k]];
        if ((p & 7) === KING) this.kings[p >> 3] = ring[k];
      }
      return;
    }
    const from = moveFrom(m);
    const to = moveTo(m);
    const placed = b[to];
    b[from] = movePromotion(m) ? PAWN | us : placed;
    b[to] = 0;
    const captured = this.stackCaptured[i];
    if (kind === EN_PASSANT) {
      b[(to & 7) | (from & 56)] = captured;
    } else {
      b[to] = captured;
      if (kind === CASTLE) {
        const rookFrom = to > from ? from + 3 : from - 4;
        const rookTo = to > from ? from + 1 : from - 1;
        b[rookFrom] = b[rookTo];
        b[rookTo] = 0;
      }
    }
    if ((placed & 7) === KING) this.kings[us >> 3] = from;
  }

  makeNull() {
    const i = this.ply++;
    this.stackMove[i] = NULL_MOVE;
    this.stackCastling[i] = this.castling;
    this.stackEp[i] = this.ep;
    this.stackHalfmove[i] = this.halfmove;
    this.stackBlocked[i] = this.blocked;
    this.stackHashLo[i] = this.hashLo;
    this.stackHashHi[i] = this.hashHi;
    let lo = this.hashLo ^ SIDE_KEY[0];
    let hi = this.hashHi ^ SIDE_KEY[1];
    if (this.ep >= 0) {
      lo ^= EP_KEYS[this.ep * 2];
      hi ^= EP_KEYS[this.ep * 2 + 1];
    }
    for (let k = 0; k < 8; k++) {
      if (this.blocked & (1 << k)) {
        lo ^= BLOCK_KEYS[k * 2];
        hi ^= BLOCK_KEYS[k * 2 + 1];
      }
    }
    this.ep = -1;
    this.blocked = 0;
    this.halfmove++;
    this.hashLo = lo;
    this.hashHi = hi;
    this.side ^= 8;
  }

  /**
   * Whether the game rules call the current position a draw before looking at legal moves:
   * insufficient material, the fifty-move rule, or a repetition. Inside the search one repeat is
   * enough (the side that could avoid it would have), before it the third occurrence counts.
   */
  isRuleDraw(searchStart) {
    if (this.halfmove >= 100) return true;
    if (this.isDead()) return true;
    const lo = this.hashLo;
    const hi = this.hashHi;
    const limit = Math.max(searchStart, this.ply - this.halfmove);
    for (let i = this.ply - 2; i >= limit; i -= 2) {
      if (this.stackMove[i] === NULL_MOVE || this.stackMove[i + 1] === NULL_MOVE) break;
      if (this.stackHashLo[i] === lo && this.stackHashHi[i] === hi) return true;
    }
    return (this.history.get(historyKey(lo, hi)) ?? 0) >= 2;
  }

  /** Mirrors isDeadPosition in src/game/rules.js. */
  isDead() {
    let others = 0;
    let minors = 0;
    let shades = 0;
    for (let sq = 0; sq < 64; sq++) {
      const type = this.board[sq] & 7;
      if (!type || type === KING) continue;
      others++;
      if (type === KNIGHT || type === BISHOP) minors++;
      if (type === BISHOP) shades |= 1 << ((fileOf(sq) + rankOf(sq)) & 1);
      else if (!this.rotations) shades = 3;
    }
    if (others === 0 || (others === 1 && minors === 1)) return true;
    return !this.rotations && shades !== 3;
  }

  isLegal(m) {
    if (!this.make(m)) return false;
    this.unmake();
    return true;
  }

  legalMoves() {
    const buffer = new Int32Array(256);
    const n = this.generate(buffer);
    const legal = [];
    for (let k = 0; k < n; k++) if (this.isLegal(buffer[k])) legal.push(buffer[k]);
    return legal;
  }
}

export function historyKey(lo, hi) {
  return (hi & 0x1fffff) * 4294967296 + (lo >>> 0);
}

function codeOf(piece) {
  return TYPE_NAMES.indexOf(piece.type) | (piece.color === WHITE_NAME ? WHITE : BLACK);
}

/** The same hash as Position for a key produced by positionKey() in src/game/rules.js. */
function hashOfPositionKey(key) {
  const [squares, turn, castling, ep, blocked] = key.split('|');
  const pos = { board: new Int8Array(64), side: WHITE, castling: 0, ep: -1, blocked: 0 };
  squares.split(',').forEach((s, sq) => {
    if (s !== '-') pos.board[sq] = TYPE_NAMES.indexOf(s.slice(1)) | (s[0] === 'w' ? WHITE : BLACK);
  });
  pos.side = turn === WHITE_NAME ? WHITE : BLACK;
  // positionKey lists castling as white king side, white queen side, black king side, black queen side.
  for (let k = 0; k < 4; k++) if (castling[k] === '1') pos.castling |= 1 << k;
  pos.ep = ep === 'null' ? -1 : Number(ep);
  for (const token of blocked ? blocked.split(' ') : []) {
    const band = Number(token[0]);
    pos.blocked |= 1 << (band * 2 + (token.slice(1) === '1' ? 0 : 1));
  }
  Position.prototype.computeHash.call(pos);
  return [pos.hashLo, pos.hashHi];
}

export function moveToAction(m) {
  if (moveKind(m) === ROTATE) {
    return { type: 'rotate', band: moveFrom(m), direction: moveTo(m) === 0 ? 1 : -1 };
  }
  const promotion = movePromotion(m);
  return promotion
    ? { type: 'move', from: moveFrom(m), to: moveTo(m), promotion: TYPE_NAMES[promotion] }
    : { type: 'move', from: moveFrom(m), to: moveTo(m) };
}

export function actionToMove(pos, action) {
  return pos.legalMoves().find((m) => {
    const a = moveToAction(m);
    return (
      a.type === action.type &&
      (a.type === 'rotate'
        ? a.band === action.band && a.direction === action.direction
        : a.from === action.from && a.to === action.to && a.promotion === action.promotion)
    );
  });
}
