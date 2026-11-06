import * as THREE from 'three';
import { KNIGHT, WHITE } from '../game/pieces.js';
import { squareToWorld } from './boardView.js';
import { PALETTE } from './palette.js';
import { createPieceMesh } from './pieceModels.js';
import { woodMaterial } from './wood.js';

const ANIMATION_MS = 320;
const KNIGHT_HOP = 0.45;

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

export function createPiecesView() {
  const group = new THREE.Group();
  const materials = {
    white: woodMaterial(PALETTE.whitePiece, { seed: 11, roughness: 0.38, repeat: 0.6 }),
    black: woodMaterial(PALETTE.blackPiece, { seed: 13, roughness: 0.3, repeat: 0.6 }),
  };
  const meshes = new Map();
  let animations = [];
  let leaving = [];

  function createMesh(piece) {
    const mesh = createPieceMesh(piece, piece.color === WHITE ? materials.white : materials.black);
    mesh.userData.type = piece.type;
    meshes.set(piece.id, mesh);
    group.add(mesh);
    return mesh;
  }

  /**
   * Reconciles meshes with the board by piece id, so pieces that only moved keep their
   * mesh and can glide to the new square. Captured pieces stay until the glide ends.
   */
  function sync(board, { animate = false } = {}) {
    const now = performance.now();
    const seen = new Set();
    animations = [];
    board.forEach((piece, index) => {
      if (!piece) return;
      seen.add(piece.id);
      let mesh = meshes.get(piece.id);
      // A promoted pawn keeps its id but needs the new piece's model.
      if (mesh && mesh.userData.type !== piece.type) {
        const position = mesh.position.clone();
        group.remove(mesh);
        mesh = createMesh(piece);
        mesh.position.copy(position);
      }
      if (!mesh) {
        mesh = createMesh(piece);
        mesh.position.copy(squareToWorld(index));
      }
      const target = squareToWorld(index);
      if (animate && !mesh.position.equals(target)) {
        const hop = piece.type === KNIGHT ? KNIGHT_HOP : 0;
        animations.push({ mesh, from: mesh.position.clone(), to: target, start: now, hop });
      } else {
        mesh.position.copy(target);
      }
    });
    for (const mesh of leaving) group.remove(mesh);
    leaving = [];
    for (const [id, mesh] of meshes) {
      if (seen.has(id)) continue;
      meshes.delete(id);
      if (animate) leaving.push(mesh);
      else group.remove(mesh);
    }
  }

  function update(now) {
    if (animations.length === 0 && leaving.length === 0) return;
    let running = false;
    for (const { mesh, from, to, start, hop } of animations) {
      const t = Math.min((now - start) / ANIMATION_MS, 1);
      mesh.position.lerpVectors(from, to, ease(t));
      mesh.position.y = Math.sin(Math.PI * t) * hop;
      if (t < 1) running = true;
    }
    if (!running) {
      animations = [];
      for (const mesh of leaving) group.remove(mesh);
      leaving = [];
    }
  }

  /** The piece id under a ray hit on any part of a piece model, or null. */
  function pieceIdOf(object) {
    for (let o = object; o; o = o.parent) {
      if (o.userData.pieceId !== undefined) return o.userData.pieceId;
    }
    return null;
  }

  return { group, sync, update, pieceIdOf };
}
