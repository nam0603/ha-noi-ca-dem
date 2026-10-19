// Shared coarse footprints, in game units (20 units = 1 rendered metre).
// Small decorative wares stay inside the existing building footprint.
export const INSTRUCTION_BOARD = {
  id: 'instruction-board',
  x: 416,
  y: 786,
  halfX: 1,
  halfY: 20,
  angle: 0,
} as const;

export const CAFE_TABLES = [100, 144, 980, 1040].map((x, i) => ({
  id: `cafe-table-${i}`,
  x,
  y: 246,
  radius: 8,
}));

export const CAFE_STOOL_OFFSETS = [-11, 11] as const;
export const PARKED_SCOOTERS = [220, 280, 580, 1120, 920].map((x, i) => ({
  id: `parked-scooter-${i}`,
  x,
  y: 585,
  angle: 0.47 + i * 0.09,
  halfX: 8.2,
  halfY: 16.4,
  color: ['#a24f3e', '#b6b7a8', '#497e79', '#4d5c72', '#d2bc87'][i],
}));

type CircleFootprint = { id: string; x: number; y: number; radius: number };
type BoxFootprint = {
  id: string;
  x: number;
  y: number;
  halfX: number;
  halfY: number;
  angle: number;
};
export type StreetCollider = CircleFootprint | BoxFootprint;
export const STATIC_PROP_COLLIDERS: readonly StreetCollider[] = [
  INSTRUCTION_BOARD,
  ...CAFE_TABLES,
  ...CAFE_TABLES.flatMap((table) =>
    CAFE_STOOL_OFFSETS.map((offset, i) => ({
      id: `${table.id}-stool-${i}`,
      x: table.x + offset,
      y: table.y + 4,
      halfX: 3.2,
      halfY: 3.2,
      angle: 0,
    })),
  ),
  ...PARKED_SCOOTERS,
];

/** Signed distance to a footprint: positive outside; negative inside. */
export function staticPropClearance(
  prop: StreetCollider,
  x: number,
  y: number,
) {
  const dx = x - prop.x,
    dy = y - prop.y;
  if ('radius' in prop) return Math.hypot(dx, dy) - prop.radius;
  const cos = Math.cos(prop.angle),
    sin = Math.sin(prop.angle),
    localX = Math.abs(cos * dx - sin * dy) - prop.halfX,
    localY = Math.abs(sin * dx + cos * dy) - prop.halfY;
  return (
    Math.hypot(Math.max(localX, 0), Math.max(localY, 0)) +
    Math.min(Math.max(localX, localY), 0)
  );
}

export function staticPropsBlock(x: number, y: number, radius: number) {
  return STATIC_PROP_COLLIDERS.some(
    (prop) => staticPropClearance(prop, x, y) < radius,
  );
}

/**
 * Compatibility repair only: nearest valid projected edge, with a bounded 1-unit
 * radial fallback when that edge meets another solid. Never used for movement.
 */
export function findStaticPropExit(
  x: number,
  y: number,
  radius: number,
  valid: (x: number, y: number) => boolean,
) {
  const maximum = 64;
  let best: { x: number; y: number; distance: number } | undefined;
  const consider = (px: number, py: number) => {
    const distance = Math.hypot(px - x, py - y);
    if (
      distance > maximum ||
      (best && distance >= best.distance) ||
      !valid(px, py)
    )
      return;
    best = { x: px, y: py, distance };
  };
  for (const prop of STATIC_PROP_COLLIDERS) {
    if (staticPropClearance(prop, x, y) >= radius) continue;
    const dx = x - prop.x,
      dy = y - prop.y;
    if ('radius' in prop) {
      const length = Math.hypot(dx, dy),
        reach = prop.radius + radius + 0.05;
      if (length > 1e-8)
        consider(
          prop.x + (dx / length) * reach,
          prop.y + (dy / length) * reach,
        );
      for (const [nx, ny] of [
        [1, 0],
        [0, 1],
        [-1, 0],
        [0, -1],
      ])
        consider(prop.x + nx * reach, prop.y + ny * reach);
    } else {
      const cos = Math.cos(prop.angle),
        sin = Math.sin(prop.angle),
        localX = cos * dx - sin * dy,
        localY = sin * dx + cos * dy,
        edgeX = Math.max(-prop.halfX, Math.min(prop.halfX, localX)),
        edgeY = Math.max(-prop.halfY, Math.min(prop.halfY, localY));
      const project = (px: number, py: number) =>
        consider(prop.x + cos * px + sin * py, prop.y - sin * px + cos * py);
      for (const side of [-1, 1]) {
        project(side * (prop.halfX + radius + 0.05), edgeY);
        project(edgeX, side * (prop.halfY + radius + 0.05));
      }
      const outsideX = localX - edgeX,
        outsideY = localY - edgeY,
        outside = Math.hypot(outsideX, outsideY);
      if (outside > 1e-8)
        project(
          edgeX + (outsideX / outside) * (radius + 0.05),
          edgeY + (outsideY / outside) * (radius + 0.05),
        );
    }
  }
  for (
    let distance = 1;
    distance <= maximum && (!best || distance < best.distance);
    distance++
  )
    for (let i = 0; i < 64; i++) {
      const angle = (i * Math.PI) / 32;
      consider(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance);
    }
  return best ? { x: best.x, y: best.y } : null;
}
