import * as T from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  BUILDINGS,
  TREES,
  COLORS,
  SCALE,
  DEPOTS,
  CART_CAPACITY,
  waterDepth,
  rainy,
  type Game,
  type Player,
  type Task,
} from './game';
const S = SCALE;
export type Look = { yaw: number; pitch: number };
export type Settings = {
  quality: 'low' | 'high';
  sensitivity: number;
  motion: boolean;
  fov: number;
};
const mats = new Map<string, T.MeshStandardMaterial>();
function mat(color: string, roughness = 0.85) {
  const key = color + roughness;
  let m = mats.get(key);
  if (!m) {
    m = new T.MeshStandardMaterial({ color, roughness, metalness: 0 });
    mats.set(key, m);
  }
  return m;
}
function box(
  parent: T.Object3D,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  color: string | T.Material,
) {
  const mesh = new T.Mesh(
    new T.BoxGeometry(w, h, d),
    typeof color === 'string' ? mat(color) : color,
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function cylinder(
  parent: T.Object3D,
  x: number,
  y: number,
  z: number,
  rt: number,
  rb: number,
  h: number,
  color: string,
  segments = 8,
) {
  const mesh = new T.Mesh(
    new T.CylinderGeometry(rt, rb, h, segments),
    mat(color),
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}
function beam(
  parent: T.Object3D,
  a: T.Vector3,
  b: T.Vector3,
  r: number,
  color: string,
) {
  const m = cylinder(parent, 0, 0, 0, r, r, a.distanceTo(b), color, 8);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(
    new T.Vector3(0, 1, 0),
    b.clone().sub(a).normalize(),
  );
  return m;
}
function canvasTexture(
  w: number,
  h: number,
  draw: (c: CanvasRenderingContext2D) => void,
) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext('2d')!;
  draw(c);
  const tex = new T.CanvasTexture(canvas);
  tex.colorSpace = T.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
// Deterministic hand-built surface maps: no remote assets or image downloads.
function surfaceTexture(kind: 'plaster' | 'paving' | 'asphalt' | 'wood') {
  const tex = canvasTexture(512, 512, (c) => {
    let seed = 731;
    const rnd = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    c.fillStyle =
      kind === 'asphalt' ? '#888b88' : kind === 'wood' ? '#c3a371' : '#ddd9ca';
    c.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 18000; i++) {
      const v = Math.floor(95 + rnd() * 135);
      c.fillStyle = `rgba(${v},${v},${v},${kind === 'asphalt' ? 0.34 : 0.12})`;
      const x = rnd() * 512,
        y = rnd() * 512;
      c.fillRect(
        x,
        y,
        1 + rnd() * 2,
        kind === 'wood' ? 20 + rnd() * 55 : 1 + rnd() * 2,
      );
    }
    if (kind === 'plaster') {
      for (let i = 0; i < 70; i++) {
        const x = rnd() * 512,
          y = rnd() * 512,
          r = 15 + rnd() * 70;
        const g = c.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, '#6c705328');
        g.addColorStop(1, '#6c705300');
        c.fillStyle = g;
        c.fillRect(x - r, y - r, r * 2, r * 2);
      }
      for (let i = 0; i < 12; i++) {
        const x = rnd() * 512;
        c.strokeStyle = '#797c6833';
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(x, 0);
        c.lineTo(x + 15, 60 + rnd() * 180);
        c.lineTo(x + 10, 200 + rnd() * 150);
        c.stroke();
      }
    }
    if (kind === 'paving') {
      c.strokeStyle = '#85877d';
      c.lineWidth = 5;
      for (let y = 0; y <= 512; y += 128) {
        for (let x = -128; x <= 512; x += 128) {
          const xx = x + (y % 256 ? 64 : 0);
          c.strokeRect(xx, y, 128, 128);
          c.strokeStyle = '#ede7d366';
          c.lineWidth = 2;
          c.strokeRect(xx + 5, y + 5, 118, 118);
          c.strokeStyle = '#85877d';
          c.lineWidth = 5;
        }
      }
    }
    if (kind === 'asphalt') {
      c.strokeStyle = '#4e555c66';
      c.lineWidth = 1;
      for (let i = 0; i < 6; i++) {
        c.beginPath();
        let x = rnd() * 512,
          y = rnd() * 512;
        c.moveTo(x, y);
        for (let j = 0; j < 8; j++) {
          x += rnd() * 30 - 10;
          y += rnd() * 20;
          c.lineTo(x, y);
        }
        c.stroke();
      }
    }
  });
  tex.wrapS = tex.wrapT = T.RepeatWrapping;
  return tex;
}
function foliage(root: T.Group) {
  const geometry = new T.PlaneGeometry(1.05, 0.8);
  let map: T.Texture | null = null;
  if (typeof document !== 'undefined')
    map = canvasTexture(256, 256, (c) => {
      c.clearRect(0, 0, 256, 256);
      for (let i = 0; i < 33; i++) {
        const x = 128 + Math.sin(i * 12.31) * 95,
          y = 128 + Math.cos(i * 7.77) * 95;
        c.save();
        c.translate(x, y);
        c.rotate(i * 1.9);
        c.fillStyle = ['#a7b478', '#7e985c', '#bac38a', '#5c7f4d'][i % 4];
        c.beginPath();
        c.ellipse(0, 0, 8 + (i % 5), 22 + (i % 8), 0, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = '#d9d6aa88';
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(0, -20);
        c.lineTo(0, 20);
        c.stroke();
        c.restore();
      }
    });
  const material = new T.MeshStandardMaterial({
    color: '#d9dfbc',
    map,
    alphaTest: 0.5,
    side: T.DoubleSide,
    roughness: 0.95,
  });
  const leaves = new T.InstancedMesh(geometry, material, TREES.length * 90);
  leaves.castShadow = true;
  leaves.receiveShadow = true;
  const d = new T.Object3D();
  let n = 0;
  TREES.forEach((tr, i) => {
    for (let j = 0; j < 90; j++) {
      const a = j * 2.399,
        rad = Math.sqrt((j + 0.5) / 90) * 2.05;
      d.position.set(
        tr.x * S + Math.cos(a) * rad,
        3.5 + Math.sin(j * 13.7) * 0.55 + (1 - rad / 2.05) * 1.1,
        tr.y * S + Math.sin(a) * rad * 0.85,
      );
      d.rotation.set(Math.sin(j) * 0.7, j * 2.71, Math.cos(j * 4) * 0.6);
      d.scale.setScalar(0.9 + Math.sin(j * 23) * 0.22);
      d.updateMatrix();
      leaves.setMatrixAt(n, d.matrix);
      leaves.setColorAt(
        n,
        new T.Color(
          tr.flower ? '#a8c59a' : ['#e0c88c', '#c9c090', '#b2bd81'][i % 3],
        ),
      );
      n++;
    }
  });
  root.add(leaves);
}
function sign(
  parent: T.Object3D,
  text: string,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  bg = '#24473e',
  fg = '#f3dfac',
  rotation = 0,
) {
  if (typeof document === 'undefined') return;
  const texture = canvasTexture(768, 192, (c) => {
    c.fillStyle = bg;
    c.fillRect(0, 0, 768, 192);
    c.strokeStyle = fg;
    c.lineWidth = 4;
    c.strokeRect(12, 12, 744, 168);
    c.font = 'bold 60px Arial';
    c.fillStyle = fg;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(text, 384, 100, 710);
  });
  const m = new T.Mesh(
    new T.PlaneGeometry(w, h),
    new T.MeshStandardMaterial({
      map: texture,
      roughness: 0.9,
      side: T.DoubleSide,
    }),
  );
  m.position.set(x, y, z);
  m.rotation.y = rotation;
  parent.add(m);
}
function mergeStatic(root: T.Group) {
  root.updateMatrixWorld(true);
  const groups = new Map<T.Material, T.BufferGeometry[]>();
  const originals: T.Mesh[] = [];
  root.traverse((o) => {
    if (
      !(o instanceof T.Mesh) ||
      o instanceof T.InstancedMesh ||
      Array.isArray(o.material) ||
      !(o.material instanceof T.MeshStandardMaterial) ||
      o.material.map
    )
      return;
    const a = groups.get(o.material) || [];
    a.push(o.geometry.clone().applyMatrix4(o.matrixWorld));
    groups.set(o.material, a);
    originals.push(o);
  });
  originals.forEach((o) => {
    o.removeFromParent();
    o.geometry.dispose();
  });
  for (const [material, geos] of groups) {
    const merged = mergeGeometries(geos, false);
    if (merged) {
      const mesh = new T.Mesh(merged, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      root.add(mesh);
    }
    geos.forEach((g) => g.dispose());
  }
}
export const FRONTAGES = [
  {
    name: 'CÀ PHÊ PHỐ',
    color: '#d3b991',
    awning: '#506e61',
    height: 7.1,
    style: 'cafe',
  },
  {
    name: 'SÁCH CŨ THÁNG MƯỜI',
    color: '#b7bfa9',
    awning: '#52695d',
    height: 8.5,
    style: 'books',
  },
  {
    name: 'BÚN CHẢ HÀ NỘI',
    color: '#d9c295',
    awning: '#9a654c',
    height: 6.4,
    style: 'food',
  },
  {
    name: 'NHÀ TẬP THỂ 36',
    color: '#adb9b0',
    awning: '#5e7b78',
    height: 8.7,
    style: 'home',
  },
  {
    name: 'HOA TƯƠI ĐẦU NGÕ',
    color: '#ccb5a2',
    awning: '#657956',
    height: 7.3,
    style: 'flowers',
  },
  {
    name: 'BÁNH MÌ NÓNG',
    color: '#dccb9f',
    awning: '#987d4d',
    height: 6.5,
    style: 'food',
  },
  {
    name: 'TẠP HÓA CÔ LAN',
    color: '#bdc4b0',
    awning: '#52796c',
    height: 7.2,
    style: 'shop',
  },
  {
    name: 'SỬA XE CHÚ HÙNG',
    color: '#b5b4a5',
    awning: '#596c72',
    height: 6.3,
    style: 'repair',
  },
];
function facade(
  parent: T.Object3D,
  cx: number,
  cz: number,
  w: number,
  d: number,
  h: number,
  index: number,
) {
  const f = FRONTAGES[index % 8],
    plaster = mat(f.color);
  if (typeof document !== 'undefined' && !plaster.map) {
    plaster.map = surfaceTexture('plaster');
    plaster.map.repeat.set(1, 2);
    plaster.bumpMap = plaster.map;
    plaster.bumpScale = 0.025;
  }
  box(parent, cx, h / 2, cz, w, h, d, plaster);
  box(parent, cx, 0.32, cz + d / 2 + 0.04, w, 0.64, 0.14, '#899284');
  box(parent, cx, h + 0.08, cz, w + 0.12, 0.18, d + 0.12, '#68786d');
  const front = cz + d / 2 + 0.09;
  box(parent, cx, 0.1, front, w, 0.2, 0.025, '#697768');
  beam(
    parent,
    new T.Vector3(cx - w * 0.46, 0.1, front + 0.12),
    new T.Vector3(cx - w * 0.46, h - 0.1, front + 0.12),
    0.035,
    '#627267',
  );
  box(parent, cx, h - 0.35, front + 0.08, w, 0.13, 0.22, '#e2cfad');
  const door = Math.min(2.3, w * 0.55),
    glass = f.style === 'cafe' || f.style === 'books' || f.style === 'flowers';
  box(parent, cx, 1.2, front, door, 2.15, 0.07, glass ? '#334e49' : '#62776d');
  if (glass) {
    for (const dx of [-door / 2, 0, door / 2])
      box(parent, cx + dx, 1.2, front + 0.07, 0.06, 2.1, 0.04, '#a99573');
    box(parent, cx, 1.2, front + 0.08, door, 0.055, 0.04, '#a99573');
    box(parent, cx + 0.12, 1.1, front + 0.1, 0.025, 0.35, 0.04, '#dbcfab');
  } else
    for (let i = 0; i < 10; i++)
      box(
        parent,
        cx,
        0.28 + i * 0.21,
        front + 0.05,
        door,
        0.018,
        0.03,
        '#97a394',
      );
  const stripCount = Math.max(4, Math.floor(w / 0.35));
  for (let k = 0; k < stripCount; k++) {
    const aw = box(
      parent,
      cx - w / 2 + ((k + 0.5) * w) / stripCount,
      2.55,
      front + 0.45,
      w / stripCount,
      0.05,
      0.94,
      k % 2 ? '#d7ccb0' : f.awning,
    );
    aw.rotation.x = 0.13;
    box(
      parent,
      cx - w / 2 + ((k + 0.5) * w) / stripCount,
      2.42,
      front + 0.91,
      w / stripCount,
      0.18,
      0.035,
      k % 2 ? '#d7ccb0' : f.awning,
    );
  }
  box(parent, cx, 2.98, front, w - 0.17, 0.58, 0.16, f.awning);
  sign(parent, f.name, cx, 2.98, front + 0.09, w - 0.3, 0.51, f.awning);
  sign(
    parent,
    String(12 + index * 2),
    cx - w * 0.43,
    1.92,
    front + 0.12,
    0.3,
    0.26,
    '#294f63',
    '#e9e3ce',
  );
  for (let level = 4.15; level < h - 0.55; level += 2.25) {
    for (const xx of [cx - w * 0.24, cx + w * 0.24]) {
      box(parent, xx, level, front, 1.05, 1.4, 0.09, '#48645a');
      for (const dx of [-0.54, 0.54])
        box(parent, xx + dx, level, front + 0.06, 0.06, 1.48, 0.07, '#d0c7ac');
      box(parent, xx, level, front + 0.08, 0.045, 1.35, 0.03, '#c6c6ac');
      box(parent, xx, level - 0.75, front + 0.16, 1.24, 0.12, 0.38, '#c6baa3');
    }
    if (index % 3 !== 2) {
      box(
        parent,
        cx,
        level - 0.73,
        front + 0.38,
        w * 0.83,
        0.12,
        0.76,
        '#a7ad97',
      );
      for (let j = 0; j < 12; j++)
        box(
          parent,
          cx - w * 0.39 + j * w * 0.071,
          level - 0.34,
          front + 0.78,
          0.025,
          0.75,
          0.025,
          '#3f5f52',
        );
      box(
        parent,
        cx,
        level + 0.05,
        front + 0.78,
        w * 0.83,
        0.045,
        0.04,
        '#3f5f52',
      );
      for (const dx of [-w * 0.3, w * 0.3]) {
        box(
          parent,
          cx + dx,
          level - 0.52,
          front + 0.5,
          0.5,
          0.27,
          0.28,
          '#a87b5a',
        );
        for (let k = 0; k < 3; k++)
          cylinder(
            parent,
            cx + dx + (k - 1) * 0.14,
            level - 0.28,
            front + 0.5,
            0.13,
            0.09,
            0.3,
            '#6d865c',
            6,
          );
      }
    }
  }
  if (f.style === 'home') {
    beam(
      parent,
      new T.Vector3(cx - w * 0.35, 4.8, front + 0.7),
      new T.Vector3(cx + w * 0.35, 4.8, front + 0.7),
      0.012,
      '#b3b8a2',
    );
    for (let q = 0; q < 3; q++)
      box(
        parent,
        cx - w * 0.23 + q * w * 0.23,
        4.46,
        front + 0.7,
        0.42,
        0.65,
        0.025,
        ['#e3bc91', '#b0b4ad', '#7d9b9f'][q],
      );
  }
  if (f.style === 'books') {
    for (let shelf = 0; shelf < 3; shelf++) {
      box(
        parent,
        cx - w * 0.35,
        0.45 + shelf * 0.35,
        front + 0.18,
        0.6,
        0.04,
        0.3,
        '#917a58',
      );
      for (let k = 0; k < 5; k++)
        box(
          parent,
          cx - w * 0.35 - 0.23 + k * 0.11,
          0.6 + shelf * 0.35,
          front + 0.18,
          0.08,
          0.24,
          0.2,
          ['#bc9563', '#7c937d', '#c8b68a'][k % 3],
        );
    }
  }
  if (f.style === 'food') {
    box(parent, cx + w * 0.34, 0.55, front + 0.28, 0.72, 1.05, 0.48, '#789185');
    box(parent, cx + w * 0.34, 1.1, front + 0.28, 0.84, 0.06, 0.6, '#c9c4ae');
  }
  if (f.style === 'flowers') {
    for (let k = 0; k < 3; k++) {
      cylinder(
        parent,
        cx - w * 0.35,
        0.23,
        front + 0.17 + k * 0.3,
        0.18,
        0.13,
        0.4,
        '#ac815c',
      );
      for (let j = 0; j < 4; j++) {
        cylinder(
          parent,
          cx - w * 0.35 + Math.sin(j * 3) * 0.12,
          0.65,
          front + 0.17 + k * 0.3,
          0.02,
          0.02,
          0.55,
          '#6b895e',
        );
        cylinder(
          parent,
          cx - w * 0.35 + Math.sin(j * 3) * 0.12,
          0.95,
          front + 0.17 + k * 0.3,
          0.08,
          0.06,
          0.12,
          ['#e8d6a0', '#d7a493'][k % 2],
          6,
        );
      }
    }
  }
  if (f.style === 'repair') {
    const tire = new T.Mesh(
      new T.TorusGeometry(0.28, 0.07, 6, 12),
      mat('#344a3f'),
    );
    tire.position.set(cx + w * 0.35, 0.42, front + 0.13);
    parent.add(tire);
    sign(
      parent,
      'VÁ SĂM · BƠM HƠI',
      cx - w * 0.33,
      1.15,
      front + 0.12,
      0.9,
      0.65,
      '#485d55',
    );
  }
  box(parent, cx + w * 0.3, h - 0.65, front + 0.25, 0.75, 0.4, 0.38, '#d4c9ad');
  for (let j = 0; j < 5; j++)
    box(
      parent,
      cx + w * 0.3 - 0.25 + j * 0.12,
      h - 0.65,
      front + 0.45,
      0.025,
      0.28,
      0.02,
      '#838f81',
    );
  cylinder(parent, cx - 0.6, h + 0.53, cz, 0.38, 0.38, 0.85, '#adb8b1', 12);
  for (let q = 0; q < 3; q++)
    cylinder(
      parent,
      cx - 0.6,
      h + 0.2 + q * 0.28,
      cz,
      0.395,
      0.395,
      0.025,
      '#d8d7c8',
      12,
    );
}
function label(text: string, color = '#f2dfad') {
  const map =
    typeof document === 'undefined'
      ? null
      : canvasTexture(512, 96, (c) => {
          c.fillStyle = '#203b32e8';
          c.fillRect(0, 0, 512, 96);
          c.fillStyle = color;
          c.font = 'bold 32px Arial';
          c.textAlign = 'center';
          c.textBaseline = 'middle';
          c.fillText(text, 256, 48, 484);
        });
  const sprite = new T.Sprite(
    new T.SpriteMaterial({
      map,
      color: map ? '#ffffff' : color,
      transparent: true,
      depthTest: true,
      depthWrite: false,
    }),
  );
  sprite.scale.set(2.6, 0.49, 1);
  return sprite;
}
function disposeLabel(sprite: T.Sprite) {
  sprite.material.map?.dispose();
  sprite.material.dispose();
}

function cartMesh() {
  const root = new T.Group();
  box(root, 0, 0.65, 0, 0.92, 0.76, 1.1, '#3e705e');
  box(root, 0, 1.04, 0, 1.03, 0.09, 1.2, '#7d9f81');
  box(root, 0, 1.09, 0, 0.78, 0.02, 0.95, '#244b40');
  box(root, 0, 0.8, 0.56, 0.58, 0.15, 0.01, '#e1d7a4');
  for (const x of [-0.51, 0.51])
    for (const z of [-0.32, 0.32]) {
      const wheel = cylinder(root, x, 0.24, z, 0.23, 0.23, 0.12, '#2b3b35', 12);
      wheel.rotation.z = Math.PI / 2;
      wheel.name = 'wheel';
      box(root, x, 0.24, z, 0.14, 0.06, 0.36, '#798378');
    }
  for (const x of [-0.41, 0.41])
    beam(
      root,
      new T.Vector3(x, 0.65, -0.5),
      new T.Vector3(x, 1.05, -0.85),
      0.035,
      '#9aa99d',
    );
  beam(
    root,
    new T.Vector3(-0.41, 1.05, -0.85),
    new T.Vector3(0.41, 1.05, -0.85),
    0.045,
    '#293e34',
  );
  sign(root, 'VỆ SINH', 0, 0.78, 0.57, 0.65, 0.18, '#325d4e', '#e9e1ae');
  for (const x of [-0.46, 0.46])
    box(root, x, 0.65, 0.56, 0.035, 0.68, 0.025, '#829785');
  const load = new T.Group();
  load.name = 'load';
  for (let j = 0; j < 24; j++) {
    const m = new T.Mesh(
      new T.IcosahedronGeometry(0.12 + (j % 3) * 0.015, 0),
      mat(['#a58049', '#bc9755', '#73784d'][j % 3]),
    );
    m.position.set(
      Math.sin(j * 12) * 0.3,
      (j % 3) * 0.08,
      Math.cos(j * 7) * 0.4,
    );
    m.scale.y = 0.35;
    load.add(m);
  }
  root.add(load);
  return root;
}
function person(color: string) {
  const root = new T.Group();
  box(root, -0.14, 0.42, 0, 0.18, 0.74, 0.2, '#34483f');
  box(root, 0.14, 0.42, 0, 0.18, 0.74, 0.2, '#34483f');
  box(root, -0.14, 0.08, 0.07, 0.22, 0.15, 0.37, '#22362e');
  box(root, 0.14, 0.08, 0.07, 0.22, 0.15, 0.37, '#22362e');
  cylinder(root, 0, 1.02, 0, 0.27, 0.22, 0.65, color);
  box(root, 0, 0.94, 0.24, 0.46, 0.09, 0.025, '#e1e7b9');
  cylinder(root, 0, 1.51, 0, 0.16, 0.17, 0.3, '#c49b78', 10);
  cylinder(root, 0, 1.68, 0, 0, 0.34, 0.2, '#ceba86', 12);
  box(root, 0, 1.48, 0.16, 0.1, 0.09, 0.08, '#c49b78');
  beam(
    root,
    new T.Vector3(-0.24, 1.23, 0),
    new T.Vector3(-0.32, 0.85, 0.2),
    0.09,
    color,
  );
  beam(
    root,
    new T.Vector3(0.24, 1.23, 0),
    new T.Vector3(0.32, 0.85, 0.25),
    0.09,
    color,
  );
  beam(
    root,
    new T.Vector3(0.32, 0.95, 0.25),
    new T.Vector3(0.5, 0.12, 0.7),
    0.025,
    '#a28b61',
  );
  box(root, 0.5, 0.1, 0.7, 0.36, 0.15, 0.16, '#c5ac6b');
  return root;
}
export function createWorld() {
  const scene = new T.Scene();
  scene.background = new T.Color('#dfd2b5');
  scene.fog = new T.Fog('#dfd2b5', 30, 95);
  const hemi = new T.HemisphereLight('#f4e8ce', '#6b7969', 2.4);
  scene.add(hemi);
  const sun = new T.DirectionalLight('#ffdab1', 3.4);
  sun.position.set(12, 24, -15);
  sun.target.position.set(32, 0, 22);
  scene.add(sun, sun.target);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -45;
  sun.shadow.camera.right = 45;
  sun.shadow.camera.top = 35;
  sun.shadow.camera.bottom = -35;
  sun.shadow.camera.far = 90;
  sun.shadow.normalBias = 0.035;
  sun.shadow.bias = -0.0002;
  const staticRoot = new T.Group();
  scene.add(staticRoot);
  const asphalt = mat('#9b9c94', 0.92);
  if (typeof document !== 'undefined') {
    asphalt.map = surfaceTexture('asphalt');
    asphalt.map.repeat.set(30, 24);
    asphalt.bumpMap = asphalt.map;
    asphalt.bumpScale = 0.022;
    asphalt.roughnessMap = asphalt.map;
    asphalt.needsUpdate = true;
  }
  box(staticRoot, 32, -0.18, 20, 110, 0.3, 100, asphalt);
  // Slight raised pavements along both active streets.
  const paving = mat('#c7c6b7');
  if (typeof document !== 'undefined') {
    paving.map = surfaceTexture('paving');
    paving.map.repeat.set(20, 1);
    paving.bumpMap = paving.map;
    paving.bumpScale = 0.045;
  }
  [
    [32, 11.6, 64, 1.1],
    [32, 30.2, 64, 2.7],
    [32, 39.8, 64, 0.8],
  ].forEach(([x, z, w, d]) => {
    box(staticRoot, x, 0, z, w, 0.14, d, paving);
    for (let k = 0; k < w; k += 0.7)
      box(staticRoot, x - w / 2 + k, 0.08, z, 0.018, 0.01, d, '#959f91');
  });
  for (const z of [16, 35])
    for (let x = 1; x < 64; x += 3.6)
      box(staticRoot, x, 0.006, z, 1.6, 0.015, 0.07, '#cfc7a4');
  // Block footprints match authoritative collision geometry.
  BUILDINGS.forEach((b, i) => {
    const w = b.w * S,
      d = b.h * S,
      cx = (b.x + b.w / 2) * S,
      cz = (b.y + b.h / 2) * S;
    const count = i < 3 ? 3 : i === 5 ? 2 : 3,
      offset = i < 3 ? i * 3 : i === 3 ? 0 : i === 4 ? 3 : 6;
    for (let k = 0; k < count; k++) {
      const fw = w / count,
        index = offset + k;
      facade(
        staticRoot,
        cx - w / 2 + fw * (k + 0.5),
        cz,
        fw - 0.05,
        d,
        FRONTAGES[index % 8].height,
        index,
      );
    }
  });
  // Facing houses on the far pavement make the playable street feel enclosed.
  for (let i = 0; i < 8; i++) {
    const g = new T.Group();
    g.position.set(4 + i * 8, 0, 44.5);
    g.rotation.y = Math.PI;
    facade(g, 0, 0, 7.9, 8, FRONTAGES[i].height, i);
    staticRoot.add(g);
  }
  for (let x = -15; x < 90; x += 12)
    box(staticRoot, x, 5, -4, 8, 8, 8, '#a8b4a3');
  // Low walls at street ends mark the actual walking boundary.
  for (const x of [-0.15, 64.15]) {
    box(staticRoot, x, 0.5, 26, 0.3, 1, 29, '#8a9988');
    for (let z = 12; z < 40; z += 2.5)
      cylinder(staticRoot, x, 1.35, z, 0.06, 0.06, 1.7, '#586e5b');
  }
  TREES.forEach((tr, i) => {
    const x = tr.x * S,
      z = tr.y * S;
    box(staticRoot, x, 0.1, z, 1.1, 0.18, 1.1, '#777e62');
    cylinder(staticRoot, x, 1.7, z, 0.11, 0.22, 3.4, '#736c50');
    beam(
      staticRoot,
      new T.Vector3(x, 2.2, z),
      new T.Vector3(x - 0.8, 3.5, z),
      0.09,
      '#736c50',
    );
    for (let j = 0; j < 6; j++) {
      const a = j * 1.047;
      beam(
        staticRoot,
        new T.Vector3(x, 2.4, z),
        new T.Vector3(
          x + Math.cos(a) * 1.45,
          3.55 + (j % 2) * 0.5,
          z + Math.sin(a) * 1.3,
        ),
        0.045,
        '#736c50',
      );
    }
    if (tr.flower)
      for (let j = 0; j < 18; j++) {
        const m = new T.Mesh(
          new T.IcosahedronGeometry(0.06, 0),
          mat('#e9dfad'),
        );
        m.position.set(
          x + Math.sin(j * 2.4) * 1.8,
          3.4 + (j % 4) * 0.22,
          z + Math.cos(j * 2.4) * 1.1,
        );
        staticRoot.add(m);
      }
    if (i % 2 === 0) {
      cylinder(staticRoot, x + 1.15, 2.2, z, 0.045, 0.07, 4.4, '#455e50');
      beam(
        staticRoot,
        new T.Vector3(x + 1.15, 4.3, z),
        new T.Vector3(x + 1.15, 4.5, z + 0.8),
        0.04,
        '#455e50',
      );
      box(staticRoot, x + 1.15, 4.48, z + 0.8, 0.24, 0.08, 0.45, '#e3d2a2');
    }
  });
  // Cafe furniture, parked scooters and cables.
  for (const x of [5, 7.2, 49, 52]) {
    cylinder(staticRoot, x, 0.57, 12.3, 0.4, 0.4, 0.07, '#597667');
    cylinder(staticRoot, x, 0.3, 12.3, 0.05, 0.05, 0.6, '#405747');
    for (const dx of [-0.55, 0.55]) {
      box(staticRoot, x + dx, 0.3, 12.5, 0.32, 0.06, 0.32, '#747f59');
      for (const ex of [-0.1, 0.1])
        box(staticRoot, x + dx + ex, 0.14, 12.5, 0.035, 0.28, 0.24, '#747f59');
    }
  }
  for (const x of [11, 14, 29, 56]) {
    const bike = new T.Group();
    for (const z of [-0.5, 0.5]) {
      const wheel = cylinder(bike, 0, 0.26, z, 0.25, 0.25, 0.1, '#303e35', 12);
      wheel.rotation.z = Math.PI / 2;
    }
    box(bike, 0, 0.55, 0, 0.35, 0.4, 0.8, '#6c7f76');
    box(bike, 0, 0.82, -0.1, 0.4, 0.12, 0.65, '#263d32');
    beam(
      bike,
      new T.Vector3(0, 0.4, 0.5),
      new T.Vector3(0, 1, 0.35),
      0.035,
      '#a7b0a0',
    );
    beam(
      bike,
      new T.Vector3(-0.28, 1, 0.35),
      new T.Vector3(0.28, 1, 0.35),
      0.03,
      '#3a5343',
    );
    bike.position.set(x, 0, 29.5);
    bike.rotation.y = 0.6;
    staticRoot.add(bike);
  }
  for (const z of [12, 30])
    for (let j = 0; j < 2; j++) {
      const points = Array.from(
        { length: 30 },
        (_, i) =>
          new T.Vector3(i * 2.3, 4.7 + j * 0.13 - Math.sin(i * 0.38) * 0.3, z),
      );
      const curve = new T.CatmullRomCurve3(points);
      const wire = new T.Mesh(
        new T.TubeGeometry(curve, 80, 0.014, 4, false),
        mat('#465544'),
      );
      staticRoot.add(wire);
    }
  foliage(staticRoot);
  DEPOTS.forEach((d, i) => {
    const x = d.x * S,
      z = d.y * S;
    for (const dz of [-1.7, 1.7])
      box(staticRoot, x, 0.015, z + dz, 3.8, 0.025, 0.075, '#e6c76f');
    for (const dx of [-1.9, 1.9])
      box(staticRoot, x + dx, 0.015, z, 0.075, 0.025, 3.4, '#e6c76f');
    cylinder(staticRoot, x + 1.65, 1.3, z - 1.6, 0.035, 0.035, 2.6, '#6e8071');
    sign(
      staticRoot,
      'TẬP KẾT ' + (i + 1),
      x + 1.65,
      2.4,
      z - 1.6,
      1.8,
      0.5,
      '#a48340',
      '#fff0c1',
    );
    for (const dx of [-1.5, 1.5]) {
      cylinder(staticRoot, x + dx, 0.26, z - 1.5, 0.04, 0.16, 0.5, '#d5a253');
      cylinder(staticRoot, x + dx, 0.3, z - 1.5, 0.09, 0.11, 0.11, '#eae0bd');
    }
  });
  sign(
    staticRoot,
    'PHỐ NGUYỄN DU',
    20.8,
    2.4,
    29.2,
    2,
    0.5,
    '#2f576a',
    '#eeead2',
  );
  cylinder(staticRoot, 20.8, 1.25, 29.2, 0.035, 0.035, 2.5, '#6d7f71');
  sign(
    staticRoot,
    'PHỐ PHAN ĐÌNH PHÙNG',
    20.2,
    2.5,
    12.6,
    2.4,
    0.5,
    '#2f576a',
    '#eeead2',
  );
  const board = new T.Group();
  board.position.set(22.1, 0, 38.2);
  for (const z of [-0.8, 0.8])
    box(board, 0, 0.85, z, 0.07, 1.7, 0.07, '#6c795f');
  box(board, 0, 1.45, 0, 0.1, 1.16, 2, '#34574b');
  [
    'CA ĐẦU · LÀM CÙNG NHAU',
    '1 · C + E QUÉT LÁ',
    '2 · XẺNG + E HỐT',
    'E ĐỔ XE · Q ĐẨY · E BÀN GIAO',
  ].forEach((text, i) =>
    sign(
      board,
      text,
      -0.06,
      1.85 - i * 0.27,
      0,
      1.9,
      0.23,
      '#34574b',
      '#f0dfac',
      -Math.PI / 2,
    ),
  );
  staticRoot.add(board);
  mergeStatic(staticRoot);
  return { scene, sun, hemi };
}
export function createFirstPersonScene(
  canvas: HTMLCanvasElement,
  settings: Settings,
) {
  const renderer = new T.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(
    Math.min(devicePixelRatio, settings.quality === 'high' ? 1.7 : 1),
  );
  renderer.shadowMap.enabled = settings.quality === 'high';
  renderer.shadowMap.type = T.PCFShadowMap;
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const { scene, sun, hemi } = createWorld();
  const pmrem = new T.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.04);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.35;
  room.dispose();
  pmrem.dispose();
  const camera = new T.PerspectiveCamera(settings.fov, 1, 0.04, 130);
  camera.rotation.order = 'YXZ';
  const leafGeo = new T.BufferGeometry();
  leafGeo.setAttribute(
    'position',
    new T.Float32BufferAttribute(
      [
        0, 0.018, 0, 0, 0.006, -0.13, -0.034, 0.008, -0.075, -0.06, 0, 0,
        -0.034, 0.006, 0.075, 0, 0.01, 0.13, 0.034, 0.006, 0.075, 0.06, 0, 0,
        0.034, 0.008, -0.075,
      ],
      3,
    ),
  );
  leafGeo.setIndex([
    0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 5, 0, 5, 6, 0, 6, 7, 0, 7, 8, 0, 8, 1,
  ]);
  leafGeo.computeVertexNormals();
  const leafMaterial = new T.MeshStandardMaterial({
    color: '#e0af55',
    roughness: 0.9,
    side: T.DoubleSide,
  });
  const leaves = new T.InstancedMesh(leafGeo, leafMaterial, 1600);
  leaves.instanceMatrix.setUsage(T.DynamicDrawUsage);
  leaves.receiveShadow = true;
  leaves.frustumCulled = false;
  scene.add(leaves);
  const dummy = new T.Object3D();
  const cartModels = new Map<string, T.Group>(),
    people = new Map<string, T.Group>();
  const pileLeaves = new T.InstancedMesh(leafGeo, leafMaterial, 4000);
  pileLeaves.frustumCulled = false;
  pileLeaves.receiveShadow = true;
  pileLeaves.castShadow = true;
  scene.add(pileLeaves);
  const drains: T.Group[] = [];
  const waters: T.Mesh[] = [];
  for (let i = 0; i < 6; i++) {
    const root = new T.Group();
    box(root, 0, 0.012, 0, 1.03, 0.03, 0.72, '#45554f');
    for (let j = 0; j < 8; j++)
      box(root, -0.43 + j * 0.12, 0.04, 0, 0.05, 0.025, 0.6, '#abb0a0');
    box(root, -0.6, 0.23, 0, 0.07, 0.46, 0.07, '#d9c29b');
    box(root, 0.6, 0.23, 0, 0.07, 0.46, 0.07, '#d9c29b');
    const clog = new T.Group();
    clog.name = 'clog';
    for (let k = 0; k < 14; k++) {
      const m = new T.Mesh(
        new T.IcosahedronGeometry(0.1, 0),
        mat(k % 3 ? '#a98c51' : '#72766b'),
      );
      m.position.set(Math.sin(k * 13) * 0.36, 0.07, Math.cos(k * 8) * 0.26);
      m.scale.set(1, 0.3, 1.5);
      clog.add(m);
    }
    root.add(clog);
    scene.add(root);
    drains.push(root);
    const water = new T.Mesh(
      new T.CircleGeometry(1, 64),
      new T.MeshStandardMaterial({
        color: '#75989b',
        transparent: true,
        opacity: 0.62,
        roughness: 0.24,
        metalness: 0.3,
        side: T.DoubleSide,
        depthWrite: false,
      }),
    );
    water.rotation.x = -Math.PI / 2;
    water.renderOrder = 2;
    const material = water.material as T.MeshStandardMaterial;
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: 0 };
      material.userData.shader = shader;
      shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\n transformed.z += sin(position.x*17.0+uTime*2.0)*cos(position.y*13.0-uTime)*0.006;',
      );
      shader.fragmentShader = 'uniform float uTime;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <roughnessmap_fragment>',
        '#include <roughnessmap_fragment>\n roughnessFactor = 0.23 + 0.08*sin(gl_FragCoord.x*0.07 + gl_FragCoord.y*0.12 + uTime*2.0);',
      );
    };
    scene.add(water);
    waters.push(water);
  }
  const ripples = new T.InstancedMesh(
    new T.RingGeometry(0.87, 1, 32),
    new T.MeshBasicMaterial({
      color: '#bfd1c5',
      transparent: true,
      opacity: 0.24,
      side: T.DoubleSide,
      depthWrite: false,
    }),
    36,
  );
  ripples.frustumCulled = false;
  scene.add(ripples);
  const ring = new T.Mesh(
    new T.RingGeometry(0.23, 0.26, 32),
    new T.MeshBasicMaterial({
      color: '#fae3a0',
      transparent: true,
      opacity: 0.85,
      side: T.DoubleSide,
      depthTest: false,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.renderOrder = 5;
  scene.add(ring);
  const rainGeo = new T.BufferGeometry(),
    rainPositions = new Float32Array(1400 * 3);
  for (let i = 0; i < 1400; i++) {
    rainPositions[i * 3] = Math.random() * 64;
    rainPositions[i * 3 + 1] = Math.random() * 13;
    rainPositions[i * 3 + 2] = 12 + Math.random() * 28;
  }
  rainGeo.setAttribute('position', new T.BufferAttribute(rainPositions, 3));
  const rain = new T.Points(
    rainGeo,
    new T.PointsMaterial({
      color: '#dce7df',
      size: 0.045,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    }),
  );
  scene.add(rain);
  const falling = new T.InstancedMesh(leafGeo, leafMaterial, 50);
  falling.frustumCulled = false;
  scene.add(falling);
  const viewScene = new T.Scene();
  viewScene.add(new T.HemisphereLight('#fff1da', '#7e8b76', 3.4));
  const vSun = new T.DirectionalLight('#ffe9bf', 2);
  vSun.position.set(-2, 4, 3);
  viewScene.add(vSun);
  const viewCamera = new T.PerspectiveCamera(66, 1, 0.02, 4);
  const broom = new T.Group();
  beam(
    broom,
    new T.Vector3(0.23, -0.24, -0.45),
    new T.Vector3(0.46, -0.79, -1.35),
    0.022,
    '#a58b58',
  );
  for (let i = 0; i < 45; i++) {
    const f = i / 44;
    beam(
      broom,
      new T.Vector3(0.41 + f * 0.1, -0.75, -1.35),
      new T.Vector3(0.17 + f * 0.59, -1.01 + Math.sin(i * 7) * 0.02, -1.43),
      0.0035,
      i % 3 ? '#c5ac74' : '#8e7749',
    );
  }
  for (let k = 0; k < 4; k++)
    beam(
      broom,
      new T.Vector3(0.39, -0.77 - k * 0.015, -1.37),
      new T.Vector3(0.53, -0.77 - k * 0.015, -1.37),
      0.008,
      '#6c7658',
    );
  beam(
    broom,
    new T.Vector3(0.65, -0.62, -0.1),
    new T.Vector3(0.31, -0.32, -0.61),
    0.095,
    '#e4a54e',
  );
  cylinder(broom, 0.29, -0.3, -0.6, 0.07, 0.07, 0.2, '#c4b995');
  viewScene.add(broom);
  const scoop = new T.Group();
  beam(
    scoop,
    new T.Vector3(0.3, -0.3, -0.45),
    new T.Vector3(0.32, -0.55, -1.2),
    0.025,
    '#ac936a',
  );
  const blade = box(
    scoop,
    0.32,
    -0.58,
    -1.35,
    0.4,
    0.028,
    0.45,
    mat('#93a39b', 0.28),
  );
  blade.rotation.x = 0.17;
  for (const x of [0.12, 0.52])
    box(scoop, x, -0.54, -1.36, 0.025, 0.09, 0.46, '#62776e');
  box(scoop, 0.32, -0.53, -1.13, 0.4, 0.11, 0.025, '#71857b');
  beam(
    scoop,
    new T.Vector3(0.66, -0.6, -0.1),
    new T.Vector3(0.33, -0.35, -0.6),
    0.09,
    '#dfa351',
  );
  box(scoop, 0.32, -0.34, -0.59, 0.13, 0.16, 0.15, '#c5bd9d');
  const scoopLoad = new T.InstancedMesh(leafGeo, leafMaterial, 24);
  scoopLoad.instanceMatrix.setUsage(T.DynamicDrawUsage);
  scoop.add(scoopLoad);
  viewScene.add(scoop);
  const pushHands = new T.Group();
  for (const x of [-0.36, 0.36]) {
    beam(
      pushHands,
      new T.Vector3(x * 1.8, -0.62, -0.05),
      new T.Vector3(x, -0.4, -0.75),
      0.09,
      '#dfa351',
    );
    box(pushHands, x, -0.4, -0.75, 0.13, 0.13, 0.19, '#c5bd9d');
  }
  beam(
    pushHands,
    new T.Vector3(-0.48, -0.44, -0.8),
    new T.Vector3(0.48, -0.44, -0.8),
    0.038,
    '#41594a',
  );
  viewScene.add(pushHands);
  let last = 0,
    camX = 19,
    camZ = 36.5,
    eye = 1.68,
    lastSettings = JSON.stringify(settings);
  const smoothLeaves = new Map<number, T.Vector2>();
  const pingModels = new Map<string, T.Group>();
  const zoneLabels: T.Sprite[][] = [];
  for (let i = 0; i < 3; i++) {
    const pair = [
      label(['GÓC CÀ PHÊ', 'HIÊN TẬP THỂ', 'DÃY HÀNG QUEN'][i]),
      label('✓ KHU PHỐ ĐÃ SẠCH', '#e9d38e'),
    ];
    pair.forEach((m) => {
      m.position.set((i * 430 + 215) * S, 1.1, 39.5);
      scene.add(m);
    });
    zoneLabels.push(pair);
  }
  let lastRound = -1;
  const workingTarget = new T.Vector3();
  const resize = () => {
    const w = canvas.clientWidth,
      h = canvas.clientHeight;
    if (w && h) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      viewCamera.aspect = w / h;
      viewCamera.updateProjectionMatrix();
    }
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();
  function render(
    g: Game,
    myId: string,
    look: Look,
    t: number,
    options: {
      menu: boolean;
      moving: boolean;
      task: Task | null;
      settings: Settings;
      active: boolean;
    },
  ) {
    const dt = Math.min((t - last) / 1000, 0.05) || 0.016;
    last = t;
    const p = g.players.find((p) => p.id === myId);
    const rs = options.settings;
    const key = JSON.stringify(rs);
    if (key !== lastSettings) {
      renderer.setPixelRatio(
        Math.min(devicePixelRatio, rs.quality === 'high' ? 1.7 : 1),
      );
      renderer.shadowMap.enabled = rs.quality === 'high';
      camera.fov = rs.fov;
      camera.updateProjectionMatrix();
      resize();
      lastSettings = key;
    }
    if (g.round !== lastRound) {
      lastRound = g.round;
      smoothLeaves.clear();
      cartModels.forEach((model) => (model.userData.placed = false));
      people.forEach((model, id) => {
        const other = g.players.find((p) => p.id === id);
        if (other) model.position.set(other.x * S, 0, other.y * S);
      });
      if (p) {
        camX = p.x * S;
        camZ = p.y * S;
      }
    }
    const wet = rainy(g);
    const sky = wet ? '#9bada6' : '#dfd2b5';
    (scene.background as T.Color).lerp(new T.Color(sky), dt * 2);
    (scene.fog as T.Fog).color.copy(scene.background as T.Color);
    sun.intensity = T.MathUtils.lerp(sun.intensity, wet ? 1.1 : 3.4, dt * 2);
    hemi.intensity = wet ? 2 : 2.4;
    if (p && !options.menu) {
      const f = 1 - Math.exp(-dt * 24);
      camX += (p.x * S - camX) * f;
      camZ += (p.y * S - camZ) * f;
      eye += ((p.crouched ? 1.04 : 1.68) - eye) * (1 - Math.exp(-dt * 12));
      const bob = rs.motion && options.moving ? Math.sin(t * 0.009) * 0.018 : 0;
      camera.position.set(camX, eye + bob, camZ);
      camera.rotation.set(look.pitch, look.yaw, 0, 'YXZ');
    } else {
      camera.position.set(19.2, 1.68, 36.4);
      camera.rotation.set(
        -0.055,
        -Math.PI / 2 + Math.sin(t * 0.00007) * 0.05,
        0,
        'YXZ',
      );
      camX = 19.2;
      camZ = 36.4;
    }
    const groundMaterial = mat('#9b9c94', 0.92);
    groundMaterial.roughness = T.MathUtils.lerp(
      groundMaterial.roughness,
      wet ? 0.38 : 0.92,
      dt,
    );
    groundMaterial.color.lerp(new T.Color(wet ? '#7f8987' : '#9b9c94'), dt);
    for (const id of smoothLeaves.keys())
      if (!g.leaves.some((l) => l.id === id)) smoothLeaves.delete(id);
    let count = 0;
    for (const l of g.leaves) {
      let position = smoothLeaves.get(l.id);
      if (!position) {
        position = new T.Vector2(l.x, l.y);
        smoothLeaves.set(l.id, position);
      }
      position.lerp(new T.Vector2(l.x, l.y), 1 - Math.exp(-dt * 24));
      for (let j = 0; j < 10; j++) {
        dummy.position.set(
          position.x * S + Math.sin(l.id * 7 + j * 2.3) * 0.3,
          0.016 + (j % 3) * 0.009,
          position.y * S + Math.cos(l.id * 3 + j * 2.8) * 0.24,
        );
        dummy.rotation.set(0, l.id + j * 1.3, 0);
        dummy.scale.setScalar(0.8 + (j % 3) * 0.25);
        dummy.updateMatrix();
        leaves.setMatrixAt(count, dummy.matrix);
        leaves.setColorAt(
          count,
          new T.Color(['#cea55c', '#b88b48', '#dfbc68', '#9d9c55'][l.kind]),
        );
        count++;
      }
    }
    leaves.count = count;
    leaves.instanceMatrix.needsUpdate = true;
    if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
    let pileCount = 0;
    for (const pile of g.piles) {
      const n = Math.min(70, 8 + pile.amount * 7);
      for (let j = 0; j < n && pileCount < 4000; j++) {
        const radius = 0.12 + Math.sqrt(pile.amount) * 0.035;
        dummy.position.set(
          pile.x * S + Math.sin(j * 13.71) * radius,
          0.04 + (1 - j / n) * 0.045 * Math.sqrt(pile.amount),
          pile.y * S + Math.cos(j * 5.21) * radius,
        );
        dummy.rotation.set(Math.sin(j) * 0.3, j * 2.39, Math.cos(j) * 0.25);
        dummy.scale.setScalar(0.85);
        dummy.updateMatrix();
        pileLeaves.setMatrixAt(pileCount++, dummy.matrix);
      }
    }
    pileLeaves.count = pileCount;
    pileLeaves.instanceMatrix.needsUpdate = true;
    g.carts.forEach((c) => {
      let model = cartModels.get(c.id);
      if (!model) {
        model = cartMesh();
        scene.add(model);
        cartModels.set(c.id, model);
      }
      model.position.lerp(
        new T.Vector3(c.x * S, 0, c.y * S),
        1 - Math.exp(-dt * 18),
      );
      if (!model.userData.placed) {
        model.position.set(c.x * S, 0, c.y * S);
        model.userData.placed = true;
      }
      const oldX = model.userData.lastX ?? c.x,
        oldY = model.userData.lastY ?? c.y;
      const traveled = Math.hypot(c.x - oldX, c.y - oldY) * S;
      model.children
        .filter((o) => o.name === 'wheel')
        .forEach((w) => w.rotateY(traveled / 0.23));
      model.userData.lastX = c.x;
      model.userData.lastY = c.y;
      model.rotation.y = Math.PI / 2 - c.face;
      const load = model.getObjectByName('load')!;
      load.visible = c.stored > 0.01;
      load.position.y = 0.99 + Math.min(1, c.stored / CART_CAPACITY) * 0.19;
      load.scale.y = Math.max(0.1, c.stored / CART_CAPACITY);
    });
    for (const [pid, m] of people) {
      if (!g.players.some((p) => p.id === pid) || pid === myId) {
        m.removeFromParent();
        m.traverse((o) => {
          if (o instanceof T.Mesh) o.geometry.dispose();
          if (o instanceof T.Sprite) disposeLabel(o);
        });
        people.delete(pid);
      }
    }
    g.players
      .filter((p) => p.id !== myId)
      .forEach((other) => {
        let model = people.get(other.id);
        if (!model) {
          model = person(COLORS[other.color]);
          const name = label(other.name, COLORS[other.color]);
          name.position.y = 2.05;
          model.add(name);
          model.position.set(other.x * S, 0, other.y * S);
          scene.add(model);
          people.set(other.id, model);
        }
        model.position.lerp(
          new T.Vector3(other.x * S, 0, other.y * S),
          1 - Math.exp(-dt * 12),
        );
        model.rotation.y = Math.PI / 2 - other.face;
        model.scale.y = other.crouched ? 0.68 : 1;
      });
    zoneLabels.forEach((pair, i) => {
      const clean = g.zones[i]?.completedAt !== null;
      pair[0].visible = !options.menu && !clean;
      pair[1].visible = !options.menu && clean;
    });
    for (const [id, model] of pingModels) {
      if (!g.pings.some((m) => m.playerId === id)) {
        model.traverse((o) => {
          if (o instanceof T.Mesh) o.geometry.dispose();
          if (o instanceof T.Sprite) disposeLabel(o);
        });
        model.removeFromParent();
        pingModels.delete(id);
      }
    }
    for (const ping of g.pings) {
      let model = pingModels.get(ping.playerId);
      if (!model) {
        model = new T.Group();
        const marker = new T.Mesh(
          new T.RingGeometry(0.25, 0.32, 24),
          mat('#e4c376'),
        );
        marker.rotation.x = -Math.PI / 2;
        marker.position.y = 0.06;
        model.add(marker);
        const text = label(
          (g.players.find((p) => p.id === ping.playerId)?.name ?? 'Đồng đội') +
            ' · ' +
            (ping.kind === 'cart'
              ? 'XE ĐẦY'
              : ping.kind === 'drain'
                ? 'CỐNG TẮC'
                : 'CẦN GIÚP'),
        );
        text.position.y = 1.8;
        model.add(text);
        scene.add(model);
        pingModels.set(ping.playerId, model);
      }
      model.position.set(ping.x * S, waterDepth(g, ping), ping.y * S);
      model.visible = !options.menu;
      const text = model.children.find((o) => o instanceof T.Sprite)!;
      text.position.y = 1.8 + Math.sin(t * 0.004) * 0.08;
    }
    drains.forEach((d, i) => {
      d.visible = i < g.drains.length;
      waters[i].visible = false;
    });
    let rippleCount = 0;
    g.drains.forEach((d, i) => {
      const clog = drains[i].getObjectByName('clog')!;
      clog.visible = d.clog > 0.01;
      clog.scale.setScalar(Math.max(0.1, d.clog));
      drains[i].position.set(d.x * S, 0, d.y * S);
      waters[i].visible = wet && d.water > 0.01;
      waters[i].position.set(d.x * S, 0.022 + d.water * 0.34, d.y * S);
      const radius = (65 + d.water * 75) * S;
      waters[i].scale.set(
        radius * (1 + Math.sin(t * 0.0015 + i) * 0.008),
        radius,
        1,
      );
      const wm = waters[i].material as T.MeshStandardMaterial;
      wm.opacity = 0.28 + d.water * 0.28;
      if (wm.userData.shader)
        wm.userData.shader.uniforms.uTime.value = t * 0.001;
      for (let k = 0; k < 6 && wet && d.water > 0.01; k++) {
        const phase = (t * 0.0006 + k * 0.167) % 1;
        dummy.position.set(
          d.x * S + (d.clog <= 0.01 ? 0 : Math.sin(k * 12) * radius * 0.65),
          0.03 + d.water * 0.34,
          d.y * S + (d.clog <= 0.01 ? 0 : Math.cos(k * 7) * radius * 0.65),
        );
        dummy.rotation.set(-Math.PI / 2, 0, 0);
        const r = d.clog <= 0.01 ? (1 - phase) * 1.2 : phase * 0.4;
        dummy.scale.set(r, r, r);
        dummy.updateMatrix();
        ripples.setMatrixAt(rippleCount++, dummy.matrix);
      }
    });
    ripples.count = rippleCount;
    ripples.instanceMatrix.needsUpdate = true;
    ring.visible = !!options.task && !!p && !options.menu;
    if (options.task) {
      const task = options.task;
      const o =
        task.kind === 'leaf'
          ? g.leaves[task.index]
          : task.kind === 'pile'
            ? g.piles[task.index]
            : task.kind === 'drain'
              ? g.drains[task.index]
              : g.carts[task.index];
      if (o)
        ring.position.set(
          o.x * S,
          task.kind === 'cart' || task.kind === 'depot'
            ? 1.1
            : waterDepth(g, o) + 0.06,
          o.y * S,
        );
    }
    rain.visible = wet;
    if (wet) {
      for (let i = 0; i < 1400; i++) {
        rainPositions[i * 3 + 1] -= dt * 8;
        if (rainPositions[i * 3 + 1] < 0) rainPositions[i * 3 + 1] = 13;
      }
      rain.geometry.attributes.position.needsUpdate = true;
    }
    falling.visible = !wet;
    for (let i = 0; i < 50 && !wet; i++) {
      const tr = TREES[i % TREES.length];
      dummy.position.set(
        tr.x * S + Math.sin(i * 13 + t * 0.0006) * 1.2,
        4 - ((t * 0.00035 + i * 0.17) % 4),
        tr.y * S + Math.cos(i * 9 + t * 0.0004) * 1.1,
      );
      dummy.rotation.set(
        t * 0.001 + i,
        t * 0.0008 + i,
        Math.sin(t * 0.001 + i),
      );
      dummy.scale.setScalar(0.85);
      dummy.updateMatrix();
      falling.setMatrixAt(i, dummy.matrix);
    }
    if (!wet) falling.instanceMatrix.needsUpdate = true;
    const dumping = p?.working && options.task?.kind === 'cart';
    broom.visible =
      !!p && p.tool === 'broom' && !dumping && !p.pushing && !options.menu;
    scoop.visible =
      !!p && (p.tool === 'scoop' || !!dumping) && !p.pushing && !options.menu;
    const scooping =
      p?.working &&
      (options.task?.kind === 'pile' || options.task?.kind === 'drain');
    scoop.position.y = scooping ? Math.sin(t * 0.011) * 0.09 : 0;
    scoop.rotation.x = dumping
      ? -0.55 + Math.sin(t * 0.014) * 0.12
      : scooping
        ? Math.sin(t * 0.011) * 0.18
        : 0;
    scoop.position.z = dumping ? -0.12 : 0;
    scoopLoad.count = p ? Math.min(24, Math.ceil(p.bag * 1.3)) : 0;
    for (let j = 0; j < scoopLoad.count; j++) {
      dummy.position.set(
        0.32 + Math.sin(j * 13) * 0.14,
        -0.54 + Math.floor(j / 8) * 0.025,
        -1.34 + Math.cos(j * 7) * 0.15,
      );
      dummy.rotation.set(0, j * 1.4, 0);
      dummy.scale.setScalar(0.55);
      dummy.updateMatrix();
      scoopLoad.setMatrixAt(j, dummy.matrix);
    }
    scoopLoad.instanceMatrix.needsUpdate = true;
    pushHands.visible = !!p && !!p.pushing && !options.menu;
    const sweep = p?.working && options.task?.kind === 'leaf';
    const phase = t * 0.012;
    const sway = rs.motion && options.moving ? Math.sin(t * 0.006) * 0.012 : 0;
    broom.position.set(
      sweep ? Math.sin(phase) * 0.18 : sway,
      p?.crouched ? 0.04 : 0,
      sweep ? Math.cos(phase) * 0.07 : 0,
    );
    broom.rotation.z = sweep ? Math.sin(phase) * 0.22 : 0;
    broom.rotation.x =
      p?.working && options.task?.kind === 'drain'
        ? Math.sin(t * 0.015) * 0.12
        : 0;
    renderer.autoClear = true;
    renderer.render(scene, camera);
    if (p && !options.menu) {
      renderer.autoClear = false;
      renderer.clearDepth();
      renderer.render(viewScene, viewCamera);
      renderer.autoClear = true;
    }
  }
  function dispose() {
    observer.disconnect();
    const geos = new Set<T.BufferGeometry>(),
      materials = new Set<T.Material>(),
      textures = new Set<T.Texture>();
    for (const s of [scene, viewScene])
      s.traverse((o) => {
        if (o instanceof T.Sprite) {
          textures.add(o.material.map!);
          materials.add(o.material);
        }
        if (o instanceof T.Mesh || o instanceof T.Points) {
          geos.add(o.geometry);
          for (const m of Array.isArray(o.material)
            ? o.material
            : [o.material]) {
            materials.add(m);
            for (const v of Object.values(m))
              if (v instanceof T.Texture) textures.add(v);
          }
        }
      });
    geos.forEach((g) => g.dispose());
    textures.forEach((t) => t?.dispose());
    materials.forEach((m) => m.dispose());
    mats.clear();
    environment.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  }
  return { render, dispose, resize };
}
