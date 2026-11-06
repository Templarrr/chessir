import * as THREE from 'three';
import { WHITE } from '../game/pieces.js';
import { squareToWorld } from './boardView.js';
import { PALETTE } from './palette.js';
import { createPieceMesh } from './pieceModels.js';
import { woodMaterial } from './wood.js';

export function createPiecesView() {
  const group = new THREE.Group();
  const materials = {
    white: woodMaterial(PALETTE.whitePiece, { seed: 11, roughness: 0.38, repeat: 0.6 }),
    black: woodMaterial(PALETTE.blackPiece, { seed: 13, roughness: 0.32, repeat: 0.6 }),
  };
  const meshes = new Map();

  /** Reconciles meshes with the board by piece id, keeping meshes for pieces that only moved. */
  function sync(board) {
    const seen = new Set();
    board.forEach((piece, index) => {
      if (!piece) return;
      seen.add(piece.id);
      let mesh = meshes.get(piece.id);
      if (!mesh) {
        mesh = createPieceMesh(piece, piece.color === WHITE ? materials.white : materials.black);
        meshes.set(piece.id, mesh);
        group.add(mesh);
      }
      mesh.position.copy(squareToWorld(index));
    });
    for (const [id, mesh] of meshes) {
      if (!seen.has(id)) {
        group.remove(mesh);
        meshes.delete(id);
      }
    }
  }

  return { group, sync };
}
