import * as THREE from 'three';

function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const cache = new Map();

/**
 * Greyscale grain texture meant to be multiplied with a material colour, so one
 * texture serves every wood tone. Generated at runtime to avoid shipping images.
 */
export function woodGrainTexture(seed = 1) {
  if (cache.has(seed)) return cache.get(seed);

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const rand = mulberry32(seed);

  ctx.fillStyle = '#f2f2f2';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 70; i++) {
    const y = rand() * size;
    const amplitude = 2 + rand() * 6;
    const frequency = 0.01 + rand() * 0.03;
    const phase = rand() * Math.PI * 2;
    const shade = Math.floor(185 + rand() * 50);
    ctx.strokeStyle = `rgba(${shade},${shade},${shade},${0.25 + rand() * 0.35})`;
    ctx.lineWidth = 0.6 + rand() * 2.2;
    ctx.beginPath();
    for (let x = -4; x <= size + 4; x += 4) {
      const yy = y + Math.sin(x * frequency + phase) * amplitude;
      if (x === -4) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  cache.set(seed, texture);
  return texture;
}

export function woodMaterial(color, { seed = 1, roughness = 0.55, repeat = 1, rotation = 0 } = {}) {
  const map = woodGrainTexture(seed).clone();
  map.repeat.set(repeat, repeat);
  map.rotation = rotation;
  map.center.set(0.5, 0.5);
  map.needsUpdate = true;
  return new THREE.MeshStandardMaterial({ color, map, roughness, metalness: 0.02 });
}
