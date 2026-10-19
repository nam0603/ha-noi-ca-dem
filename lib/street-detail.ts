import * as T from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { createStreetMaterials } from './street-materials';

type Surfaces = ReturnType<typeof createStreetMaterials>;
export type StreetLight = {
  x: number;
  y: number;
  z: number;
  color: string;
  power: number;
};
const metalColors = new Map<string, T.MeshStandardMaterial>();
function paint(color: string, metalness = 0, roughness = 0.75) {
  const key = color + metalness + roughness;
  let material = metalColors.get(key);
  if (!material) {
    material = new T.MeshStandardMaterial({ color, metalness, roughness });
    metalColors.set(key, material);
  }
  return material;
}
function block(
  root: T.Object3D,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  material: T.Material | string,
  rounded = false,
) {
  // Subpixel jars/books do not need a 324-vertex bevel; reserve it for visible silhouettes.
  const bevel = rounded && Math.min(w, h, d) > 0.12 && Math.max(w, h, d) > 0.5;
  const geometry = bevel
    ? new RoundedBoxGeometry(w, h, d, 1, Math.min(w, h, d) * 0.16)
    : new T.BoxGeometry(w, h, d);
  const mesh = new T.Mesh(
    geometry,
    typeof material === 'string' ? paint(material) : material,
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = mesh.receiveShadow = true;
  root.add(mesh);
  return mesh;
}
function rod(
  root: T.Object3D,
  a: number[],
  b: number[],
  radius: number,
  material: T.Material | string,
  segments = 6,
) {
  const start = new T.Vector3(...(a as [number, number, number])),
    end = new T.Vector3(...(b as [number, number, number]));
  const mesh = new T.Mesh(
    new T.CylinderGeometry(radius, radius, start.distanceTo(end), segments),
    typeof material === 'string' ? paint(material) : material,
  );
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(
    new T.Vector3(0, 1, 0),
    end.sub(start).normalize(),
  );
  mesh.castShadow = true;
  root.add(mesh);
  return mesh;
}
function ring(
  root: T.Object3D,
  x: number,
  y: number,
  z: number,
  radius: number,
  thickness: number,
  material: T.Material,
  rotation = 0,
) {
  const mesh = new T.Mesh(
    new T.TorusGeometry(radius, thickness, 5, 18),
    material,
  );
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotation;
  root.add(mesh);
  return mesh;
}
function bulb(
  root: T.Object3D,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  color = '#ffd69a',
) {
  const material = paint(color, 0, 0.4);
  material.emissive.set(color);
  material.emissiveIntensity = 2.2;
  const mesh = block(root, x, y, z, w, h, 0.045, material);
  mesh.castShadow = false;
}
function poster(
  root: T.Object3D,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  title: string,
  lines: string[],
  bg: string,
  fg: string,
) {
  if (typeof document === 'undefined') return;
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 512;
  const c = canvas.getContext('2d')!;
  c.fillStyle = bg;
  c.fillRect(0, 0, 384, 512);
  c.strokeStyle = fg;
  c.lineWidth = 3;
  c.strokeRect(14, 14, 356, 484);
  c.textAlign = 'center';
  c.fillStyle = fg;
  c.font = 'bold 43px Georgia';
  c.fillText(title, 192, 92, 340);
  c.font = '22px Arial';
  lines.forEach((line, i) => c.fillText(line, 192, 170 + i * 49, 330));
  c.globalAlpha = 0.13;
  for (let i = 0; i < 65; i++) {
    c.fillRect((i * 97) % 384, (i * 83) % 512, 25, 1);
  }
  const map = new T.CanvasTexture(canvas);
  map.colorSpace = T.SRGBColorSpace;
  const mesh = new T.Mesh(
    new T.PlaneGeometry(w, h),
    new T.MeshStandardMaterial({
      map,
      roughness: 0.94,
      emissive: '#e9bc77',
      emissiveMap: map,
      emissiveIntensity: 0.14,
    }),
  );
  mesh.position.set(x, y, z);
  root.add(mesh);
}

/** Entirely original modular props; never changes game coordinates or collision state. */
export function dressFrontage(
  root: T.Object3D,
  x: number,
  front: number,
  w: number,
  h: number,
  index: number,
  surfaces: Surfaces,
) {
  const style = index % 8;
  const iron = paint('#293a3c', 0.65, 0.45),
    trim = paint('#a89c7f');
  const warmGlass = paint(style % 3 ? '#e4cba0' : '#9fb6b4', 0, 0.38);
  warmGlass.emissive.set(style % 3 ? '#dba45b' : '#83a5a2');
  warmGlass.emissiveIntensity = 0.16;
  // Recessed interiors are behind the closed glazing/counter and authoritative wall footprint.
  const door = Math.min(2.3, w * 0.55);
  block(root, x, 1.3, front - 1.35, door, 2.35, 0.05, '#353c37');
  block(root, x, 0.12, front - 0.7, door, 0.08, 1.3, surfaces.paving);
  block(root, x, 2.3, front - 0.65, door, 0.06, 1.35, '#9f947a');
  bulb(root, x, 2.25, front - 1.0, door * 0.7, 0.05);
  const shelf = paint('#685137');
  for (let row = 0; row < 3; row++) {
    block(
      root,
      x,
      0.55 + row * 0.43,
      front - 1.2,
      door * 0.83,
      0.045,
      0.26,
      shelf,
    );
    for (let k = 0; k < 7; k++) {
      const xx = x - door * 0.35 + k * door * 0.116;
      const colors = ['#c19b65', '#476963', '#9c5b49', '#d9ccb0', '#6b7b82'];
      block(
        root,
        xx,
        0.68 + row * 0.43,
        front - 1.19,
        0.12,
        0.19 + (k % 3) * 0.025,
        0.16,
        colors[(k + row + style) % colors.length],
        true,
      );
    }
  }
  // A second fine mullion layer and sill give windows real thickness at grazing angles.
  for (const dx of [-door / 2, door / 2])
    block(root, x + dx, 1.2, front + 0.1, 0.055, 2.2, 0.12, iron);
  block(root, x, 0.16, front + 0.11, door + 0.12, 0.08, 0.22, trim);
  for (let level = 4.15; level < h - 0.55; level += 2.25) {
    for (const dx of [-w * 0.24, w * 0.24]) {
      block(root, x + dx, level, front + 0.045, 0.87, 1.23, 0.022, warmGlass);
      for (const sx of [-0.3, 0.3]) {
        block(
          root,
          x + dx + sx,
          level,
          front + 0.07,
          0.045,
          1.18,
          0.04,
          '#7f715d',
        );
      }
      block(
        root,
        x + dx,
        level + 0.13,
        front + 0.072,
        0.9,
        0.035,
        0.03,
        '#7f715d',
      );
      // Curtains reveal small domestic differences without transparency overdraw.
      block(
        root,
        x + dx - 0.33,
        level,
        front + 0.078,
        0.18 + (style % 2) * 0.08,
        1.13,
        0.01,
        '#bab29b',
      );
    }
    if (style % 3 !== 2) {
      for (let j = 0; j < 5; j++) {
        ring(
          root,
          x - w * 0.3 + j * w * 0.15,
          level - 0.31,
          front + 0.81,
          0.14,
          0.014,
          iron,
        );
      }
      block(root, x, level - 0.73, front + 0.81, w * 0.84, 0.11, 0.05, trim);
    }
  }
  // Exterior utility service: drainpipe, cable clips, electricity meter and wall fan AC.
  const pipeX = x - w * 0.44;
  rod(
    root,
    [pipeX, 0.17, front + 0.13],
    [pipeX, h - 0.28, front + 0.13],
    0.045,
    '#6c7974',
    8,
  );
  for (let y = 0.7; y < h; y += 1.3)
    block(root, pipeX, y, front + 0.14, 0.14, 0.035, 0.09, iron);
  block(
    root,
    pipeX + 0.18,
    1.65,
    front + 0.14,
    0.22,
    0.32,
    0.1,
    '#a3aba0',
    true,
  );
  block(root, pipeX + 0.18, 1.7, front + 0.2, 0.12, 0.09, 0.015, '#304344');
  const ax = x + w * 0.34,
    ay = 3.65 + (style % 2) * 1.9;
  block(root, ax, ay, front + 0.27, 0.84, 0.53, 0.42, '#bcbcad', true);
  ring(root, ax - 0.12, ay, front + 0.49, 0.18, 0.014, iron);
  for (let j = 0; j < 8; j++) {
    const a = (j * Math.PI) / 4;
    rod(
      root,
      [ax - 0.12, ay, front + 0.505],
      [ax - 0.12 + Math.cos(a) * 0.17, ay + Math.sin(a) * 0.17, front + 0.505],
      0.009,
      iron,
      4,
    );
  }
  for (const dx of [-0.28, 0.28])
    block(root, ax + dx, ay - 0.32, front + 0.2, 0.035, 0.12, 0.55, iron);
  rod(
    root,
    [ax + 0.2, ay, front + 0.24],
    [ax + 0.3, ay + 0.65, front + 0.15],
    0.025,
    '#999c87',
  );
  // Exposed brick repairs sit flush in plaster; no decal z-fighting.
  if (style % 2 === 0) {
    block(
      root,
      x + w * 0.37,
      0.64,
      front + 0.008,
      w * 0.2,
      0.8,
      0.025,
      surfaces.brick,
    );
  }
  bulb(root, x, 2.39, front + 0.71, Math.min(w * 0.66, 3.2), 0.035);
  for (const dx of [-w * 0.45, w * 0.45]) {
    block(root, x + dx, 2.94, front + 0.16, 0.045, 0.65, 0.035, iron);
  }
  // Distinct shop identities: menu board, food cabinet, florist vases, repair workbench.
  if ([0, 2, 5].includes(style)) {
    poster(
      root,
      x - w * 0.35,
      1.2,
      front + 0.16,
      0.73,
      1.08,
      style === 0 ? 'CÀ PHÊ' : style === 2 ? 'BÚN CHẢ' : 'BÁNH MÌ',
      style === 0
        ? ['NÂU NÓNG', 'ĐEN ĐÁ', 'TRÀ SEN', 'Mời bạn ghé chơi']
        : [
            'NÓNG MỖI NGÀY',
            'Hương vị Hà Nội',
            'Mời quý khách',
            'Mang về · Tại chỗ',
          ],
      '#243e38',
      '#e1c995',
    );
    if (style !== 0) {
      const sx = x + w * 0.32;
      block(root, sx, 0.45, front + 0.25, 0.85, 0.72, 0.48, '#777e75', true);
      block(root, sx, 0.86, front + 0.25, 0.93, 0.06, 0.57, surfaces.metal);
      const glass = new T.MeshStandardMaterial({
        color: '#b4c4bd',
        transparent: true,
        opacity: 0.2,
        metalness: 0.2,
        roughness: 0.22,
        depthWrite: false,
      });
      block(root, sx, 1.17, front + 0.47, 0.8, 0.54, 0.01, glass);
      for (const dx of [-0.41, 0.41])
        rod(
          root,
          [sx + dx, 0.9, front + 0.47],
          [sx + dx, 1.45, front + 0.47],
          0.014,
          surfaces.metal,
        );
      block(root, sx, 1.45, front + 0.26, 0.9, 0.045, 0.55, '#6f7e76');
      for (let k = 0; k < 5; k++)
        block(
          root,
          sx - 0.28 + k * 0.14,
          1.0,
          front + 0.25,
          0.1,
          0.08,
          0.25,
          '#bb8d49',
          true,
        );
      bulb(root, sx, 1.4, front + 0.38, 0.6, 0.025);
    }
  }
  if (style === 1)
    poster(
      root,
      x + w * 0.36,
      1.4,
      front + 0.16,
      0.65,
      1.05,
      'SÁCH CŨ',
      ['Văn học · Lịch sử', 'Nhận đổi sách', 'Từ 1986', 'Hà Nội trong sách'],
      '#a99b75',
      '#343f38',
    );
  if (style === 3) {
    poster(
      root,
      x - w * 0.33,
      1.4,
      front + 0.16,
      0.56,
      0.77,
      'TỔ DÂN PHỐ',
      ['Giữ ngõ phố sạch', 'Không xả rác', 'Sau 22 giờ', 'Xin đi nhẹ nói khẽ'],
      '#834932',
      '#e4d2a2',
    );
    for (let k = 0; k < 5; k++)
      block(
        root,
        x - w * 0.3 + k * w * 0.12,
        5.7,
        front + 0.62,
        0.25,
        0.48 + (k % 2) * 0.15,
        0.025,
        ['#c6ad8d', '#707c8b', '#bd8f76'][k % 3],
      );
  }
  // Bamboo blinds and side pilasters break the silhouette instead of flat box walls.
  if (style === 0 || style === 4) {
    for (let k = 0; k < 13; k++)
      block(
        root,
        x + w * 0.36,
        1.73 + k * 0.035,
        front + 0.12,
        0.63,
        0.02,
        0.04,
        surfaces.timber,
      );
  }
  for (const dx of [-w * 0.49, w * 0.49]) {
    block(
      root,
      x + dx,
      h * 0.52,
      front + 0.06,
      0.14,
      h * 0.91,
      0.16,
      '#b5ac91',
    );
    for (const y of [3.35, h - 0.22])
      block(root, x + dx, y, front + 0.1, 0.25, 0.11, 0.24, trim);
  }
  block(root, x, h - 0.13, front + 0.06, w + 0.07, 0.14, 0.34, trim);
}

export function detailedScooter(
  root: T.Object3D,
  x: number,
  z: number,
  angle: number,
  color: string,
  surfaces: Surfaces,
) {
  const bike = new T.Group();
  bike.position.set(x, 0, z);
  bike.rotation.y = angle;
  const rubber = paint('#1d2727', 0.03, 0.93),
    chrome = surfaces.metal,
    body = paint(color, 0.25, 0.31);
  for (const zz of [-0.56, 0.58]) {
    const tire = ring(bike, 0, 0.25, zz, 0.23, 0.055, rubber, Math.PI / 2);
    tire.name = 'parked-wheel';
    ring(bike, 0.002, 0.25, zz, 0.13, 0.035, chrome, Math.PI / 2);
    for (let k = 0; k < 6; k++) {
      const a = (k * Math.PI) / 3;
      rod(
        bike,
        [0.01, 0.25, zz],
        [0.01, 0.25 + Math.sin(a) * 0.14, zz + Math.cos(a) * 0.14],
        0.012,
        chrome,
      );
    }
  }
  block(bike, 0, 0.39, -0.1, 0.37, 0.18, 0.87, body, true);
  block(bike, 0, 0.62, -0.35, 0.43, 0.35, 0.68, body, true);
  block(bike, 0, 0.85, -0.29, 0.44, 0.12, 0.79, rubber, true);
  const panel = block(bike, 0, 0.62, 0.42, 0.39, 0.64, 0.14, body, true);
  panel.rotation.x = -0.19;
  rod(bike, [0, 0.24, 0.58], [0, 1.01, 0.44], 0.035, chrome, 10);
  block(bike, 0, 0.99, 0.47, 0.32, 0.17, 0.18, body, true);
  block(bike, 0, 0.99, 0.57, 0.24, 0.11, 0.02, '#ddd5ae', true);
  rod(bike, [-0.32, 1.02, 0.45], [0.32, 1.02, 0.45], 0.025, rubber, 8);
  for (const dx of [-0.24, 0.24]) {
    rod(bike, [dx, 1.03, 0.44], [dx * 1.4, 1.22, 0.41], 0.013, chrome);
    block(bike, dx * 1.4, 1.24, 0.41, 0.14, 0.08, 0.035, '#899f9b', true);
  }
  block(bike, 0, 0.62, -0.72, 0.25, 0.1, 0.04, '#8c3430');
  block(bike, 0, 0.43, -0.76, 0.21, 0.17, 0.025, '#d6cdb4');
  rod(bike, [0.18, 0.3, -0.16], [0.32, 0.015, -0.22], 0.02, chrome);
  root.add(bike);
}

export function streetLighting(
  scene: T.Scene,
  root: T.Group,
  surfaces: Surfaces,
) {
  const emitters: StreetLight[] = [];
  const lampMetal = paint('#38484b', 0.6, 0.5);
  const glowMap = (() => {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const c = canvas.getContext('2d')!;
    const gradient = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, '#fff0cbee');
    gradient.addColorStop(0.25, '#ffd68b99');
    gradient.addColorStop(1, '#efbc6500');
    c.fillStyle = gradient;
    c.fillRect(0, 0, 128, 128);
    const map = new T.CanvasTexture(canvas);
    map.colorSpace = T.SRGBColorSpace;
    return map;
  })();
  for (const z of [12.35, 30.45])
    for (const x of [8, 25, 43, 60]) {
      const lamp = new T.Group();
      lamp.position.set(x, 0, z);
      block(lamp, 0, 0.14, 0, 0.35, 0.28, 0.35, '#6c736b', true);
      rod(lamp, [0, 0, 0], [0, 5.35, 0], 0.065, lampMetal, 10);
      rod(lamp, [0, 4.6, 0], [0, 5.45, 0.65], 0.04, lampMetal);
      rod(lamp, [0, 5.45, 0.65], [0, 5.4, 1.45], 0.04, lampMetal);
      block(lamp, 0, 5.38, 1.5, 0.34, 0.11, 0.63, lampMetal, true);
      bulb(lamp, 0, 5.315, 1.5, 0.27, 0.025);
      const light = { x, y: 5.2, z: z + 1.5, color: '#ffc98a', power: 95 };
      emitters.push(light);
      if (glowMap) {
        const halo = new T.Sprite(
          new T.SpriteMaterial({
            map: glowMap,
            color: '#ffd99c',
            transparent: true,
            opacity: 0.3,
            depthWrite: false,
            blending: T.AdditiveBlending,
          }),
        );
        halo.position.set(0, 5.3, 1.5);
        halo.scale.set(0.85, 0.85, 1);
        lamp.add(halo);
        // Baked soft spill survives low quality without adding dynamic lights.
        const pool = new T.Mesh(
          new T.PlaneGeometry(8, 10),
          new T.MeshBasicMaterial({
            map: glowMap,
            color: '#d5a46b',
            transparent: true,
            opacity: 0.16,
            depthWrite: false,
            blending: T.AdditiveBlending,
          }),
        );
        pool.rotation.x = -Math.PI / 2;
        pool.position.set(0, -0.018, 2.6);
        lamp.add(pool);
      }
      root.add(lamp);
    }
  // Four nearby non-shadowed bulbs are the high setting's bounded lighting budget.
  const lights = Array.from({ length: 4 }, () => {
    const light = new T.SpotLight('#ffd19b', 95, 14, Math.PI * 0.36, 0.75, 2);
    light.visible = false;
    scene.add(light, light.target);
    return light;
  });
  // Damp patches have a genuinely rough/metallic material, rather than mirror images painted into the scene.
  const puddleMaterial = new T.MeshStandardMaterial({
    color: '#536a70',
    metalness: 0.35,
    roughness: 0.19,
    transparent: true,
    opacity: 0.46,
    depthWrite: false,
    bumpMap: surfaces.asphalt.bumpMap,
    bumpScale: 0.004,
  });
  for (let i = 0; i < 18; i++) {
    const geometry = new T.CircleGeometry(1, 24);
    const positions = geometry.attributes.position;
    for (let j = 1; j < positions.count; j++) {
      const a = (j / positions.count) * Math.PI * 2;
      const radius = 0.82 + Math.sin(j * 7 + i) * 0.13;
      positions.setXYZ(j, Math.cos(a) * radius, Math.sin(a) * radius, 0);
    }
    const mesh = new T.Mesh(geometry, puddleMaterial);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(
      3 + ((i * 8.47) % 58),
      -0.016 + (i % 3) * 0.0005,
      i % 2 ? 35.4 + Math.sin(i) : 15.7 + Math.cos(i),
    );
    mesh.scale.set(1.1 + (i % 3) * 0.7, 0.3 + (i % 4) * 0.13, 1);
    mesh.receiveShadow = true;
    root.add(mesh);
  }
  return { emitters, lights };
}

export function clearDetailMaterialCache() {
  metalColors.clear();
}
