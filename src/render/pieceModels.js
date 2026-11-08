import * as THREE from 'three';
import { BISHOP, KING, KNIGHT, PAWN, QUEEN, ROOK, WHITE } from '../game/pieces.js';
import { PALETTE } from './palette.js';
import { woodMaterial } from './wood.js';

const SEGMENTS = 48;
const KNIGHT_TURN = Math.PI / 4;

function arc(cx, cy, r, from, to, steps = 10) {
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const a = from + ((to - from) * i) / steps;
    points.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return points;
}

// Shared foot so every piece stands on the same plinth.
const FOOT = [
  [0, 0],
  [0.34, 0],
  [0.35, 0.04],
  [0.33, 0.08],
  [0.29, 0.1],
  [0.3, 0.13],
  [0.26, 0.15],
];

function lathe(profile) {
  const points = [...FOOT, ...profile].map(([r, y]) => new THREE.Vector2(Math.max(r, 0), y));
  return new THREE.LatheGeometry(points, SEGMENTS);
}

const PROFILES = {
  [PAWN]: [
    [0.2, 0.18],
    [0.14, 0.26],
    [0.11, 0.4],
    [0.1, 0.44],
    [0.19, 0.46],
    [0.19, 0.49],
    [0.11, 0.51],
    ...arc(0, 0.62, 0.14, -Math.PI / 2 + 0.6, Math.PI / 2),
  ],
  [ROOK]: [
    [0.22, 0.2],
    [0.18, 0.3],
    [0.17, 0.62],
    [0.2, 0.66],
    [0.25, 0.7],
    [0.25, 0.86],
    [0.17, 0.86],
    [0.17, 0.8],
    [0, 0.8],
  ],
  [KNIGHT]: [
    [0.22, 0.2],
    [0.2, 0.26],
    [0.24, 0.28],
    [0.24, 0.31],
    [0, 0.31],
  ],
  [BISHOP]: [
    [0.21, 0.19],
    [0.14, 0.3],
    [0.1, 0.6],
    [0.09, 0.64],
    [0.19, 0.66],
    [0.19, 0.69],
    [0.1, 0.71],
    ...arc(0, 0.86, 0.15, -Math.PI / 2 + 0.75, Math.PI / 2 - 0.35, 12),
    [0.05, 1.0],
    ...arc(0, 1.04, 0.045, -Math.PI / 2, Math.PI / 2, 6),
  ],
  [QUEEN]: [
    [0.22, 0.2],
    [0.15, 0.32],
    [0.11, 0.72],
    [0.1, 0.78],
    [0.21, 0.8],
    [0.21, 0.84],
    [0.12, 0.86],
    [0.12, 0.9],
    [0.21, 1.06],
    [0.18, 1.08],
    [0.13, 1.04],
    [0.1, 1.07],
    ...arc(0, 1.13, 0.065, -Math.PI / 2 + 0.4, Math.PI / 2, 8),
  ],
  [KING]: [
    [0.22, 0.2],
    [0.15, 0.32],
    [0.12, 0.78],
    [0.11, 0.84],
    [0.22, 0.86],
    [0.22, 0.9],
    [0.13, 0.92],
    [0.13, 0.95],
    [0.2, 1.08],
    [0.18, 1.12],
    [0.06, 1.14],
    [0, 1.14],
  ],
};

function knightHead() {
  const outline = [
    [-0.2, 0.28],
    [0.21, 0.28],
    [0.16, 0.44],
    [0.09, 0.54],
    [0.24, 0.6],
    [0.33, 0.66],
    [0.36, 0.73],
    [0.32, 0.79],
    [0.19, 0.8],
    [0.14, 0.88],
    [0.08, 0.97],
    [0.03, 1.04],
    [-0.02, 0.98],
    [-0.09, 1.0],
    [-0.12, 0.92],
    [-0.2, 0.84],
    [-0.25, 0.7],
    [-0.26, 0.55],
    [-0.24, 0.4],
  ];
  const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.2,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.03,
    bevelSegments: 3,
  });
  geometry.translate(0, 0, -0.1);
  return geometry;
}

function crenellations() {
  const parts = [];
  const count = 6;
  for (let i = 0; i < count; i++) {
    const merlon = new THREE.BoxGeometry(0.1, 0.08, 0.08);
    merlon.translate(0.21, 0.9, 0);
    merlon.rotateY((i / count) * Math.PI * 2);
    parts.push(merlon);
  }
  return parts;
}

function kingCross() {
  const upright = new THREE.BoxGeometry(0.06, 0.2, 0.06);
  upright.translate(0, 1.23, 0);
  const bar = new THREE.BoxGeometry(0.16, 0.055, 0.06);
  bar.translate(0, 1.25, 0);
  return [upright, bar];
}

function queenCoronet() {
  const parts = [];
  const count = 8;
  for (let i = 0; i < count; i++) {
    const ball = new THREE.SphereGeometry(0.03, 10, 8);
    ball.translate(0.19, 1.09, 0);
    ball.rotateY((i / count) * Math.PI * 2);
    parts.push(ball);
  }
  return parts;
}

const EXTRAS = {
  [ROOK]: crenellations,
  [KNIGHT]: () => [knightHead()],
  [QUEEN]: queenCoronet,
  [KING]: kingCross,
};

const geometryCache = new Map();

function pieceGeometries(type) {
  if (!geometryCache.has(type)) {
    const extras = EXTRAS[type] ? EXTRAS[type]() : [];
    geometryCache.set(type, [lathe(PROFILES[type]), ...extras]);
  }
  return geometryCache.get(type);
}

function createPieceMesh(piece, material) {
  const group = new THREE.Group();
  for (const geometry of pieceGeometries(piece.type)) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  // Knights look toward the opponent at an angle so their owner sees the profile, not the back.
  if (piece.type === KNIGHT) {
    group.rotation.y =
      piece.color === WHITE ? Math.PI / 2 - KNIGHT_TURN : -Math.PI / 2 - KNIGHT_TURN;
  }
  group.userData.pieceId = piece.id;
  return group;
}

export function createWoodenSet() {
  const materials = {
    white: woodMaterial(PALETTE.whitePiece, { seed: 11, roughness: 0.38, repeat: 0.6 }),
    black: woodMaterial(PALETTE.blackPiece, { seed: 13, roughness: 0.3, repeat: 0.6 }),
  };
  return {
    createPieceMesh: (piece) =>
      createPieceMesh(piece, piece.color === WHITE ? materials.white : materials.black),
  };
}
