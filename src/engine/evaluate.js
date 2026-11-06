import {
  BISHOP,
  KING,
  KNIGHT,
  KING_TARGETS,
  KNIGHT_TARGETS,
  PAWN,
  QUEEN,
  RAYS,
  ROOK,
  WHITE,
} from './position.js';

export const VALUES = [0, 100, 320, 330, 500, 950, 0];

// Piece-square tables from White's side, rank 1 first.
const PST = {
  [PAWN]: [
    0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, -20, -20, 10, 10, 5, 5, -5, -10, 0, 0, -10, -5, 5, 0, 0, 0,
    20, 20, 0, 0, 0, 5, 5, 10, 25, 25, 10, 5, 5, 10, 10, 20, 30, 30, 20, 10, 10, 50, 50, 50, 50, 50,
    50, 50, 50, 0, 0, 0, 0, 0, 0, 0, 0,
  ],
  [KNIGHT]: [
    -50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 5, 5, 0, -20, -40, -30, 5, 10, 15, 15, 10,
    5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 10, 15, 15, 10,
    0, -30, -40, -20, 0, 0, 0, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50,
  ],
  [BISHOP]: [
    -20, -10, -10, -10, -10, -10, -10, -20, -10, 5, 0, 0, 0, 0, 5, -10, -10, 10, 10, 10, 10, 10, 10,
    -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 5, 10, 10, 5, 0, -10,
    -10, 0, 0, 0, 0, 0, 0, -10, -20, -10, -10, -10, -10, -10, -10, -20,
  ],
  [ROOK]: [
    0, 0, 0, 5, 5, 0, 0, 0, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0,
    0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 5, 10, 10, 10, 10, 10, 10, 5, 0, 0,
    0, 0, 0, 0, 0, 0,
  ],
  [QUEEN]: [
    -20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 5, 0, 0, 0, 0, -10, -10, 5, 5, 5, 5, 5, 0, -10, 0,
    0, 5, 5, 5, 5, 0, -5, -5, 0, 5, 5, 5, 5, 0, -5, -10, 0, 5, 5, 5, 5, 0, -10, -10, 0, 0, 0, 0, 0,
    0, -10, -20, -10, -10, -5, -5, -10, -10, -20,
  ],
};
const KING_MIDDLE = [
  20, 30, 10, 0, 0, 10, 30, 20, 20, 20, 0, 0, 0, 0, 20, 20, -10, -20, -20, -20, -20, -20, -20, -10,
  -20, -30, -30, -40, -40, -30, -30, -20, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40,
  -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40,
  -40, -30,
];
const KING_END = [
  -50, -30, -30, -30, -30, -30, -30, -50, -30, -30, 0, 0, 0, 0, -30, -30, -30, -10, 20, 30, 30, 20,
  -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20,
  30, 30, 20, -10, -30, -30, -20, -10, 0, 0, -10, -20, -30, -50, -40, -30, -20, -20, -30, -40, -50,
];
const PHASE = [0, 0, 1, 1, 2, 4, 0];
const MOBILITY = [0, 0, 4, 4, 2, 1, 0];
const TEMPO = 10;

/**
 * Material-only evaluation from the side to move's point of view. The baseline that the
 * other evaluations are measured against.
 */
export function evaluateMaterial(pos) {
  const b = pos.board;
  let score = 0;
  for (let sq = 0; sq < 64; sq++) {
    const p = b[sq];
    if (p) score += p & 8 ? -VALUES[p & 7] : VALUES[p & 7];
  }
  return pos.side === WHITE ? score : -score;
}

function mobility(b, sq, type, them) {
  let count = 0;
  if (type === KNIGHT) {
    for (const t of KNIGHT_TARGETS[sq]) if (!b[t] || (b[t] & 8) === them) count++;
    return count;
  }
  const d0 = type === BISHOP ? 4 : 0;
  const d1 = type === ROOK ? 4 : 8;
  for (let d = d0; d < d1; d++) {
    const ray = RAYS[d][sq];
    for (let i = 0; i < ray.length; i++) {
      const q = b[ray[i]];
      if (q) {
        if ((q & 8) === them) count++;
        break;
      }
      count++;
    }
  }
  return count;
}

