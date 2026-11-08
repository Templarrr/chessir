import * as THREE from 'three';
import { FRAME_EDGE, FRAME_TOP } from './boardView.js';
import { faceCamera } from './flatPieceModels.js';
import { PALETTE } from './palette.js';
import { woodMaterial } from './wood.js';

const GAP = 0.06;
const TRAY_WIDTH = 0.8;
const TRAY_DEPTH = 0.45;
const TRAY_LENGTH = FRAME_EDGE * 2;
const PIECE_SCALE = 0.72;
const SPACING = 0.52;
const TRAY_CENTER = FRAME_EDGE + GAP + TRAY_WIDTH / 2;
const START = -FRAME_EDGE + 0.5;

/**
 * Where each side's tray lies: `center` of the tray and `along`, the direction its row of
 * pieces grows. "ends" puts the trays in front of and behind the board (portrait screens),
 * "sides" to the right of each player (landscape screens). Rows start at the capturer's left,
 * or on a side tray at the capturer's end.
 */
const LAYOUTS = {
  ends: {
    white: { center: [0, TRAY_CENTER], along: [1, 0] },
    black: { center: [0, -TRAY_CENTER], along: [-1, 0] },
  },
  sides: {
    white: { center: [TRAY_CENTER, 0], along: [0, -1] },
    black: { center: [-TRAY_CENTER, 0], along: [0, 1] },
  },
};

function balanceSprite() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }),
  );
  sprite.scale.set(1.1, 0.55, 1);
  sprite.center.set(0.5, 0);
  sprite.userData.write = (text) => {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = PALETTE.label;
    ctx.font = 'bold 44px Georgia, "Times New Roman", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 64, 34);
    texture.needsUpdate = true;
  };
  return sprite;
}

export function createCapturedView(initialSet) {
  const group = new THREE.Group();
  let set = initialSet;
  const trayMaterial = woodMaterial(PALETTE.frame, { seed: 17, repeat: 2, roughness: 0.6 });
  const sides = {};
  for (const color of ['white', 'black']) {
    const tray = new THREE.Mesh(new THREE.BoxGeometry(1, TRAY_DEPTH, 1), trayMaterial);
    tray.position.y = FRAME_TOP - TRAY_DEPTH / 2;
    tray.receiveShadow = true;
    const pieces = new THREE.Group();
    const balance = balanceSprite();
    group.add(tray, pieces, balance);
    sides[color] = { tray, pieces, balance, captured: [], lead: 0 };
  }
  let layout = 'ends';

  function place(color) {
    const { tray, pieces, balance, captured, lead } = sides[color];
    const { center, along } = LAYOUTS[layout][color];
    const [cx, cz] = center;
    const [ax, az] = along;
    tray.position.x = cx;
    tray.position.z = cz;
    tray.scale.set(ax ? TRAY_LENGTH : TRAY_WIDTH, 1, ax ? TRAY_WIDTH : TRAY_LENGTH);
    const at = (slot) => {
      const offset = START + slot * SPACING;
      return [cx + ax * offset, cz + az * offset];
    };

    pieces.clear();
    captured.forEach((piece, slot) => {
      const mesh = set.createPieceMesh(piece);
      const [x, z] = at(slot);
      mesh.position.set(x, FRAME_TOP, z);
      mesh.scale.setScalar(PIECE_SCALE);
      pieces.add(mesh);
    });

    balance.visible = lead > 0;
    if (lead > 0) {
      // A fixed spot at the far end: right after a row running away from the camera it would hide
      // the pieces behind it.
      const [x, z] = at((FRAME_EDGE - 0.45 - START) / SPACING);
      balance.position.set(x, FRAME_TOP + 0.02, z);
      balance.userData.write(`+${lead}`);
    }
  }

  /** `captured[color]` lists what that side has taken, already sorted; `balance` is White − Black. */
  function show(captured, balance) {
    sides.white.captured = captured.white;
    sides.black.captured = captured.black;
    sides.white.lead = Math.max(balance, 0);
    sides.black.lead = Math.max(-balance, 0);
    place('white');
    place('black');
  }

  /** Switches between "ends" and "sides" and returns the space the trays then take. */
  function setLayout(next) {
    layout = next;
    place('white');
    place('black');
    const reach = TRAY_CENTER + TRAY_WIDTH / 2;
    const ends = layout === 'ends';
    return new THREE.Box3(
      new THREE.Vector3(
        ends ? -FRAME_EDGE : -reach,
        FRAME_TOP - TRAY_DEPTH,
        ends ? -reach : -FRAME_EDGE,
      ),
      new THREE.Vector3(ends ? FRAME_EDGE : reach, 0.7, ends ? reach : FRAME_EDGE),
    );
  }

  function setSet(next) {
    set = next;
    place('white');
    place('black');
  }

  function faceCameraAll(camera) {
    faceCamera(sides.white.pieces, camera);
    faceCamera(sides.black.pieces, camera);
  }

  return { group, show, setLayout, setSet, faceCamera: faceCameraAll };
}
