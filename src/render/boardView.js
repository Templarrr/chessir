import * as THREE from 'three';
import { BAND_COUNT, BOARD_SIZE, FILES, bandOf, squareCoords } from '../game/board.js';
import { PALETTE } from './palette.js';
import { woodMaterial } from './wood.js';

const HALF = BOARD_SIZE / 2;
const SQUARE_HEIGHT = 0.2;
const FRAME_MARGIN = 0.75;
const FRAME_TOP = -0.06;

export function squareToWorld(index) {
  const { file, rank } = squareCoords(index);
  return new THREE.Vector3(file - HALF + 0.5, 0, HALF - 0.5 - rank);
}

function labelMesh(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = PALETTE.label;
  ctx.font = 'bold 44px Georgia, "Times New Roman", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 32, 34);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4), material);
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

function buildFrame() {
  const size = BOARD_SIZE + FRAME_MARGIN * 2;
  const geometry = new THREE.BoxGeometry(size, 0.45, size);
  const frame = new THREE.Mesh(
    geometry,
    woodMaterial(PALETTE.frame, { seed: 7, repeat: 2, roughness: 0.6 }),
  );
  frame.position.y = FRAME_TOP - 0.45 / 2;
  frame.receiveShadow = true;
  return frame;
}

function buildLabels() {
  const labels = new THREE.Group();
  const offset = HALF + FRAME_MARGIN / 2;
  for (let i = 0; i < BOARD_SIZE; i++) {
    const along = i - HALF + 0.5;
    for (const side of [1, -1]) {
      const file = labelMesh(FILES[i]);
      file.position.set(along, FRAME_TOP + 0.002, side * offset);
      const rank = labelMesh(String(i + 1));
      rank.position.set(side * offset, FRAME_TOP + 0.002, -along);
      // Near labels read from White's seat, far ones from Black's.
      if (side < 0) file.rotation.z = Math.PI;
      if (side > 0) rank.rotation.z = Math.PI;
      labels.add(file, rank);
    }
  }
  return labels;
}

// Thin golden lines on band borders make the rotatable rings readable at a glance.
function buildBandInlays() {
  const inlays = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: PALETTE.inlay,
    roughness: 0.35,
    metalness: 0.5,
  });
  const width = 0.05;
  for (let band = 1; band < BAND_COUNT; band++) {
    const edge = HALF - band;
    const length = edge * 2 + width;
    const horizontal = new THREE.BoxGeometry(length, 0.02, width);
    const vertical = new THREE.BoxGeometry(width, 0.02, length);
    for (const sign of [1, -1]) {
      const h = new THREE.Mesh(horizontal, material);
      h.position.set(0, 0.005, sign * edge);
      const v = new THREE.Mesh(vertical, material);
      v.position.set(sign * edge, 0.005, 0);
      inlays.add(h, v);
    }
  }
  return inlays;
}

/**
 * Squares are grouped per band so a band can later be animated as one rigid ring.
 */
function buildBands() {
  const bands = Array.from({ length: BAND_COUNT }, (_, band) => {
    const group = new THREE.Group();
    group.name = `band-${band}`;
    return group;
  });
  const geometry = new THREE.BoxGeometry(1, SQUARE_HEIGHT, 1);

  for (let index = 0; index < BOARD_SIZE * BOARD_SIZE; index++) {
    const { file, rank } = squareCoords(index);
    const isLight = (file + rank) % 2 === 1;
    const material = woodMaterial(isLight ? PALETTE.lightSquare : PALETTE.darkSquare, {
      seed: isLight ? 3 : 5,
      roughness: 0.5,
      rotation: (index % 3) * 0.04 + (rank % 2 ? Math.PI / 2 : 0),
    });
    material.map.offset.set((index * 0.137) % 1, (index * 0.271) % 1);
    const square = new THREE.Mesh(geometry, material);
    square.position.copy(squareToWorld(index));
    square.position.y = -SQUARE_HEIGHT / 2;
    square.receiveShadow = true;
    square.userData.square = index;
    bands[bandOf(index)].add(square);
  }
  return bands;
}

export function createBoardView() {
  const group = new THREE.Group();
  const bands = buildBands();
  group.add(buildFrame(), buildLabels(), buildBandInlays(), ...bands);
  const edge = HALF + FRAME_MARGIN;
  const bounds = new THREE.Box3(
    new THREE.Vector3(-edge, FRAME_TOP - 0.45, -edge),
    new THREE.Vector3(edge, 1.3, edge),
  );
  return { group, bands, bounds };
}
