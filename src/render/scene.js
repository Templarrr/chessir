import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const FOV = 38;
// Seen from White's side; narrow portrait screens get a steeper view so the board fills them.
function defaultViewDirection(aspect) {
  const height = aspect < 1 ? 1.35 + (1 - aspect) * 1.6 : 1.35;
  return new THREE.Vector3(0, height, 1).normalize();
}

/** `boundsFor(aspect)` returns the box that must stay on screen at that aspect ratio. */
export function createScene(container, { boundsFor }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 200);

  scene.add(new THREE.HemisphereLight('#fff3dc', '#3a2412', 1.1));
  const sun = new THREE.DirectionalLight('#ffe4b8', 2.2);
  sun.position.set(-6, 12, 7);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -7;
  sun.shadow.camera.right = 7;
  sun.shadow.camera.top = 7;
  sun.shadow.camera.bottom = -7;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);
  const fill = new THREE.DirectionalLight('#ffd9a8', 0.5);
  fill.position.set(7, 5, -6);
  scene.add(fill);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.minPolarAngle = 0.05;
  controls.maxPolarAngle = 1.3;
  let userMovedCamera = false;
  controls.addEventListener('start', () => {
    userMovedCamera = true;
  });

  // Closest distance along `direction` at which every corner of the bounds is on screen.
  function fitDistance(direction, bounds) {
    const corners = [];
    for (const x of [bounds.min.x, bounds.max.x])
      for (const y of [bounds.min.y, bounds.max.y])
        for (const z of [bounds.min.z, bounds.max.z]) corners.push(new THREE.Vector3(x, y, z));
    const probe = camera.clone();
    const point = new THREE.Vector3();
    const fits = (distance) => {
      probe.position.copy(direction).multiplyScalar(distance);
      probe.lookAt(0, 0, 0);
      probe.updateMatrixWorld();
      return corners.every((corner) => {
        point.copy(corner).project(probe);
        return Math.abs(point.x) <= 0.96 && point.y <= 0.84 && point.y >= -0.74;
      });
    };
    let near = 1;
    let far = 200;
    for (let i = 0; i < 30; i++) {
      const mid = (near + far) / 2;
      if (fits(mid)) far = mid;
      else near = mid;
    }
    return far;
  }

  function resize() {
    const width = Math.max(container.clientWidth, 1);
    const height = Math.max(container.clientHeight, 1);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    const defaultDirection = defaultViewDirection(camera.aspect);
    const distance = fitDistance(defaultDirection, boundsFor(camera.aspect));
    controls.minDistance = distance * 0.45;
    controls.maxDistance = distance * 1.6;
    const direction = userMovedCamera ? camera.position.clone().normalize() : defaultDirection;
    camera.position.copy(direction).multiplyScalar(distance);
    controls.update();
  }

  new ResizeObserver(resize).observe(container);
  resize();

  const frameListeners = [];
  renderer.setAnimationLoop((time) => {
    for (const listener of frameListeners) listener(time);
    controls.update();
    renderer.render(scene, camera);
  });

  const onFrame = (listener) => frameListeners.push(listener);
  return { scene, camera, renderer, controls, onFrame };
}
