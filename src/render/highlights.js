import * as THREE from 'three';
import { bandSquares } from '../game/board.js';
import { squareToWorld } from './boardView.js';
import { PALETTE } from './palette.js';

// Just above the band inlays so overlays are never hidden by them.
const OVERLAY_Y = 0.018;

function overlayMaterial(color, opacity) {
  return new THREE.MeshBasicMaterial({
    color,
    opacity,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
}

const geometries = {
  square: new THREE.PlaneGeometry(1, 1),
  dot: new THREE.CircleGeometry(0.15, 32),
  ring: new THREE.RingGeometry(0.4, 0.48, 48),
};

const materials = {
  band: overlayMaterial(PALETTE.highlightBand, 0.22),
  lastMove: overlayMaterial(PALETTE.highlightLastMove, 0.32),
  selected: overlayMaterial(PALETTE.highlightSelected, 0.5),
  target: overlayMaterial(PALETTE.highlightTarget, 0.75),
  check: overlayMaterial(PALETTE.highlightCheck, 0.85),
};

export function createHighlights() {
  const group = new THREE.Group();

  function add(geometry, material, square, lift = 0) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.copy(squareToWorld(square));
    mesh.position.y = OVERLAY_Y + lift;
    mesh.renderOrder = 1;
    group.add(mesh);
  }

  /**
   * @param {object} view
   * @param {number|null} view.band  band to tint, e.g. the one a rotation would turn
   * @param {number[]} view.lastMove squares touched by the previous action
   * @param {number|null} view.selected
   * @param {{square: number, capture: boolean}[]} view.targets
   * @param {number|null} view.check square of a king in check
   */
  function show({ band = null, lastMove = [], selected = null, targets = [], check = null }) {
    group.clear();
    if (band !== null)
      for (const sq of bandSquares(band)) add(geometries.square, materials.band, sq);
    for (const sq of lastMove) add(geometries.square, materials.lastMove, sq, 0.001);
    if (check !== null) add(geometries.square, materials.check, check, 0.002);
    if (selected !== null) add(geometries.square, materials.selected, selected, 0.003);
    for (const { square, capture } of targets) {
      add(capture ? geometries.ring : geometries.dot, materials.target, square, 0.004);
    }
  }

  return { group, show };
}
