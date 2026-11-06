import './style.css';
import { bandSquares } from './game/board.js';
import { notate } from './game/notation.js';
import { capturedPieces, materialBalance, sortByValue } from './game/material.js';
import { opponent } from './game/pieces.js';
import { applyAction, checkers, findKing, newGame } from './game/rules.js';
import { createBoardView } from './render/boardView.js';
import { createCapturedView } from './render/capturedView.js';
import { createHighlights } from './render/highlights.js';
import { onSquareTap } from './render/picking.js';
import { createPiecesView } from './render/piecesView.js';
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

let state = newGame();
let moves = [];
let captured = { white: [], black: [] };
let game = 0;

const notation = createNotationPanel({
  panel: $('notation'),
  toggle: $('notation-toggle'),
  list: $('notation-list'),
  copy: $('notation-copy'),
});

const capitalize = (s) => s[0].toUpperCase() + s.slice(1);

function lastActionSquares(action) {
  if (!action) return [];
  return action.type === 'move' ? [action.from, action.to] : bandSquares(action.band);
}

function showSelection(selection = {}) {
  const inCheck = checkers(state).length > 0;
  highlights.show({
    lastMove: lastActionSquares(state.lastAction),
    check: inCheck ? findKing(state.board, state.turn) : null,
    ...selection,
  });
}

function showCaptured() {
  capturedView.show(captured, materialBalance(state.board));
}

function showStatus() {
  const { result } = state;
  if (!result) {
    const check = checkers(state).length > 0 ? ' · Check!' : '';
    status.textContent = `${capitalize(state.turn)} to move${check}`;
  } else if (result.outcome === 'checkmate') {
    status.textContent = `Checkmate · ${capitalize(result.winner)} wins`;
  } else {
    status.textContent = `Draw by ${result.reason}`;
  }
  if (result) $('band-name').textContent = 'Game over · start a new game to play again';
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
    if (!state.result && state.turn === color) {
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
    squareOfPiece: (id) => state.board.findIndex((p) => p && p.id === id),
  },
  (square) => human.tap(square),
);

async function play() {
  const current = ++game;
  while (!state.result) {
    const player = players[state.turn];
    if (player !== human) $('band-name').textContent = `${player.name} is thinking…`;
    const action = await player.chooseAction(state);
    if (current !== game) return;
    const next = applyAction(state, action);
    moves = [...moves, notate(state, action, next)];
    for (const piece of capturedPieces(state.board, next.board)) {
      const by = opponent(piece.color);
      captured = { ...captured, [by]: sortByValue([...captured[by], piece]) };
    }
    state = next;
    notation.show(moves, state.result);
    piecesView.sync(state.board, { animate: true });
    showCaptured();
    showStatus();
    showSelection();
  }
}

function startGame() {
  human.cancel();
  for (const player of Object.values(players)) if (player !== human) player.cancel?.();
  state = newGame();
  moves = [];
  captured = { white: [], black: [] };
  notation.show(moves, null);
  piecesView.sync(state.board);
  showCaptured();
  showStatus();
  showSelection();
  play();
}

$('new-game').addEventListener('click', startGame);
startGame();

// Lets the screenshot script drive the game without simulating pointer events.
window.chessir = { tap: (square) => human.tap(square), getState: () => state };
