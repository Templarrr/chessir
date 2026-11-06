import { moveAction, rotateAction } from '../game/actions.js';
import { bandOf } from '../game/board.js';
import { BAND_LETTERS, bandMoveName } from '../game/notation.js';
import { PROMOTIONS, legalMovesFrom, rotationBlockReason } from '../game/rules.js';

const BAND_NAMES = ['outer ring', 'second ring', 'third ring', 'centre'];
const PROMOTION_SYMBOLS = { queen: '♛', rook: '♜', bishop: '♝', knight: '♞' };
const HINT = 'Tap a piece to move it, or any square to turn its ring';

/**
 * A player driven by taps on the board and the HUD buttons. One instance serves both
 * sides for hot-seat play: it answers for whoever's turn it is asked about.
 *
 * `ui` holds the HUD elements; `onSelection` receives what to highlight.
 */
export function createHumanPlayer(ui, onSelection) {
  let state = null;
  let resolve = null;
  let selected = null;
  let moves = [];

  const band = () => (selected === null ? null : bandOf(selected));

  function refresh() {
    const targets = [];
    for (const m of moves) {
      if (!targets.some((t) => t.square === m.to)) {
        targets.push({ square: m.to, capture: Boolean(state.board[m.to]) });
      }
    }
    onSelection({ band: band(), selected, targets });

    const active = resolve !== null && band() !== null;
    ui.bandName.textContent = active
      ? `Turn band ${BAND_LETTERS[band()]} · ${BAND_NAMES[band()]}`
      : HINT;
    let note = '';
    for (const [button, direction] of [
      [ui.rotateCounterClockwise, -1],
      [ui.rotateClockwise, 1],
    ]) {
      const reason = active
        ? rotationBlockReason(state, band(), direction)
        : 'Select a square first';
      button.disabled = reason !== null;
      button.hidden = !active;
      button.title = reason ?? (active ? bandMoveName(band(), direction) : '');
      if (active && reason) note = reason;
    }
    ui.bandNote.textContent = note;
    ui.bandNote.hidden = !note;
  }

  function select(square) {
    selected = square;
    moves = square === null ? [] : legalMovesFrom(state, square);
    refresh();
  }

  function submit(action) {
    const done = resolve;
    resolve = null;
    ui.promotion.hidden = true;
    select(null);
    done(action);
  }

  function choosePromotion(from, to) {
    ui.promotion.replaceChildren(
      ...PROMOTIONS.map((type) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = PROMOTION_SYMBOLS[type];
        button.title = `Promote to ${type}`;
        button.className = state.turn;
        button.addEventListener('click', () => submit(moveAction(from, to, type)));
        return button;
      }),
    );
    ui.promotion.hidden = false;
  }

  function tap(square) {
    if (!resolve) return;
    ui.promotion.hidden = true;
    const options = moves.filter((m) => m.to === square);
    if (options.length > 1) return choosePromotion(options[0].from, square);
    if (options.length === 1) return submit(options[0]);
    select(square === selected ? null : square);
  }

  function rotate(direction) {
    if (resolve && band() !== null && !rotationBlockReason(state, band(), direction)) {
      submit(rotateAction(band(), direction));
    }
  }

  ui.rotateCounterClockwise.addEventListener('click', () => rotate(-1));
  ui.rotateClockwise.addEventListener('click', () => rotate(1));

  return {
    name: 'You',
    tap,
    chooseAction(current) {
      state = current;
      return new Promise((r) => {
        resolve = r;
        select(null);
      });
    },
    /** Abandons a pending choice, e.g. when a new game starts. */
    cancel() {
      resolve = null;
      ui.promotion.hidden = true;
      if (state) select(null);
    },
  };
}
