import { BISHOP, KING, KNIGHT, PAWN, QUEEN, ROOK, opponent } from '../game/pieces.js';
import { applyAction, attackersOf, legalActions, legalMovesFrom } from '../game/rules.js';

export const PIECE_VALUES = {
  [PAWN]: 1,
  [KNIGHT]: 3,
  [BISHOP]: 3,
  [ROOK]: 5,
  [QUEEN]: 9,
  [KING]: 0,
};
const CHECKMATE_VALUE = 1000;

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
 * Scores an action for the side to move, compared most significant first:
 * 1. material won now (captures, promotion) minus the value of own pieces left en prise,
 * 2. the best capture it lines up for the next turn,
 * 3. how many squares its pieces can move to afterwards.
 */
export function scoreAction(state, action) {
  const me = state.turn;
  const them = opponent(me);
  const next = applyAction(state, action);
  if (next.result?.outcome === 'checkmate') return [CHECKMATE_VALUE, 0, 0];

  const advantage = (board) => material(board, me) - material(board, them);
  const gained = advantage(next.board) - advantage(state.board);
  const exposed = losses(next.board, me).reduce((a, b) => a + b, 0);
  const threat = Math.max(0, ...losses(next.board, them));
  return [gained - exposed, threat, mobility(next, me)];
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
