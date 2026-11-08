import './style.css';
import { createSoundPlayer } from './audio/player.js';
import { soundFor } from './audio/soundFor.js';
import { bandSquares } from './game/board.js';
import { movesOf, recordAction, startHistory, truncateHistory } from './game/history.js';
import { materialBalance } from './game/material.js';
import { checkers, findKing, newGame } from './game/rules.js';
import { createBoardView } from './render/boardView.js';
import { createCapturedView } from './render/capturedView.js';
import { createHighlights } from './render/highlights.js';
import { onSquareTap } from './render/picking.js';
import { ANIMATION_MS, createPiecesView } from './render/piecesView.js';
import { createScene } from './render/scene.js';
import { createHumanPlayer } from './players/human.js';
import { PLAYER_KINDS } from './players/index.js';
import { createNotationPanel } from './ui/notationPanel.js';

const $ = (id) => document.getElementById(id);
const status = $('status');

const boardView = createBoardView();
const piecesView = createPiecesView();
const highlights = createHighlights();
const capturedView = createCapturedView();
// Wide screens have room beside the board for the captured pieces, tall ones above and below.
const { scene, camera, renderer, onFrame } = createScene($('app'), {
  boundsFor: (aspect) =>
    boardView.bounds.clone().union(capturedView.setLayout(aspect > 1.15 ? 'sides' : 'ends')),
});
scene.add(boardView.group, highlights.group, piecesView.group, capturedView.group);
onFrame((time) => piecesView.update(time));

const sound = createSoundPlayer();
const soundToggle = $('sound-toggle');
function showSoundToggle() {
  soundToggle.textContent = sound.muted ? 'Sound: off' : 'Sound: on';
  soundToggle.setAttribute('aria-pressed', String(!sound.muted));
}
soundToggle.addEventListener('click', () => {
  sound.setMuted(!sound.muted);
  showSoundToggle();
});
showSoundToggle();

let history = startHistory(newGame());
// Index of the history entry on the board; below the last one the board is view-only.
let viewing = 0;
let game = 0;

const live = () => history.at(-1).state;
const shown = () => history[viewing].state;
const browsing = () => viewing < history.length - 1;

const notation = createNotationPanel(
  {
    panel: $('notation'),
    toggle: $('notation-toggle'),
    list: $('notation-list'),
    copy: $('notation-copy'),
    first: $('history-first'),
    back: $('history-back'),
    forward: $('history-forward'),
    last: $('history-last'),
    reset: $('history-reset'),
  },
  { goTo, resetHere },
);

const capitalize = (s) => s[0].toUpperCase() + s.slice(1);

function lastActionSquares(action) {
  if (!action) return [];
  return action.type === 'move' ? [action.from, action.to] : bandSquares(action.band);
}

function showSelection(selection = {}) {
  const state = shown();
  const inCheck = checkers(state).length > 0;
  highlights.show({
    lastMove: lastActionSquares(state.lastAction),
    check: inCheck ? findKing(state.board, state.turn) : null,
    ...selection,
  });
}

function showCaptured() {
  const { captured, state } = history[viewing];
  capturedView.show(captured, materialBalance(state.board));
}

function showStatus() {
  const state = shown();
  const { result } = state;
  if (!result) {
    const check = checkers(state).length > 0 ? ' · Check!' : '';
    status.textContent = `${capitalize(state.turn)} to move${check}`;
  } else if (result.outcome === 'checkmate') {
    status.textContent = `Checkmate · ${capitalize(result.winner)} wins`;
  } else {
    status.textContent = `Draw by ${result.reason}`;
  }
  if (browsing()) {
    $('band-name').textContent =
      `Viewing move ${viewing} of ${history.length - 1} · ⏭ to return, or reset here`;
  } else if (result) {
    $('band-name').textContent = 'Game over · start a new game to play again';
  }
  status.dataset.turn = state.result ? '' : state.turn;
}

