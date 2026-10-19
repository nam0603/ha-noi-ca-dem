import {
  STATIC_PROP_COLLIDERS,
  findStaticPropExit,
  staticPropClearance,
  staticPropsBlock,
} from './street-colliders';

export type Season = 'autumn' | 'rain' | 'mixed';
export type Pace = 'shift' | 'relaxed';
export type Tool = 'broom' | 'scoop';
export type Input = {
  x: number;
  y: number;
  work: boolean;
  sprint: boolean;
  mask: boolean;
  yaw?: number;
  pitch?: number;
  crouch?: boolean;
  grab?: boolean;
  tool?: Tool;
  ping?: boolean;
};
export type InputFrame = { input: Input; dt: number };
// A bounded recent history compensates normal HTTP round trips, never an outage.
export const INPUT_HISTORY_SECONDS = 1;
export const INPUT_STALE_SECONDS = 1.5;
export const INPUT_HISTORY_FRAMES = 32;
export type Player = {
  id: string;
  name: string;
  x: number;
  y: number;
  bag: number;
  headache: number;
  mask: number;
  cooldown: number;
  score: number;
  color: number;
  face: number;
  pitch: number;
  crouched: boolean;
  pushing: string | null;
  working: boolean;
  tool: Tool;
  swept: number;
  picked: number;
  cleared: number;
  cartDistance: number;
  lastSeen: number;
  lastInput: number;
  seq: number;
  action: WorkAction | null;
  actionAt: number;
  actionAmount: number;
  actionSeq: number;
  lastPing: number;
  dumped: number;
};
export type WorkAction = 'sweep' | 'scoop' | 'dump' | 'deliver' | 'drain';
export type Zone = {
  id: number;
  name: string;
  minX: number;
  maxX: number;
  picked: number;
  completedAt: number | null;
  cleanUntil: number;
};
export type Ping = {
  playerId: string;
  x: number;
  y: number;
  kind: 'help' | 'cart' | 'drain';
  expiresAt: number;
};
export type Leaf = {
  id: number;
  x: number;
  y: number;
  hp: number;
  kind: number;
  zone?: number;
};
export type Pile = {
  id: number;
  x: number;
  y: number;
  amount: number;
  progress: number;
  zone?: number;
};
export type Drain = { x: number; y: number; clog: number; water: number };
export type Cart = {
  id: string;
  x: number;
  y: number;
  face: number;
  owner: string | null;
  stored: number;
};
export type Game = {
  format: 4;
  round: number;
  zones: Zone[];
  pings: Ping[];
  seed: number;
  nextId: number;
  season: Season;
  pace: Pace;
  rainAt: number;
  status: 'lobby' | 'playing' | 'won' | 'lost';
  time: number;
  duration: number;
  players: Player[];
  leaves: Leaf[];
  piles: Pile[];
  drains: Drain[];
  carts: Cart[];
  score: number;
  target: number;
  host: string;
  lastTick: number;
  spawn: number;
  code?: string;
};
export const WORLD = { w: 1280, h: 800 };
export const SCALE = 0.05;
export const COLORS = [
  '#f5b354',
  '#84b9e4',
  '#d992bd',
  '#b0d78c',
  '#b8a2e2',
  '#eb8c75',
  '#80d7ce',
  '#f1de7b',
];
export const BUILDINGS = [
  { x: 40, y: 35, w: 315, h: 190, label: 'CÀ PHÊ PHỐ', color: '#cba786' },
  {
    x: 465,
    y: 35,
    w: 340,
    h: 190,
    label: 'NHÀ SÁCH THÁNG MƯỜI',
    color: '#a0b3a3',
  },
  { x: 920, y: 35, w: 320, h: 190, label: 'TẠP HÓA CÔ LAN', color: '#d2b88f' },
  { x: 40, y: 390, w: 315, h: 180, label: 'BÚN CHẢ HÀ NỘI', color: '#c0aa8e' },
  { x: 465, y: 390, w: 340, h: 180, label: 'SÂN TẬP THỂ', color: '#9bada3' },
  {
    x: 920,
    y: 390,
    w: 320,
    h: 180,
    label: 'TIỆM XE CHÚ HÙNG',
    color: '#b3a0a0',
  },
];
export const TREES = [
  { x: 90, y: 253, flower: false },
  { x: 285, y: 253, flower: false },
  { x: 520, y: 253, flower: true },
  { x: 740, y: 253, flower: true },
  { x: 990, y: 253, flower: false },
  { x: 1180, y: 253, flower: false },
  { x: 90, y: 605, flower: false },
  { x: 300, y: 605, flower: false },
  { x: 520, y: 605, flower: true },
  { x: 750, y: 605, flower: true },
  { x: 985, y: 605, flower: false },
  { x: 1180, y: 605, flower: false },
];
export const BINS = [
  { x: 400, y: 700 },
  { x: 860, y: 310 },
  { x: 1150, y: 710 },
];