/**
 * Material, piece placement, mobility and pawn structure, from the side to move's point of view.
 * Options switch terms on and off for the comparison matches; the defaults won them. Classic
 * king safety lost: rotations carry kings and attackers around too much for it to mean much.
 */
export function createEvaluator({ mobilityWeight = 2, kingSafety = false, kingWeight = 12 } = {}) {
  return function evaluate(pos) {
    const b = pos.board;
    let mg = 0;
    let eg = 0;
    let phase = 0;
    const kings = [0, 0];
    const bishops = [0, 0];
    const pawnFiles = [new Int8Array(8), new Int8Array(8)];
    for (let sq = 0; sq < 64; sq++) {
      const p = b[sq];
      if (!p) continue;
      const type = p & 7;
      const black = p & 8;
      const rel = black ? sq ^ 56 : sq;
      const sign = black ? -1 : 1;
      phase += PHASE[type];
      if (type === KING) {
        kings[black >> 3] = sq;
        mg += sign * KING_MIDDLE[rel];
        eg += sign * KING_END[rel];
        continue;
      }
      let value = VALUES[type] + PST[type][rel];
      if (type === PAWN) {
        // A pawn carried onto its last rank is stuck until a rotation frees it.
        if (rel >= 56) value = 40;
        else pawnFiles[black >> 3][sq & 7]++;
      } else if (mobilityWeight && type !== PAWN) {
        value += mobilityWeight * MOBILITY[type] * (mobility(b, sq, type, black ^ 8) - 4);
      }
      if (type === BISHOP) bishops[black >> 3]++;
      mg += sign * value;
      eg += sign * value;
    }

    for (let sq = 0; sq < 64; sq++) {
      const p = b[sq];
      if ((p & 7) !== PAWN) continue;
      const black = p & 8;
      const side = black >> 3;
      const rel = black ? sq ^ 56 : sq;
      if (rel >= 56) continue;
      const file = sq & 7;
      const sign = black ? -1 : 1;
      if (pawnFiles[side][file] > 1) {
        mg -= sign * 5;
        eg -= sign * 10;
      }
      const isolated =
        (file === 0 || !pawnFiles[side][file - 1]) && (file === 7 || !pawnFiles[side][file + 1]);
      if (isolated) {
        mg -= sign * 10;
        eg -= sign * 15;
      }
      if (isPassed(b, sq, black)) {
        const rank = rel >> 3;
        mg += sign * rank * rank * 2;
        eg += sign * rank * rank * 6;
      }
    }

    for (let side = 0; side < 2; side++) {
      const sign = side ? -1 : 1;
      if (bishops[side] >= 2) {
        mg += sign * 30;
        eg += sign * 45;
      }
      if (kingSafety) {
        // Enemy pieces close to the king, weighted by how dangerous they are.
        const k = kings[side];
        let danger = 0;
        for (const t of KING_TARGETS[k]) {
          const q = b[t];
          if (q && (q & 8) >> 3 !== side) danger += (q & 7) === QUEEN ? 3 : 1;
        }
        for (const t of KNIGHT_TARGETS[k]) if (b[t] === (KNIGHT | ((side ^ 1) << 3))) danger += 2;
        mg -= sign * danger * kingWeight;
      }
    }

    phase = Math.min(phase, 24);
    const score = Math.round((mg * phase + eg * (24 - phase)) / 24);
    return (pos.side === WHITE ? score : -score) + TEMPO;
  };
}

function isPassed(b, sq, black) {
  const file = sq & 7;
  const enemy = PAWN | (black ^ 8);
  const step = black ? -8 : 8;
  for (let s = sq + step; s >= 0 && s < 64; s += step) {
    for (let f = Math.max(0, file - 1); f <= Math.min(7, file + 1); f++) {
      if (b[(s & 56) | f] === enemy) return false;
    }
  }
  return true;
}
