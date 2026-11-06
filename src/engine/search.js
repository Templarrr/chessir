import { VALUES, createEvaluator } from './evaluate.js';
import {
  CASTLE,
  KING,
  MAX_PLY,
  PAWN,
  ROTATE,
  moveFrom,
  moveKind,
  movePromotion,
  moveTo,
} from './position.js';

export const MATE = 32000;
const MATE_BOUND = MATE - MAX_PLY;
const INFINITY = 32700;
const EXACT = 0;
const LOWER = 1;
const UPPER = 2;
const MAX_MOVES = 256;

const isMateScore = (score) => Math.abs(score) >= MATE_BOUND;

/**
 * Alpha-beta search with iterative deepening, a transposition table, quiescence search,
 * null-move pruning and late-move reductions. Band rotations are ordinary moves to it, so it
 * plans with them for both sides like with any other move.
 */
export function createSearcher({
  evaluate = createEvaluator(),
  ttBits = 20,
  rotations = true,
  nullMove = true,
  lmr = true,
  contempt = 15,
  keepTable = true,
  now = () => performance.now(),
} = {}) {
  const ttSize = 1 << ttBits;
  const ttMask = ttSize - 1;
  const ttCheck = new Int32Array(ttSize);
  const ttMove = new Int32Array(ttSize);
  const ttScore = new Int32Array(ttSize);
  const ttDepth = new Int8Array(ttSize);
  const ttFlag = new Uint8Array(ttSize);

  const moves = Array.from({ length: MAX_PLY + 1 }, () => new Int32Array(MAX_MOVES));
  const scores = Array.from({ length: MAX_PLY + 1 }, () => new Int32Array(MAX_MOVES));
  const killers = new Int32Array((MAX_PLY + 1) * 2);
  const history = new Int32Array(16 * 64 * 64 + 8);

  let pos;
  let nodes = 0;
  let stopAt = 0;
  let stopped = false;
  let rootSide = 0;

  function drawScore(ply) {
    return ply % 2 === 0 ? -contempt : contempt;
  }

  function historyIndex(m) {
    if (moveKind(m) === ROTATE) return 16 * 64 * 64 + moveFrom(m) * 2 + moveTo(m);
    return (pos.board[moveFrom(m)] * 64 + moveFrom(m)) * 64 + moveTo(m);
  }

  function orderMoves(list, scoreList, n, ttBest, ply) {
    const b = pos.board;
    for (let i = 0; i < n; i++) {
      const m = list[i];
      if (m === ttBest) {
        scoreList[i] = 1 << 30;
        continue;
      }
      const kind = moveKind(m);
      if (kind === ROTATE) {
        scoreList[i] = history[historyIndex(m)];
        continue;
      }
      const victim = kind === 2 ? PAWN : b[moveTo(m)] & 7;
      const promotion = movePromotion(m);
      if (victim || promotion) {
        scoreList[i] =
          (1 << 28) + VALUES[victim] * 16 + VALUES[promotion] * 16 - (b[moveFrom(m)] & 7);
      } else if (m === killers[ply * 2]) {
        scoreList[i] = (1 << 27) + 1;
      } else if (m === killers[ply * 2 + 1]) {
        scoreList[i] = 1 << 27;
      } else {
        scoreList[i] = history[historyIndex(m)];
      }
    }
  }

  function pickNext(list, scoreList, i, n) {
    let best = i;
    for (let j = i + 1; j < n; j++) if (scoreList[j] > scoreList[best]) best = j;
    if (best !== i) {
      const m = list[i];
      list[i] = list[best];
      list[best] = m;
      const s = scoreList[i];
      scoreList[i] = scoreList[best];
      scoreList[best] = s;
    }
    return list[i];
  }

  function checkTime() {
    if ((++nodes & 1023) === 0 && now() >= stopAt) stopped = true;
  }

  function skipRotation(m) {
    return !rotations && pos.side === rootSide && moveKind(m) === ROTATE;
  }

  function quiesce(alpha, beta, ply) {
    checkTime();
    if (stopped) return 0;
    const inCheck = pos.inCheck();
    if (ply >= MAX_PLY - 1) return inCheck ? 0 : evaluate(pos);
    let best = -INFINITY;
    if (!inCheck) {
      best = evaluate(pos);
      if (best >= beta) return best;
      if (best > alpha) alpha = best;
    }
    const list = moves[ply];
    const scoreList = scores[ply];
    const n = pos.generate(list, !inCheck);
    orderMoves(list, scoreList, n, 0, ply);
    let legal = 0;
    for (let i = 0; i < n; i++) {
      const m = pickNext(list, scoreList, i, n);
      if (!inCheck) {
        // Captures that cannot lift the score to alpha even when the piece comes free.
        const gain = VALUES[pos.board[moveTo(m)] & 7] + VALUES[movePromotion(m)];
        if (best + gain + 200 <= alpha && !movePromotion(m)) continue;
      } else if (skipRotation(m)) continue;
      if (!pos.make(m)) continue;
      legal++;
      const score = -quiesce(-beta, -alpha, ply + 1);
      pos.unmake();
      if (stopped) return 0;
      if (score > best) {
        best = score;
        if (score > alpha) {
          alpha = score;
          if (score >= beta) return score;
        }
      }
    }
    if (inCheck && legal === 0) return -MATE + ply;
    return best;
  }

  function hasPieces(side) {
    const b = pos.board;
    for (let sq = 0; sq < 64; sq++) {
      const p = b[sq];
      if (p && (p & 8) === side && (p & 7) !== PAWN && (p & 7) !== KING) return true;
    }
    return false;
  }

  function search(depth, alpha, beta, ply, allowNull) {
    const pvNode = beta - alpha > 1;
    if (ply > 0) {
      checkTime();
      if (stopped) return 0;
      if (pos.isRuleDraw(0)) return drawScore(ply);
      alpha = Math.max(alpha, -MATE + ply);
      beta = Math.min(beta, MATE - ply - 1);
      if (alpha >= beta) return alpha;
    }
    const inCheck = pos.inCheck();
    if (inCheck) depth++;
    if (depth <= 0 || ply >= MAX_PLY - 1) return quiesce(alpha, beta, ply);

    const slot = pos.hashLo & ttMask;
    let ttBest = 0;
    if (ttCheck[slot] === pos.hashHi && ttFlag[slot] !== 255) {
      ttBest = ttMove[slot];
      if (!pvNode && ttDepth[slot] >= depth && ply > 0) {
        let s = ttScore[slot];
        if (s >= MATE_BOUND) s -= ply;
        else if (s <= -MATE_BOUND) s += ply;
        const flag = ttFlag[slot];
        if (flag === EXACT || (flag === LOWER && s >= beta) || (flag === UPPER && s <= alpha)) {
          return s;
        }
      }
    }

    const staticEval = inCheck ? -INFINITY : evaluate(pos);
    if (!pvNode && !inCheck && ply > 0) {
      if (depth <= 3 && staticEval - 120 * depth >= beta && !isMateScore(beta)) return staticEval;
      if (
        nullMove &&
        allowNull &&
        depth >= 3 &&
        staticEval >= beta &&
        !isMateScore(beta) &&
        hasPieces(pos.side)
      ) {
        const r = 2 + (depth >> 2);
        pos.makeNull();
        const score = -search(depth - 1 - r, -beta, -beta + 1, ply + 1, false);
        pos.unmake();
        if (stopped) return 0;
        if (score >= beta) return isMateScore(score) ? beta : score;
      }
    }

    const list = moves[ply];
    const scoreList = scores[ply];
    const n = pos.generate(list);
    orderMoves(list, scoreList, n, ttBest, ply);
    const alphaStart = alpha;
    let best = -INFINITY;
    let bestMove = 0;
    let legal = 0;
    for (let i = 0; i < n; i++) {
      const m = pickNext(list, scoreList, i, n);
      if (skipRotation(m)) continue;
      if (!pos.make(m)) continue;
      legal++;
      const kind = moveKind(m);
      const quiet =
        (kind === ROTATE || !pos.stackCaptured[pos.ply - 1]) && !movePromotion(m) && kind !== 2;
      let score;
      if (legal === 1) {
        score = -search(depth - 1, -beta, -alpha, ply + 1, true);
      } else {
        let reduction = 0;
        if (lmr && depth >= 3 && legal > 3 && quiet && !inCheck && kind !== CASTLE) {
          reduction = 1 + (legal > 10 ? 1 : 0) + (depth > 7 ? 1 : 0);
          if (pvNode) reduction--;
          if (scoreList[i] >= 1 << 27) reduction = 0;
        }
        score = -search(depth - 1 - reduction, -alpha - 1, -alpha, ply + 1, true);
        if (score > alpha && reduction > 0) {
          score = -search(depth - 1, -alpha - 1, -alpha, ply + 1, true);
        }
        if (score > alpha && score < beta) {
          score = -search(depth - 1, -beta, -alpha, ply + 1, true);
        }
      }
      pos.unmake();
      if (stopped) return 0;
      if (score > best) {
        best = score;
        bestMove = m;
        if (score > alpha) {
          alpha = score;
          if (ply === 0) rootBest = m;
          if (score >= beta) {
            if (quiet) {
              if (killers[ply * 2] !== m) {
                killers[ply * 2 + 1] = killers[ply * 2];
                killers[ply * 2] = m;
              }
              const h = historyIndex(m);
              history[h] += depth * depth;
              if (history[h] > 1 << 24) for (let k = 0; k < history.length; k++) history[k] >>= 1;
            }
            break;
          }
        }
      }
    }
    if (legal === 0) return inCheck ? -MATE + ply : drawScore(ply);

    const flag = best >= beta ? LOWER : best > alphaStart ? EXACT : UPPER;
    let stored = best;
    if (stored >= MATE_BOUND) stored += ply;
    else if (stored <= -MATE_BOUND) stored -= ply;
    if (ttFlag[slot] === 255 || ttCheck[slot] !== pos.hashHi || depth >= ttDepth[slot] - 2) {
      ttCheck[slot] = pos.hashHi;
      ttMove[slot] = bestMove;
      ttScore[slot] = stored;
      ttDepth[slot] = depth;
      ttFlag[slot] = flag;
    }
    return best;
  }

  let rootBest = 0;
  let thought = false;

  /**
   * Thinks about `position` and returns the best move found. Stops starting new iterations
   * after `softMs` and aborts the current one at `hardMs`.
   */
  function think(position, { softMs = 1000, hardMs = softMs * 3, maxDepth = 64, onDepth } = {}) {
    pos = position;
    rootSide = pos.side;
    const start = now();
    stopAt = start + hardMs;
    stopped = false;
    nodes = 0;
    killers.fill(0);
    for (let k = 0; k < history.length; k++) history[k] >>= 3;
    if (!keepTable || !thought) ttFlag.fill(255);
    thought = true;

    const legal = pos.legalMoves();
    let candidates = legal.filter((m) => !skipRotation(m));
    if (candidates.length === 0) {
      if (legal.length === 0) return { move: 0, score: 0, depth: 0, nodes };
      candidates = legal;
    }
    let bestMove = candidates[0];
    let bestScore = 0;
    let depthDone = 0;
    if (candidates.length === 1) return { move: bestMove, score: 0, depth: 0, nodes };

    let soft = softMs;
    for (let depth = 1; depth <= maxDepth; depth++) {
      rootBest = 0;
      let window = 30;
      let alpha = depth >= 4 ? bestScore - window : -INFINITY;
      let beta = depth >= 4 ? bestScore + window : INFINITY;
      let score;
      for (;;) {
        score = search(depth, alpha, beta, 0, false);
        if (stopped) break;
        if (score <= alpha) {
          alpha = Math.max(-INFINITY, alpha - window);
          window *= 2;
        } else if (score >= beta) {
          beta = Math.min(INFINITY, beta + window);
          window *= 2;
        } else break;
        if (window > 1000) {
          alpha = -INFINITY;
          beta = INFINITY;
        }
      }
      if (stopped) {
        // A move that already beat the previous best in the unfinished iteration is trusted.
        if (rootBest && rootBest !== bestMove && score !== undefined) bestMove = rootBest;
        break;
      }
      const changed = rootBest && rootBest !== bestMove;
      const dropped = depthDone > 0 && score < bestScore - 40;
      if (rootBest) bestMove = rootBest;
      bestScore = score;
      depthDone = depth;
      onDepth?.({ depth, score, nodes, move: bestMove, ms: now() - start });
      if (isMateScore(score) && depth > 2 && MATE - Math.abs(score) <= depth) break;
      // Spend longer when the answer is still moving; stop when another iteration will not fit.
      if (changed || dropped) soft = Math.min(hardMs, soft * 1.3);
      if (now() - start > soft * 0.55) break;
    }
    return { move: bestMove, score: bestScore, depth: depthDone, nodes, ms: now() - start };
  }

  /** Quiescence score of `position` for the side to move, for leaf evaluation elsewhere. */
  function quietScore(position) {
    pos = position;
    rootSide = pos.side;
    stopped = false;
    stopAt = Infinity;
    return quiesce(-INFINITY, INFINITY, 0);
  }

  return { think, quietScore };
}