export const DEPOTS = [
  { x: 405, y: 650, name: 'ĐIỂM TẬP KẾT 01' },
  { x: 860, y: 275, name: 'ĐIỂM TẬP KẾT 02' },
];
export const CART_CAPACITY = 36;
export const BAG_CAPACITY = 18;
export const clamp = (n: number, a: number, b: number) =>
  Math.max(a, Math.min(b, n));
export const distance = (
  a: { x: number; y: number },
  b: { x: number; y: number },
) => Math.hypot(a.x - b.x, a.y - b.y);
export const rainy = (g: Game) =>
  g.season === 'rain' || (g.season === 'mixed' && g.time >= g.rainAt);
function walkableBase(x: number, y: number, r: number) {
  return (
    x >= r &&
    x <= 1280 - r &&
    y >= 240 &&
    y <= 800 - r &&
    !BUILDINGS.some(
      (b) =>
        x > b.x - r && x < b.x + b.w + r && y > b.y - r && y < b.y + b.h + r,
    ) &&
    !TREES.some((t) => Math.hypot(t.x - x, t.y - y) < r + 3)
  );
}
export function walkable(x: number, y: number, r = 10) {
  return walkableBase(x, y, r) && !staticPropsBlock(x, y, r);
}
export function waterDepth(g: Game, p: { x: number; y: number }) {
  if (!rainy(g)) return 0;
  return g.drains.reduce(
    (depth, d) =>
      Math.max(depth, distance(d, p) < 65 + d.water * 75 ? d.water * 0.45 : 0),
    0,
  );
}
function random(g: Game) {
  g.seed = (Math.imul(g.seed, 1664525) + 1013904223) >>> 0;
  return g.seed / 4294967296;
}
export function zoneAt(g: Game, p: { x: number; y: number }) {
  return (
    g.zones.find((z) => p.x >= z.minX && p.x < z.maxX) ??
    g.zones[g.zones.length - 1]
  );
}
export function zoneRemaining(g: Game, z: Zone) {
  return (
    g.leaves.filter((l) => (l.zone ?? zoneAt(g, l).id) === z.id).length +
    g.piles
      .filter((l) => (l.zone ?? zoneAt(g, l).id) === z.id)
      .reduce((n, l) => n + l.amount, 0)
  );
}
export function refreshZones(g: Game) {
  for (const z of g.zones) {
    if (z.completedAt === null && z.picked >= 8 && zoneRemaining(g, z) <= 2) {
      z.completedAt = g.time;
      z.cleanUntil = g.time + 75;
    }
  }
}
export const zoneGoal = (g: Game) =>
  Math.min(3, 1 + Math.floor((g.target - 24) / 36));