const human = createHumanPlayer(
  {
    bandName: $('band-name'),
    bandNote: $('band-note'),
    rotateClockwise: $('rotate-cw'),
    rotateCounterClockwise: $('rotate-ccw'),
    promotion: $('promotion'),
  },
  showSelection,
);
const DEFAULT_KINDS = { white: 'human', black: 'greedy' };
const players = {};

function savedKind(color) {
  try {
    const id = localStorage.getItem(`chessir.player.${color}`);
    if (PLAYER_KINDS.some((k) => k.id === id)) return id;
  } catch {
    // Storage can be unavailable (private mode); fall back to the default.
  }
  return DEFAULT_KINDS[color];
}

function setPlayer(color, id) {
  const kind = PLAYER_KINDS.find((k) => k.id === id);
  if (players[color] !== human) players[color]?.cancel?.();
  players[color] = kind.create ? kind.create() : human;
  try {
    localStorage.setItem(`chessir.player.${color}`, id);
  } catch {
    // Not remembering the choice is fine.
  }
}

for (const color of ['white', 'black']) {
  const select = $(`player-${color}`);
  select.replaceChildren(...PLAYER_KINDS.map((k) => new Option(k.label, k.id)));
  select.value = savedKind(color);
  setPlayer(color, select.value);
  select.addEventListener('change', () => {
    setPlayer(color, select.value);
    // Whoever was asked to move for this side no longer gets a say; ask the new player.
    if (!browsing() && !live().result && live().turn === color) {
      human.cancel();
      play();
    }
  });
}

onSquareTap(
  {
    canvas: renderer.domElement,
    camera,
    boardView,
    piecesView,
    squareOfPiece: (id) => shown().board.findIndex((p) => p && p.id === id),
  },
  (square) => human.tap(square),
);

// After an animated change the next move waits until the glide and clack are over, so a fast
// bot never sets a second piece moving while the first is still on its way.
const SETTLE_MS = ANIMATION_MS + 250;
let settledAt = 0;
const settled = () =>
  new Promise((resolve) => setTimeout(resolve, Math.max(0, settledAt - performance.now())));

function showPosition({ animate = false } = {}) {
  settledAt = animate ? performance.now() + SETTLE_MS : 0;
  notation.show(movesOf(history), live().result, viewing);
  piecesView.sync(shown().board, { animate });
  showCaptured();
  showStatus();
  showSelection();
}

async function play() {
  const current = ++game;
  while (!live().result) {
    const state = live();
    const player = players[state.turn];
    if (player !== human) $('band-name').textContent = `${player.name} is thinking…`;
    const action = await player.chooseAction(state);
    if (current !== game) return;
    await settled();
    if (current !== game) return;
    history = recordAction(history, action);
    viewing = history.length - 1;
    sound.play(soundFor(state, action, live()));
    showPosition({ animate: true });
  }
}

// Stops whoever is choosing a move; play() picks up again from the live position.
function pause() {
  game++;
  human.cancel();
  for (const player of Object.values(players)) if (player !== human) player.cancel?.();
}

function goTo(index) {
  index = Math.max(0, Math.min(index, history.length - 1));
  if (index === viewing) return;
  const wasLive = !browsing();
  viewing = index;
  if (wasLive) pause();
  showPosition({ animate: true });
  if (!browsing()) play();
}

function resetHere() {
  if (!browsing()) return;
  history = truncateHistory(history, viewing);
  showPosition();
  play();
}

function startGame() {
  pause();
  history = startHistory(newGame());
  viewing = 0;
  showPosition();
  play();
}

const KEY_STEPS = {
  ArrowLeft: () => goTo(viewing - 1),
  ArrowRight: () => goTo(viewing + 1),
  Home: () => goTo(0),
  End: () => goTo(history.length - 1),
};
document.addEventListener('keydown', (event) => {
  const step = KEY_STEPS[event.key];
  if (!step || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.target.closest?.('select, input, textarea')) return;
  event.preventDefault();
  step();
});

$('new-game').addEventListener('click', startGame);
startGame();

// Lets the screenshot script drive the game without simulating pointer events.
window.chessir = { tap: (square) => human.tap(square), getState: live, goTo };
