// Edges of a marching-squares cell, as the two corners each one joins: 0 top-left, 1 top-right,
// 2 bottom-right, 3 bottom-left.
const EDGES = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 0],
];
const CORNERS = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];

/**
 * The outer outline of the filled cells of a `width` × `height` grid (`inside(x, y)` → bool),
 * as a closed list of [x, y] points on cell-edge midpoints. Holes are ignored.
 */
export function outerContour(width, height, inside) {
  const at = (x, y) => x >= 0 && y >= 0 && x < width && y < height && inside(x, y);
  // Points are kept as doubled integer coordinates so they can be joined by exact keys.
  const links = new Map();
  const key = (x, y) => `${x},${y}`;
  const link = (a, b) => {
    const ka = key(...a);
    const kb = key(...b);
    if (!links.has(ka)) links.set(ka, { point: a, next: [] });
    if (!links.has(kb)) links.set(kb, { point: b, next: [] });
    links.get(ka).next.push(kb);
    links.get(kb).next.push(ka);
  };
  for (let y = -1; y < height; y++) {
    for (let x = -1; x < width; x++) {
      const filled = CORNERS.map(([dx, dy]) => at(x + dx, y + dy));
      const crossed = [];
      EDGES.forEach(([a, b], edge) => {
        if (filled[a] === filled[b]) return;
        const [ax, ay] = CORNERS[a];
        const [bx, by] = CORNERS[b];
        crossed.push({ edge, point: [2 * x + ax + bx, 2 * y + ay + by] });
      });
      if (crossed.length === 2) {
        link(crossed[0].point, crossed[1].point);
      } else if (crossed.length === 4) {
        // A saddle: keep the two filled corners apart, cutting each off with its own segment.
        const [top, right, bottom, left] = crossed.map((c) => c.point);
        if (filled[0]) {
          link(left, top);
          link(right, bottom);
        } else {
          link(top, right);
          link(bottom, left);
        }
      }
    }
  }

  let best = [];
  let bestArea = 0;
  const visited = new Set();
  for (const start of links.keys()) {
    if (visited.has(start)) continue;
    const loop = [];
    let previous = null;
    let current = start;
    while (!visited.has(current)) {
      visited.add(current);
      const node = links.get(current);
      loop.push(node.point);
      const next = node.next.find((k) => k !== previous && !visited.has(k));
      previous = current;
      if (next === undefined) break;
      current = next;
    }
    const area = Math.abs(signedArea(loop));
    if (area > bestArea) {
      bestArea = area;
      best = loop;
    }
  }
  return best.map(([x, y]) => [x / 2, y / 2]);
}

export function signedArea(points) {
  let sum = 0;
  points.forEach(([x1, y1], i) => {
    const [x2, y2] = points[(i + 1) % points.length];
    sum += x1 * y2 - x2 * y1;
  });
  return sum / 2;
}

function distanceToSegment([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function simplifyOpen(points, tolerance) {
  if (points.length < 3) return points;
  const first = points[0];
  const last = points.at(-1);
  let worst = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = distanceToSegment(points[i], first, last);
    if (d > worst) {
      worst = d;
      index = i;
    }
  }
  if (worst <= tolerance) return [first, last];
  return [
    ...simplifyOpen(points.slice(0, index + 1), tolerance).slice(0, -1),
    ...simplifyOpen(points.slice(index), tolerance),
  ];
}

/** Drops points of a closed outline that stray less than `tolerance` from a straight line. */
export function simplifyLoop(points, tolerance) {
  if (points.length < 4) return points;
  // Split at the point farthest from the first so both halves are proper open curves.
  let far = 0;
  let farDistance = 0;
  points.forEach(([x, y], i) => {
    const d = Math.hypot(x - points[0][0], y - points[0][1]);
    if (d > farDistance) {
      farDistance = d;
      far = i;
    }
  });
  const a = simplifyOpen(points.slice(0, far + 1), tolerance);
  const b = simplifyOpen([...points.slice(far), points[0]], tolerance);
  return [...a.slice(0, -1), ...b.slice(0, -1)];
}
