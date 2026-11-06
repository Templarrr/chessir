import './style.css';
import { createInitialState } from './game/state.js';
import { createBoardView } from './render/boardView.js';
import { createPiecesView } from './render/piecesView.js';
import { createScene } from './render/scene.js';

const container = document.getElementById('app');
const status = document.getElementById('status');

const state = createInitialState();
const board = createBoardView();
const pieces = createPiecesView();
pieces.sync(state.board);

const { scene } = createScene(container, { bounds: board.bounds });
scene.add(board.group, pieces.group);

status.textContent = `${state.turn === 'white' ? 'White' : 'Black'} to move`;