export function addLeaves(g: Game, n: number) {
  for (
    let i = 0;
    i < n &&
    g.leaves.length < 130 &&
    g.leaves.length + g.piles.reduce((n, p) => n + p.amount, 0) < 240;
    i++
  ) {
    const x = 30 + random(g) * 1220,
      y = random(g) > 0.5 ? 275 + random(g) * 80 : 650 + random(g) * 110;
    const z = zoneAt(g, { x, y });
    if (z.cleanUntil > g.time || !walkable(x, y, 2)) continue;
    g.leaves.push({
      id: g.nextId++,
      x,
      y,
      hp: 1,
      kind: Math.floor(random(g) * 4),
      zone: z.id,
    });
  }
}
export function newGame(
  season: Season = 'mixed',
  now = Date.now(),
  pace: Pace = 'shift',
): Game {
  const g: Game = {
    format: 4,
    round: 0,
    zones: [
      {
        id: 0,
        name: 'Góc cà phê',
        minX: 0,
        maxX: 430,
        picked: 0,
        completedAt: null,
        cleanUntil: 0,
      },
      {
        id: 1,
        name: 'Hiên tập thể',
        minX: 430,
        maxX: 860,
        picked: 0,
        completedAt: null,
        cleanUntil: 0,
      },
      {
        id: 2,
        name: 'Dãy hàng quen',
        minX: 860,
        maxX: 1281,
        picked: 0,
        completedAt: null,
        cleanUntil: 0,
      },
    ],
    pings: [],
    seed: (now ^ 1709) >>> 0,
    nextId: 1,
    season,
    pace,
    rainAt: 75,
    status: 'lobby',
    time: 0,
    duration: 480,
    players: [],
    leaves: [],
    piles: [],
    drains: [
      { x: 200, y: 355, clog: 1, water: 0.55 },
      { x: 900, y: 355, clog: 1, water: 0.55 },
      { x: 670, y: 740, clog: 1, water: 0.55 },
    ],
    carts: BINS.map((b, i) => ({
      ...b,
      id: 'cart' + i,
      face: 0,
      owner: null,
      stored: 0,
    })),
    score: 0,
    target: 24,
    host: '',
    lastTick: now,
    spawn: 0,
  };
  g.rainAt = 65 + Math.floor(random(g) * 31);
  addLeaves(g, 60);
  for (const [x, y] of [
    [425, 730],
    [447, 724],
    [452, 744],
    [470, 733],
  ])
    g.leaves.push({
      id: g.nextId++,
      x,
      y,
      hp: 1,
      kind: 1,
      zone: zoneAt(g, { x, y }).id,
    });
  return g;
}
export function joinGame(g: Game, id: string, name: string, now: number) {
  let p = g.players.find((p) => p.id === id);
  if (p) {
    p.lastSeen = now;
    return p;
  }
  removePlayers(g, (p) => now - p.lastSeen >= 25000);
  releaseOrphanCarts(g);
  if (g.players.length >= 8) throw new Error('Phòng đã đủ 8 người.');
  const color =
    [0, 1, 2, 3, 4, 5, 6, 7].find(
      (c) => !g.players.some((p) => p.color === c),
    ) ?? 0;
  p = {
    id,
    name: name.trim().slice(0, 20) || 'Lao công',
    x: 380 + (color % 2) * 35,
    y: 730 + Math.floor(color / 2) * 14,
    bag: 0,
    headache: 0,
    mask: 0,
    cooldown: 0,
    score: 0,
    color,
    face: 0,
    pitch: 0,
    crouched: false,
    pushing: null,
    working: false,
    tool: 'broom',
    swept: 0,
    picked: 0,
    cleared: 0,
    cartDistance: 0,
    lastSeen: now,
    lastInput: now,
    seq: -1,
    action: null,
    actionAt: -10,
    actionAmount: 0,
    actionSeq: 0,
    lastPing: -10,
    dumped: 0,
  };
  g.players.push(p);
  if (!g.host || !g.players.some((p) => p.id === g.host)) g.host = id;
  return p;
}
export function startGame(g: Game, id: string, now: number) {
  if (id !== g.host) throw new Error('Chỉ chủ phòng được bắt đầu ca.');
  if (g.status === 'playing') return;
  const ps = g.players;
  const code = g.code;
  const fresh = newGame(g.season, now, g.pace);
  fresh.round = g.round + 1;
  Object.assign(g, fresh);
  g.players = ps;
  g.host = id;
  g.code = code;
  g.target = 24 + 12 * (ps.length - 1);
  g.status = 'playing';
  if (ps.length >= 4)
    g.drains.push(
      { x: 600, y: 350, clog: 1, water: 0.55 },
      { x: 160, y: 745, clog: 1, water: 0.55 },
      { x: 1090, y: 745, clog: 1, water: 0.55 },
    );
  g.players.forEach((p, i) =>
    Object.assign(p, {
      x: 380 + (i % 2) * 35,
      y: 730 + Math.floor(i / 2) * 14,
      bag: 0,
      headache: 0,
      mask: 0,
      cooldown: 0,
      score: 0,
      face: 0,
      pitch: 0,
      crouched: false,
      pushing: null,
      working: false,
      tool: 'broom',
      swept: 0,
      picked: 0,
      cleared: 0,
      cartDistance: 0,
      lastInput: now,
      lastSeen: now,
      seq: -1,
      action: null,
      actionAt: -10,
      actionAmount: 0,
      actionSeq: 0,
      lastPing: -10,
      dumped: 0,
    }),
  );
}
export function removePlayers(g: Game, remove: (p: Player) => boolean) {
  for (const p of g.players.filter(remove)) {
    if (p.bag > 0) {
      const z = zoneAt(g, p);
      g.piles.push({
        id: g.nextId++,
        x: p.x,
        y: p.y,
        amount: p.bag,
        progress: 0,
        zone: z.id,
      });
      z.completedAt = null;
      z.cleanUntil = 0;
    }
    g.pings = g.pings.filter((m) => m.playerId !== p.id);
  }
  g.players = g.players.filter((p) => !remove(p));
  if (!g.players.some((p) => p.id === g.host)) g.host = g.players[0]?.id ?? '';
  releaseOrphanCarts(g);
}
export function releaseOrphanCarts(g: Game, now?: number) {
  g.carts.forEach((c) => {
    const p = g.players.find((p) => p.id === c.owner);
    if (c.owner && (!p || (now !== undefined && now - p.lastInput > 3000))) {
      c.owner = null;
      if (p) p.pushing = null;
    }
  });
}
/** Keep old format-4 clutter reachable after introducing shared prop footprints. */
export function repairStaticPropOverlaps(g: Game) {
  const exit = (object: { x: number; y: number }, radius: number) =>
    walkableBase(object.x, object.y, radius) &&
    staticPropsBlock(object.x, object.y, radius)
      ? findStaticPropExit(object.x, object.y, radius, (x, y) =>
          walkable(x, y, radius),
        )
      : null;
  for (const object of [...g.leaves, ...g.piles]) {
    const next = exit(object, 2);
    if (next) {
      object.x = next.x;
      object.y = next.y;
    }
  }
  for (const cart of g.carts) {
    const next = exit(cart, 15);
    if (!next) continue;
    // The cart changes position; players keep their positions and bags exactly.
    cart.owner = null;
    for (const player of g.players)
      if (player.pushing === cart.id) player.pushing = null;
    cart.x = next.x;
    cart.y = next.y;
  }
}
export function tickWorld(g: Game, now: number) {
  repairStaticPropOverlaps(g);
  now = Math.max(now, g.lastTick);
  const dt = clamp((now - g.lastTick) / 1000, 0, 5);
  g.lastTick = now;
  if (g.status !== 'playing') return;
  g.time =
    g.pace === 'relaxed' ? g.time + dt : Math.min(g.duration, g.time + dt);
  if (g.pace === 'shift' && g.duration - g.time < 1e-6) g.time = g.duration;
  g.pings = g.pings.filter((m) => m.expiresAt > g.time);
  g.spawn += dt;
  const interval = rainy(g) ? 4 : 2.8;
  while (g.spawn >= interval) {
    g.spawn -= interval;
    addLeaves(g, Math.max(1, Math.ceil(g.players.length / 2)));
  }
  if (rainy(g))
    g.drains.forEach((d) => {
      d.water = clamp(d.water + dt * (d.clog > 0.01 ? 0.02 : -0.15), 0, 1);
    });
  refreshZones(g);
  checkEnd(g);
}
function checkEnd(g: Game) {
  const drainsOK =
    g.season === 'autumn' ||
    (rainy(g) && g.drains.every((d) => d.clog <= 0.01));
  if (
    g.score >= g.target &&
    drainsOK &&
    g.zones.filter((z) => z.completedAt !== null).length >= zoneGoal(g)
  )
    g.status = 'won';
  else if (g.pace === 'shift' && g.time >= g.duration) g.status = 'lost';
}
export type Task = {
  kind: 'cart' | 'depot' | 'drain' | 'leaf' | 'pile';
  index: number;
  progress: number;
  label: string;
};
export function clearPath(
  a: { x: number; y: number },
  b: { x: number; y: number },
  radius = 2,
) {
  const steps = Math.max(1, Math.ceil(distance(a, b) / 4));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (!walkable(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, radius))
      return false;
  }
  return true;
}
/**
 * Movement can leave a newly solid prop when an older format-4 snapshot starts
 * inside it. Every sampled step must keep or reduce its existing overlap; other
 * props and the original world collisions remain solid. No state is relocated.
 */
