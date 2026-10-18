import * as T from 'three';

type Surface =
  | 'asphalt'
  | 'paving'
  | 'plaster'
  | 'brick'
  | 'timber'
  | 'shutter'
  | 'metal';
type Channels = [number, number, number, number, number];

export type StreetMaterials = Record<Surface, T.MeshStandardMaterial> & {
  /** Owned once by this scene. Materials and frontage clones share these maps. */
  textures: readonly T.Texture[];
  materials: readonly T.MeshStandardMaterial[];
  dispose: () => void;
};

const TAU = Math.PI * 2;
const clamp = (x: number) => Math.max(0, Math.min(1, x));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (x: number) => x * x * (3 - 2 * x);
const fract = (x: number) => x - Math.floor(x);

function hash(x: number, y: number, seed: number) {
  let n = Math.imul(x + seed, 374761393) ^ Math.imul(y + 17, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/** Periodic noise keeps coarse damp patches continuous across tiled UVs. */
function noise(u: number, v: number, cells: number, seed: number) {
  const x = u * cells;
  const y = v * cells;
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const xx = smooth(fract(x));
  const yy = smooth(fract(y));
  const at = (dx: number, dy: number) =>
    hash(
      (((ix + dx) % cells) + cells) % cells,
      (((iy + dy) % cells) + cells) % cells,
      seed,
    );
  return mix(mix(at(0, 0), at(1, 0), xx), mix(at(0, 1), at(1, 1), xx), yy);
}

/** RGB, height and roughness are authored separately; color is never used as height. */
function sample(
  kind: Surface,
  u: number,
  v: number,
  x: number,
  y: number,
): Channels {
  const coarse = noise(u, v, 8, 119);
  const grain = hash(x, y, 381);
  const detail = noise(u, v, 32, 997);

  if (kind === 'asphalt') {
    const damp = clamp((noise(u, v, 4, 43) - 0.42) * 2.5);
    const stone = grain > 0.79 ? (grain - 0.79) * 62 : grain * 8;
    const base = 64 + coarse * 18 + stone - damp * 13;
    // Tar repair joints with a fine irregular edge, rather than painted cracks.
    const seam = Math.abs(fract(u * 2 + noise(u, v, 8, 7) * 0.075) - 0.5);
    const crack = clamp((0.008 - seam) * 160);
    return [
      base - crack * 21,
      base + 1 - crack * 21,
      base - 1 - crack * 20,
      0.36 + grain * 0.22 + detail * 0.14 - crack * 0.18,
      0.76 + grain * 0.13 - damp * 0.33,
    ];
  }

  if (kind === 'paving') {
    const px = fract(u * 4);
    const py = fract(v * 4);
    const cellX = Math.floor(u * 4);
    const cellY = Math.floor(v * 4);
    const edge = Math.min(px, 1 - px, py, 1 - py);
    const tile = hash(cellX, cellY, 93);
    const joint = clamp((0.025 - edge) * 90);
    const bevel = clamp(edge * 50);
    // Hanoi concrete tiles with concentric fan grooves, softened by foot wear.
    const radius = Math.hypot(px, py);
    const ring = Math.abs(fract(radius * 5.3) - 0.5);
    const groove = clamp((0.047 - ring) * 26) * (0.4 + detail * 0.6);
    const dusty = (coarse - 0.5) * 19 + grain * 10;
    const chip = grain > 0.985 ? 18 : 0;
    const r = 141 + tile * 25 + dusty - groove * 15 + chip;
    const g = 96 + tile * 22 + dusty - groove * 12 + chip;
    const b = 80 + tile * 18 + dusty - groove * 10 + chip;
    return [
      mix(r, 70 + detail * 13, joint),
      mix(g, 71 + detail * 13, joint),
      mix(b, 62 + detail * 13, joint),
      (0.46 + bevel * 0.15 + grain * 0.035 - groove * 0.1) * (1 - joint * 0.58),
      0.75 + grain * 0.13 - coarse * 0.18 + joint * 0.12,
    ];
  }

  if (kind === 'plaster') {
    const stain = clamp((noise(u, v, 4, 312) - 0.45) * 2.2);
    const pock = grain < 0.035 ? grain * 10 - 5 : 0;
    const weather = (coarse - 0.5) * 26 + (grain - 0.5) * 9;
    const hairline = Math.abs(fract(u * 3 + noise(u, v, 8, 12) * 0.23) - 0.5);
    const crack = clamp((0.0025 - hairline) * 650) * clamp((detail - 0.32) * 2);
    return [
      190 + weather - stain * 30 - crack * 35,
      186 + weather - stain * 25 - crack * 33,
      169 + weather - stain * 26 - crack * 29,
      0.5 +
        (grain - 0.5) * 0.09 +
        (detail - 0.5) * 0.11 +
        pock * 0.015 -
        crack * 0.12,
      0.87 + grain * 0.08 - stain * 0.13,
    ];
  }

  if (kind === 'brick') {
    const row = Math.floor(v * 8);
    const xx = u * 4 + (row % 2) * 0.5;
    const px = fract(xx);
    const py = fract(v * 8);
    const identity = hash(Math.floor(xx), row, 491);
    const edge = Math.min(px * 2, (1 - px) * 2, py, 1 - py);
    const mortar = clamp((0.065 + (detail - 0.5) * 0.035 - edge) * 40);
    const chipped = clamp((0.13 - edge) * 12) * grain;
    const fleck = (coarse - 0.5) * 21 + grain * 17 - chipped * 20;
    const m = 104 + detail * 26 + grain * 7;
    return [
      mix(131 + identity * 34 + fleck, m, mortar),
      mix(70 + identity * 21 + fleck, m - 1, mortar),
      mix(49 + identity * 15 + fleck, m - 10, mortar),
      0.54 + grain * 0.08 - mortar * 0.22 - chipped * 0.09,
      0.82 + grain * 0.12 + mortar * 0.05,
    ];
  }

  if (kind === 'timber') {
    const plank = Math.floor(u * 4);
    const seam = Math.min(fract(u * 4), 1 - fract(u * 4));
    const cut = clamp((0.016 - seam) * 100);
    const waviness = noise(u, v, 8, 201) * 4 + Math.sin(v * TAU * 2) * 0.6;
    const fibres = Math.sin(u * TAU * 125 + waviness);
    const longGrain = Math.sin(u * TAU * 26 + waviness * 0.4);
    const tone =
      hash(plank, 0, 73) * 15 + coarse * 14 + fibres * 3 + longGrain * 5;
    const weather = noise(u, v, 4, 14) * 11;
    return [
      97 + tone + weather - cut * 37,
      69 + tone + weather - cut * 32,
      44 + tone + weather - cut * 26,
      0.48 + fibres * 0.027 + grain * 0.015 + longGrain * 0.025 - cut * 0.2,
      0.71 + coarse * 0.15 + fibres * 0.025,
    ];
  }

  if (kind === 'shutter') {
    const fold = Math.sin(v * TAU * 24);
    const lip = Math.pow(clamp((fold + 1) / 2), 12);
    const streak = noise(u, v * 0.08, 32, 552);
    const rust = clamp((streak - 0.67) * 6) * clamp((coarse - 0.35) * 3);
    const shade = (coarse - 0.5) * 14 + grain * 5 - lip * 12;
    return [
      mix(107 + shade, 119 + grain * 18, rust),
      mix(122 + shade, 69 + grain * 11, rust),
      mix(116 + shade, 38 + grain * 8, rust),
      0.42 + fold * 0.12 - lip * 0.06 + grain * 0.012,
      0.59 + coarse * 0.17 + rust * 0.18,
    ];
  }

  const streak = noise(u * 0.1, v, 32, 291);
  const scratches = grain > 0.93 && streak > 0.55 ? 14 : 0;
  const oxidation = clamp((coarse - 0.52) * 2.3);
  const base = 112 + (detail - 0.5) * 22 + (grain - 0.5) * 9;
  return [
    base - oxidation * 4 + scratches,
    base + 4 - oxidation * 11 + scratches,
    base + 2 - oxidation * 17 + scratches,
    0.5 + (grain - 0.5) * 0.025 + streak * 0.012 - scratches * 0.0008,
    0.49 + coarse * 0.15 + oxidation * 0.1,
  ];
}

function createMaps(kind: Surface, textures: T.Texture[]) {
  if (
    typeof document === 'undefined' ||
    typeof document.createElement !== 'function'
  )
    return null;
  const size =
    kind === 'timber' || kind === 'shutter' || kind === 'metal' ? 256 : 512;
  const canvases = Array.from({ length: 3 }, () => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    return canvas;
  });
  const contexts = canvases.map((canvas) => canvas.getContext('2d'));
  if (contexts.some((context) => !context)) return null;
  const images = contexts.map((context) =>
    context!.createImageData(size, size),
  );
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b, height, roughness] = sample(
        kind,
        x / size,
        y / size,
        x,
        y,
      );
      const offset = (y * size + x) * 4;
      images[0].data[offset] = r;
      images[0].data[offset + 1] = g;
      images[0].data[offset + 2] = b;
      const h = clamp(height) * 255;
      const rough = clamp(roughness) * 255;
      for (let c = 0; c < 3; c++) {
        images[1].data[offset + c] = h;
        images[2].data[offset + c] = rough;
      }
      for (const image of images) image.data[offset + 3] = 255;
    }
  }
  return canvases.map((canvas, i) => {
    contexts[i]!.putImageData(images[i], 0, 0);
    const map = new T.CanvasTexture(canvas);
    map.name = `hanoi-${kind}-${['color', 'height', 'roughness'][i]}`;
    map.colorSpace = i === 0 ? T.SRGBColorSpace : T.NoColorSpace;
    map.wrapS = map.wrapT = T.RepeatWrapping;
    map.anisotropy = 4;
    textures.push(map);
    return map;
  });
}

