import * as THREE from 'three';

// Movement beyond this many pixels between press and release is a camera drag, not a tap.
const TAP_TOLERANCE = 8;

/**
 * Calls `onSquare(index)` when the user taps a square or a piece standing on it.
 * `squareOfPiece(id)` maps a hit piece back to its current square.
 */
export function onSquareTap({ canvas, camera, boardView, piecesView, squareOfPiece }, onSquare) {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const squares = boardView.bands.flatMap((band) => band.children);
  let down = null;

  canvas.addEventListener('pointerdown', (event) => {
    down = event.isPrimary ? { x: event.clientX, y: event.clientY } : null;
  });

  canvas.addEventListener('pointerup', (event) => {
    if (!down || Math.hypot(event.clientX - down.x, event.clientY - down.y) > TAP_TOLERANCE) {
      return;
    }
    down = null;
    const rect = canvas.getBoundingClientRect();
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);

    // Pieces first: a tall piece covers the squares behind it on screen.
    const pieceHit = raycaster.intersectObject(piecesView.group, true)[0];
    if (pieceHit) {
      const square = squareOfPiece(piecesView.pieceIdOf(pieceHit.object));
      if (square >= 0) return onSquare(square);
    }
    const squareHit = raycaster.intersectObjects(squares, false)[0];
    if (squareHit) onSquare(squareHit.object.userData.square);
  });
}
