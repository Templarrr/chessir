import * as THREE from 'three';
import { WHITE } from '../game/pieces.js';
import { outerContour, simplifyLoop } from './contour.js';
import { ART_BASELINE, ART_SIZE, LINE_WIDTH, drawPieceArt } from './flatPieceArt.js';

// World size of the 45-unit art grid; a king comes out about 0.98 tall, a square is 1.
const SIZE = 1.2;
// How far a fully leaned cut-out slides toward the viewer so it still lies over its own square.
const LEAN_SHIFT = 0.42;
const THICKNESS = 0.12;
const TEXTURE_PX = 512;
const MASK_PX = 256;

const COLORS = {
  white: { body: '#ffffff', outline: '#111111' },
  black: { body: '#161616', outline: '#ffffff' },
};

function canvas(size) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return c;
}

function faceTexture(type, colors) {
  const c = canvas(TEXTURE_PX);
  const ctx = c.getContext('2d');
  // Outline colour all round, so the texture's blurred edge never shows a third colour.
  ctx.fillStyle = colors.outline;
  ctx.fillRect(0, 0, TEXTURE_PX, TEXTURE_PX);
  ctx.scale(TEXTURE_PX / ART_SIZE, TEXTURE_PX / ART_SIZE);
  drawPieceArt(ctx, type, colors);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

// The cut-out shape is traced from the drawing itself, strokes included.
function silhouette(type) {
  const c = canvas(MASK_PX);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.scale(MASK_PX / ART_SIZE, MASK_PX / ART_SIZE);
  drawPieceArt(ctx, type, { body: '#000', outline: '#000' });
  const { data } = ctx.getImageData(0, 0, MASK_PX, MASK_PX);
  const outline = outerContour(MASK_PX, MASK_PX, (x, y) => data[(y * MASK_PX + x) * 4 + 3] > 127);
  // Cell centres sit half a pixel in; shape coordinates run 0..1 with y up, like the texture's UVs.
  const points = simplifyLoop(outline, 0.6).map(
    ([x, y]) => new THREE.Vector2((x + 0.5) / MASK_PX, 1 - (y + 0.5) / MASK_PX),
  );
  return new THREE.Shape(points);
}

const geometryCache = new Map();

function geometry(type) {
  if (!geometryCache.has(type)) {
    const g = new THREE.ExtrudeGeometry(silhouette(type), {
      depth: THICKNESS / SIZE,
      bevelEnabled: false,
    });
    const base = 1 - (ART_BASELINE + LINE_WIDTH / 2) / ART_SIZE;
    g.translate(-0.5, -base, -THICKNESS / SIZE / 2);
    g.scale(SIZE, SIZE, SIZE);
    g.computeVertexNormals();
    geometryCache.set(type, g);
  }
  return geometryCache.get(type);
}

export function createFlatSet() {
  const materials = new Map();
  function materialsFor(type, color) {
    const id = `${type}/${color}`;
    if (!materials.has(id)) {
      const colors = COLORS[color];
      const texture = faceTexture(type, colors);
      materials.set(id, [
        // Partly self-lit, so faces turned away from the sun keep diagram contrast.
        new THREE.MeshStandardMaterial({
          map: texture,
          emissive: '#ffffff',
          emissiveMap: texture,
          emissiveIntensity: 0.35,
          roughness: 0.6,
        }),
        new THREE.MeshStandardMaterial({ color: colors.outline, roughness: 0.6 }),
      ]);
    }
    return materials.get(id);
  }

  function createPieceMesh(piece) {
    const color = piece.color === WHITE ? 'white' : 'black';
    const mesh = new THREE.Mesh(geometry(piece.type), materialsFor(piece.type, color));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const group = new THREE.Group();
    group.add(mesh);
    group.userData.pieceId = piece.id;
    group.userData.cutout = mesh;
    return group;
  }

  return { createPieceMesh };
}

/**
 * Turns every cut-out under `root` square to the view, leaning back on its base as far as the
 * camera looks down, so the pieces read like a diagram from any angle.
 */
export function faceCamera(root, camera) {
  const { x, y, z } = camera.position;
  const heading = Math.atan2(x, z);
  const lean = Math.atan2(y, Math.hypot(x, z));
  const shift = LEAN_SHIFT * Math.sin(lean);
  for (const child of root.children) {
    const { cutout } = child.userData;
    if (!cutout) continue;
    cutout.rotation.set(-lean, heading, 0, 'YXZ');
    cutout.position.set(Math.sin(heading) * shift, 0, Math.cos(heading) * shift);
  }
}
