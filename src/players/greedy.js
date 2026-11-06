import { BOARD_SIZE, squareCoords } from '../game/board.js';
import { KING, PAWN, PIECE_VALUES, WHITE, opponent } from '../game/pieces.js';
import { applyAction, attackersOf, legalActions, legalMovesFrom } from '../game/rules.js';

const CHECKMATE_VALUE = 1000;
const REPETITION = 'threefold repetition';

const valueOf = (piece) => PIECE_VALUES[piece.type];

function material(board, color) {
  return board.reduce((sum, p) => (p && p.color === color ? sum + valueOf(p) : sum), 0);
}

/**
 * What `victimColor` stands to lose on `square` if the other side captures there now:
 * the whole piece if nothing defends it, otherwise only what a trade with the cheapest
 * attacker costs.
 */
function captureLoss(board, square, victimColor) {
  const victim = board[square];
  const attackers = attackersOf(board, square, opponent(victimColor));
  if (victim.type === KING || attackers.length === 0) return 0;
  if (attackersOf(board, square, victimColor).length === 0) return valueOf(victim);
  const cheapest = Math.min(...attackers.map((sq) => valueOf(board[sq]) || CHECKMATE_VALUE));
  return Math.max(0, valueOf(victim) - cheapest);
}

function losses(board, victimColor) {
  return board
    .map((p, sq) => (p && p.color === victimColor ? captureLoss(board, sq, victimColor) : 0))
    .filter((loss) => loss > 0);
}

function mobility(state, color) {
  const asMover = { ...state, turn: color, result: null };
  return state.board.reduce(
    (sum, p, sq) => (p && p.color === color ? sum + legalMovesFrom(asMover, sq).length : sum),
    0,
  );
}

/**
 * How far `color`'s pawns have come toward promotion. Squared, so pushing the leading pawn
 * on beats nudging a new one. A pawn carried onto its last rank by a rotation is stuck, so it
 * counts for nothing.
 */
export function pawnProgress(board, color) {
  return board.reduce((sum, p, sq) => {
    if (!p || p.type !== PAWN || p.color !== color) return sum;
    const { rank } = squareCoords(sq);
    const steps = color === WHITE ? rank - 1 : BOARD_SIZE - 2 - rank;
    return steps > 0 && steps < BOARD_SIZE - 2 ? sum + steps * steps : sum;
  }, 0);
}

function advantage(board, color) {
  return material(board, color) - material(board, opponent(color));
}

/** Behind on material, a draw is a good result, so repeating the position is fine. */
export function isLosing(state) {
  return advantage(state.board, state.turn) < 0;
}

/**
 * Scores an action for the side to move, compared most significant first:
 * 1. material won now (captures, promotion) minus the value of own pieces left en prise,
 * 2. the best capture it lines up for the next turn,
 * 3. how far its pawns get toward promotion (a pawn left to be taken already lost on 1.),
 * 4. how many squares its pieces can move to afterwards.
 * Checkmate beats everything; a threefold-repetition draw loses to everything unless the
 * mover is behind on material.
 */
export function scoreAction(state, action) {
  const me = state.turn;
  const them = opponent(me);
  const next = applyAction(state, action);
  if (next.result?.outcome === 'checkmate') return [CHECKMATE_VALUE, 0, 0, 0];
  if (next.result?.reason === REPETITION && !isLosing(state)) return [-CHECKMATE_VALUE, 0, 0, 0];

  const gained = advantage(next.board, me) - advantage(state.board, me);
  const exposed = losses(next.board, me).reduce((a, b) => a + b, 0);
  const threat = Math.max(0, ...losses(next.board, them));
  return [gained - exposed, threat, pawnProgress(next.board, me), mobility(next, me)];
}

function compare(a, b) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

/** Best action by `scoreAction`; ties are broken at random. */
export function chooseGreedyAction(state, random = Math.random) {
  let best = [];
  let bestScore = null;
  for (const action of legalActions(state)) {
    const score = scoreAction(state, action);
    const order = bestScore === null ? 1 : compare(score, bestScore);
    if (order > 0) {
      best = [action];
      bestScore = score;
    } else if (order === 0) {
      best.push(action);
    }
  }
  return best[Math.floor(random() * best.length)];
}

export function createGreedyBot({ thinkMs = 500 } = {}) {
  return {
    name: 'Greedy bot',
    async chooseAction(state) {
      const started = performance.now();
      const action = chooseGreedyAction(state);
      // A short pause so the opponent's last move finishes animating and the reply is visible.
      const wait = thinkMs - (performance.now() - started);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      return action;
    },
  };
}