/**
 * Build once per scene, then share maps/materials across every building or prop.
 * Defaults are one tile per UV unit; use geometry UVs to keep a constant world scale.
 * Cloning a material for a frontage tint still shares the original texture maps.
 * Node construction tests receive plain materials without accessing the DOM.
 */
export function createStreetMaterials(): StreetMaterials {
  const textures: T.Texture[] = [];
  const definitions: Record<
    Surface,
    { color: string; roughness: number; bump: number; metalness: number }
  > = {
    asphalt: { color: '#4b4d4a', roughness: 0.68, bump: 0.022, metalness: 0 },
    paving: { color: '#aa7d68', roughness: 0.82, bump: 0.023, metalness: 0 },
    plaster: { color: '#bbb7a6', roughness: 0.9, bump: 0.014, metalness: 0 },
    brick: { color: '#a25d42', roughness: 0.9, bump: 0.034, metalness: 0 },
    timber: { color: '#785c3e', roughness: 0.78, bump: 0.013, metalness: 0 },
    shutter: {
      color: '#71817b',
      roughness: 0.67,
      bump: 0.031,
      metalness: 0.34,
    },
    metal: { color: '#747a78', roughness: 0.6, bump: 0.006, metalness: 0.72 },
  };
  const named = {} as Record<Surface, T.MeshStandardMaterial>;
  const materials: T.MeshStandardMaterial[] = [];
  for (const kind of Object.keys(definitions) as Surface[]) {
    const definition = definitions[kind];
    const maps = createMaps(kind, textures);
    const material = new T.MeshStandardMaterial({
      name: `hanoi-${kind}`,
      color: maps ? '#ffffff' : definition.color,
      map: maps?.[0] ?? null,
      bumpMap: maps?.[1] ?? null,
      roughnessMap: maps?.[2] ?? null,
      bumpScale: definition.bump,
      roughness: maps ? 1 : definition.roughness,
      metalness: definition.metalness,
    });
    named[kind] = material;
    materials.push(material);
  }
  let disposed = false;
  return {
    ...named,
    textures,
    materials,
    dispose() {
      if (disposed) return;
      disposed = true;
      textures.forEach((texture) => texture.dispose());
      materials.forEach((material) => material.dispose());
    },
  };
}