export function clearMovementPath(
  a: { x: number; y: number },
  b: { x: number; y: number },
  radius: number,
) {
  const steps = Math.max(1, Math.ceil(distance(a, b) / 4));
  const previous = STATIC_PROP_COLLIDERS.map((prop) =>
    staticPropClearance(prop, a.x, a.y),
  );
  const escaping = previous.map((clearance) => clearance < radius);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps,
      x = a.x + (b.x - a.x) * t,
      y = a.y + (b.y - a.y) * t;
    if (!walkableBase(x, y, radius)) return false;
    for (let j = 0; j < STATIC_PROP_COLLIDERS.length; j++) {
      const clearance = staticPropClearance(STATIC_PROP_COLLIDERS[j], x, y);
      if (escaping[j]) {
        if (clearance < previous[j] - 1e-7) return false;
        previous[j] = clearance;
      } else if (clearance < radius) return false;
    }
  }
  return true;
}
function inFront(p: Player, o: { x: number; y: number }, reach: number) {
  const d = distance(p, o);
  return (
    d < reach &&
    (d < 9 ||
      ((o.x - p.x) * Math.cos(p.face) + (o.y - p.y) * Math.sin(p.face)) / d >
        0.45) &&
    clearPath(p, o)
  );
}
export function inSweep(p: Player, o: { x: number; y: number }) {
  const dx = o.x - p.x,
    dy = o.y - p.y,
    forward = dx * Math.cos(p.face) + dy * Math.sin(p.face),
    side = -dx * Math.sin(p.face) + dy * Math.cos(p.face);
  return (
    forward > 4 && Math.abs(side) < 21 && inFront(p, o, p.crouched ? 46 : 40)
  );
}
function feedback(g: Game, p: Player, action: WorkAction, amount: number) {
  p.action = action;
  p.actionAt = g.time;
  p.actionAmount = amount;
  p.actionSeq++;
}
export function pingAt(g: Game, p: Player) {
  if (g.time - p.lastPing < 2) return;
  const cart = g.carts.find(
    (c) => c.stored >= CART_CAPACITY - 0.001 && inFront(p, c, 100),
  );
  const drain = rainy(g)
    ? g.drains.find((d) => d.clog > 0.01 && inFront(p, d, 110))
    : undefined;
  let point: { x: number; y: number } = cart ?? drain ?? p;
  if (!cart && !drain) {
    for (let step = 12; step <= 80; step += 4) {
      const candidate = {
        x: p.x + Math.cos(p.face) * step,
        y: p.y + Math.sin(p.face) * step,
      };
      if (!clearPath(p, candidate)) break;
      point = candidate;
    }
  }
  g.pings = g.pings.filter((m) => m.playerId !== p.id);
  g.pings.push({
    playerId: p.id,
    x: point.x,
    y: point.y,
    kind: cart ? 'cart' : drain ? 'drain' : 'help',
    expiresAt: g.time + 8,
  });
  p.lastPing = g.time;
}
export function taskAt(g: Game, p: Player): Task | null {
  if (p.pushing) {
    const ci = g.carts.findIndex((c) => c.id === p.pushing && c.owner === p.id);
    if (
      ci >= 0 &&
      g.carts[ci].stored > 0 &&
      DEPOTS.some((d) => distance(d, g.carts[ci]) < 48)
    )
      return {
        kind: 'depot',
        index: ci,
        progress: 1 - g.carts[ci].stored / CART_CAPACITY,
        label: 'Giữ E · Bàn giao rác tại điểm tập kết',
      };
    return null;
  }
  const ci = g.carts.findIndex(
    (c) => inFront(p, c, 43) && c.stored < CART_CAPACITY,
  );
  if (ci >= 0 && p.bag > 0)
    return {
      kind: 'cart',
      index: ci,
      progress: 1 - p.bag / BAG_CAPACITY,
      label: 'Giữ E · Đổ lá từ túi vào xe',
    };
  if (p.pitch > -0.2 && !p.crouched) return null;
  const di = g.drains.findIndex((d) => d.clog > 0.01 && inFront(p, d, 42));
  if (rainy(g) && di >= 0 && p.tool === 'scoop')
    return {
      kind: 'drain',
      index: di,
      progress: 1 - g.drains[di].clog,
      label: 'Giữ E · Dùng xẻng khơi miệng cống',
    };
  if (p.tool === 'scoop') {
    if (p.bag >= BAG_CAPACITY) return null;
    let pi = -1,
      near = Infinity;
    g.piles.forEach((l, i) => {
      const d = distance(p, l);
      if (inFront(p, l, 44) && d < near) {
        near = d;
        pi = i;
      }
    });
    if (pi >= 0)
      return {
        kind: 'pile',
        index: pi,
        progress: g.piles[pi].progress,
        label: 'Giữ E · Hốt đống lá vào túi',
      };
    return null;
  }
  let li = -1,
    near = Infinity;
  g.leaves.forEach((l, i) => {
    const d = distance(p, l);
    if (inSweep(p, l) && d < near) {
      near = d;
      li = i;
    }
  });
  if (li >= 0)
    return {
      kind: 'leaf',
      index: li,
      progress: 1 - g.leaves[li].hp,
      label: rainy(g)
        ? 'Giữ E · Gom lá ướt (nặng hơn)'
        : 'Giữ E · Quét lá thành đống',
    };
  return null;
}
export function grabCart(g: Game, p: Player) {
  if (p.pushing) {
    const c = g.carts.find((c) => c.id === p.pushing);
    if (c?.owner === p.id) c.owner = null;
    p.pushing = null;
    return;
  }
  const c = g.carts
    .filter((c) => !c.owner && inFront(p, c, 48))
    .sort((a, b) => distance(p, a) - distance(p, b))[0];
  if (c) {
    const nx = p.x + Math.cos(p.face) * 26,
      ny = p.y + Math.sin(p.face) * 26;
    if (walkable(nx, ny, 15) && clearPath(c, { x: nx, y: ny }, 15)) {
      c.owner = p.id;
      p.pushing = c.id;
      c.x = nx;
      c.y = ny;
      c.face = p.face;
    }
  }
}
export function movePlayer(g: Game, p: Player, input: Input, dt: number) {
  dt = clamp(dt, 0, 0.35);
  if (g.status !== 'playing') return;
  if (input.yaw !== undefined)
    p.face = Math.atan2(-Math.cos(input.yaw), -Math.sin(input.yaw));
  p.pitch = clamp(input.pitch ?? p.pitch, -1.4, 1.1);
  p.crouched = !!input.crouch;
  if (input.tool === 'broom' || input.tool === 'scoop') p.tool = input.tool;
  if (input.grab) grabCart(g, p);
  if (input.ping) pingAt(g, p);
  p.cooldown = Math.max(0, p.cooldown - dt);
  p.mask = Math.max(0, p.mask - dt);
  if (input.mask && p.cooldown <= 0) {
    p.mask = 22;
    p.cooldown = 30;
  }
  const flower = TREES.some((t) => t.flower && distance(t, p) < 85);
  p.headache = clamp(
    p.headache + dt * (flower && p.mask <= 0 ? 10 : -27),
    0,
    100,
  );
  const dizzy = p.headache > 65;
  const cart = g.carts.find((c) => c.id === p.pushing && c.owner === p.id);
  if (p.pushing && !cart) p.pushing = null;
  const speed =
    (input.sprint && !cart ? 112 : 72) *
    (dizzy ? 0.78 : 1) *
    (waterDepth(g, p) > 0.1 ? 0.58 : 1) *
    (p.crouched ? 0.55 : 1) *
    (cart ? 0.78 - (0.24 * cart.stored) / CART_CAPACITY : 1);
  const len = Math.hypot(input.x, input.y),
    oldX = p.x,
    oldY = p.y;
  if (len > 0) {
    const dx = (input.x / Math.max(1, len)) * speed * dt,
      dy = (input.y / Math.max(1, len)) * speed * dt;
    if (input.yaw === undefined) p.face = Math.atan2(dy, dx);
    const can = (x: number, y: number) =>
      clearMovementPath(p, { x, y }, 10) &&
      (!cart ||
        clearMovementPath(
          cart,
          { x: x + Math.cos(p.face) * 26, y: y + Math.sin(p.face) * 26 },
          15,
        ));
    if (can(p.x + dx, p.y)) p.x += dx;
    if (can(p.x, p.y + dy)) p.y += dy;
  }
  if (cart) {
    p.cartDistance += Math.hypot(p.x - oldX, p.y - oldY) * SCALE;
    const nx = p.x + Math.cos(p.face) * 26,
      ny = p.y + Math.sin(p.face) * 26;
    if (clearMovementPath(cart, { x: nx, y: ny }, 15)) {
      cart.x = nx;
      cart.y = ny;
      cart.face = p.face;
    } else {
      cart.owner = null;
      p.pushing = null;
    }
  }
  p.working = input.work;
  if (!p.working) return;
  const task = taskAt(g, p);
  if (!task) return;
  if (task.kind === 'depot') {
    const c = g.carts[task.index],
      amount = Math.min(c.stored, Math.round(dt * 8000) / 1000);
    c.stored = Math.max(0, Math.round((c.stored - amount) * 1000) / 1000);
    g.score = Math.round((g.score + amount) * 1000) / 1000;
    p.score = Math.round((p.score + amount) * 1000) / 1000;
    if (amount > 0) feedback(g, p, 'deliver', amount);
    checkEnd(g);
    return;
  }
  if (task.kind === 'cart') {
    const c = g.carts[task.index],
      dump = Math.min(
        p.bag,
        Math.round(dt * 10000) / 1000,
        Math.round((CART_CAPACITY - c.stored) * 1000) / 1000,
      );
    p.bag = Math.max(0, Math.round((p.bag - dump) * 1000) / 1000);
    c.stored = Math.round((c.stored + dump) * 1000) / 1000;
    p.dumped = Math.round((p.dumped + dump) * 1000) / 1000;
    if (dump > 0) feedback(g, p, 'dump', dump);
    return;
  }
  if (task.kind === 'drain') {
    const d = g.drains[task.index],
      amount = Math.min(d.clog, dt * (dizzy ? 0.09 : 0.17));
    d.clog -= amount;
    p.cleared += amount;
    if (d.clog < 0.011) {
      p.cleared += d.clog;
      d.clog = 0;
      feedback(g, p, 'drain', 1);
    }
    checkEnd(g);
    return;
  }
  if (task.kind === 'pile') {
    const pile = g.piles[task.index];
    pile.progress += dt * (p.crouched ? 2.5 : 1.9);
    if (pile.progress >= 1) {
      const amount = Math.min(pile.amount, 3, BAG_CAPACITY - p.bag);
      pile.amount = Math.round((pile.amount - amount) * 1000) / 1000;
      p.bag = Math.round((p.bag + amount) * 1000) / 1000;
      p.picked += amount;
      const z = g.zones[pile.zone ?? zoneAt(g, pile).id];
      z.picked += amount;
      feedback(g, p, 'scoop', amount);
      pile.progress = 0;
      if (pile.amount < 0.001) g.piles.splice(task.index, 1);
      refreshZones(g);
      checkEnd(g);
    }
    return;
  }
  // One stroke affects the full reachable patch. Each leaf unit moves or transfers once.
  const power =
    dt * (dizzy ? 0.8 : p.crouched ? 2 : 1.5) * (rainy(g) ? 0.65 : 1);
  let swept = 0;
  for (let i = g.leaves.length - 1; i >= 0; i--) {
    const leaf = g.leaves[i];
    if (!inSweep(p, leaf)) continue;
    const zone = leaf.zone ?? zoneAt(g, leaf).id;
    const pile = g.piles.find(
      (l) =>
        (l.zone ?? zoneAt(g, l).id) === zone &&
        l.amount <= 17 &&
        distance(l, leaf) < 30 &&
        inFront(p, l, 48) &&
        clearPath(leaf, l),
    );
    const ahead = pile ?? {
      x: p.x + Math.cos(p.face) * 30,
      y: p.y + Math.sin(p.face) * 30,
    };
    if (clearPath(leaf, ahead)) {
      const f = Math.min(1, dt * 5);
      leaf.x += (ahead.x - leaf.x) * f;
      leaf.y += (ahead.y - leaf.y) * f;
    }
    leaf.hp -= power;
    if (leaf.hp <= 1e-8) {
      if (pile) pile.amount++;
      else
        g.piles.push({
          id: g.nextId++,
          x: leaf.x,
          y: leaf.y,
          amount: 1,
          progress: 0,
          zone,
        });
      g.leaves.splice(i, 1);
      p.swept++;
      swept++;
    }
  }
  if (swept) feedback(g, p, 'sweep', swept);
}
export function applyInput(
  g: Game,
  id: string,
  input: Input,
  now: number,
  seq: number,
) {
  const p = g.players.find((p) => p.id === id);
  if (!p) throw new Error('Bạn đã rời phòng. Hãy vào lại.');
  p.lastSeen = Math.max(p.lastSeen, now);
  now = Math.max(now, p.lastInput);
  if (seq <= p.seq) return;
  p.seq = seq;
  const dt = clamp((now - p.lastInput) / 1000, 0, 0.35);
  p.lastInput = now;
  movePlayer(g, p, input, dt);
}
export function applyInputBatch(
  g: Game,
  id: string,
  frames: InputFrame[],
  now: number,
  seq: number,
) {
  const p = g.players.find((p) => p.id === id);
  if (!p) throw new Error('Bạn đã rời phòng. Hãy vào lại.');
  p.lastSeen = Math.max(p.lastSeen, now);
  now = Math.max(now, p.lastInput);
  if (seq <= p.seq) return;
  p.seq = seq;
  const elapsed = (now - p.lastInput) / 1000;
  p.lastInput = now;
  if (!frames.length) {
    p.working = false;
    p.crouched = false;
    return;
  }
  const latest = frames[frames.length - 1].input;
  if (elapsed > INPUT_STALE_SECONDS) {
    // The first packet after a stall cannot turn the missing time into held work.
    movePlayer(
      g,
      p,
      { ...latest, x: 0, y: 0, work: false, grab: false, mask: false, ping: false },
      0,
    );
    return;
  }
  let budget = Math.min(INPUT_HISTORY_SECONDS, Math.max(0, elapsed));
  const total = frames.reduce((sum, frame) => sum + frame.dt, 0);
  let skip = Math.max(0, total - budget);
  for (const frame of frames) {
    const retainedStart = skip <= 1e-6;
    const discarded = Math.min(skip, frame.dt);
    skip -= discarded;
    let duration = Math.min(budget, frame.dt - discarded);
    // Edges belong to the start of their sample, not to a retained tail.
    let first = retainedStart && discarded < 1e-6;
    if (duration <= 1e-6) {
      if (frame.dt === 0 && first)
        movePlayer(g, p, frame.input, 0);
      continue;
    }
    while (duration > 1e-6) {
      const step = Math.min(0.05, duration);
      movePlayer(
        g,
        p,
        first
          ? frame.input
          : { ...frame.input, grab: false, mask: false, ping: false },
        step,
      );
      first = false;
      duration -= step;
      budget -= step;
    }
  }
}
export function contextHint(g: Game, p: Player) {
  const task = taskAt(g, p);
  if (task) return task.label;
  if (p.pushing) {
    const c = g.carts.find((c) => c.id === p.pushing);
    return c && c.stored > 0
      ? 'Đẩy tới ô vàng TẬP KẾT · M xem bản đồ · Q buông xe'
      : 'Xe trống · WASD đẩy xe · Q buông để quét';
  }
  if (
    g.carts.some((c) => c.stored >= CART_CAPACITY - 0.001 && inFront(p, c, 48))
  )
    return 'Xe đầy · Q đẩy tới ô vàng TẬP KẾT · G gọi đồng đội';
  if (g.carts.some((c) => !c.owner && inFront(p, c, 48)))
    return 'Q · Nắm xe và đưa tới điểm tập kết';
  if (p.bag >= BAG_CAPACITY) return 'Túi đầy · Tìm xe rác để đổ lá';
  if (
    rainy(g) &&
    g.drains.some((d) => d.clog > 0.01 && inFront(p, d, 50)) &&
    p.tool !== 'scoop'
  )
    return '2 · Đổi sang xẻng để thông cống';
  if (g.piles.some((l) => inFront(p, l, 50)) && p.tool === 'broom')
    return 'Đã gom thành đống · 2 đổi xẻng · Giữ E để hốt';
  if (p.headache > 65)
    return 'Choáng hương hoa · F đeo khẩu trang hoặc ra chỗ thoáng';
  if (waterDepth(g, p) > 0.1) return 'Nước ngập · M tìm cống · 2 dùng xẻng';
  if (p.pitch > -0.2 && !p.crouched)
    return 'Nhìn xuống hoặc giữ C để cúi làm việc';
  if (p.tool === 'broom' && g.leaves.some((l) => distance(p, l) < 12))
    return 'Lùi nửa bước để đặt lá trước đầu chổi';
  return p.tool === 'scoop'
    ? 'Tìm đống lá để hốt · 1 đổi lại chổi'
    : 'Lại gần lá · Giữ chuột trái để gom thành đống';
}

export function onboardingHint(g: Game, p: Player) {
  if (p.score > 0) return null;
  if (p.pushing)
    return '04 · Đẩy xe vào ô vàng TẬP KẾT, giữ E để bàn giao. M xem đường.';
  if (p.dumped > 0)
    return '04 · Nhìn vào xe, Q nắm xe. Đẩy tới TẬP KẾT ở đầu ngõ.';
  if (p.bag > 0)
    return '03 · Nhìn vào xe xanh gần bạn, giữ E để đổ túi. Cả chổi và xẻng đều đổ được.';
  if (p.swept > 0)
    return '02 · Nhấn 2 chọn xẻng. Nhìn xuống đống lá, giữ E để hốt.';
  if (p.tool === 'scoop')
    return '01 · Nhấn 1 chọn chổi. Lại gần lá, giữ C và E để quét.';
  return '01 · Lá ở trước mặt: giữ C để cúi, giữ E hoặc chuột trái để quét một vùng.';
}
