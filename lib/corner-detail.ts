import * as T from 'three';
import type { StreetMaterials } from './street-materials';
import type { StreetLight } from './street-detail';

/** Metres, X/Z world plane. The café replaces far-pavement frontage index 3. */
export const CORNER_LAYOUT = {
  cafe: { x: 28, z: 40.5, width: 7.9, depth: 8, height: 8.15, yaw: Math.PI },
  bounds: { minX: 12, maxX: 32, minZ: 28.5, maxZ: 48.5 },
  // Solids remain beyond the existing walkable edge (player centre Z <= 39.5).
  // The projecting blade sign/canopy are above 2.6 m and stay camera colliders.
  solidFootprints: [{ minX: 24.05, maxX: 31.95, minZ: 40.38, maxZ: 48.5 }],
  workClearance: { minX: 18, maxX: 25, minZ: 31, maxZ: 38.7 },
  depot: { x: 20.25, z: 32.5, signX: 21.9, signZ: 30.9 },
} as const;

type Palette = {
  plaster: T.MeshStandardMaterial;
  cream: T.MeshStandardMaterial;
  green: T.MeshStandardMaterial;
  iron: T.MeshStandardMaterial;
  amber: T.MeshStandardMaterial;
  dark: T.MeshStandardMaterial;
  paper: T.MeshStandardMaterial;
  cool: T.MeshStandardMaterial;
};

function box(
  root: T.Object3D,
  position: [number, number, number],
  size: [number, number, number],
  material: T.Material,
) {
  const geometry = new T.BoxGeometry(...size);
  if (material.userData.worldUV) {
    const p = geometry.attributes.position;
    const n = geometry.attributes.normal;
    const uv = geometry.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      uv.setXY(i,
        Math.abs(n.getX(i)) > 0.5 ? p.getZ(i) + position[2] : p.getX(i) + position[0],
        Math.abs(n.getY(i)) > 0.5 ? p.getZ(i) + position[2] : p.getY(i) + position[1]);
    }
  }
  const mesh = new T.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  root.add(mesh);
  return mesh;
}

function rod(root: T.Object3D, a: number[], b: number[], radius: number, material: T.Material) {
  const start = new T.Vector3(a[0], a[1], a[2]);
  const end = new T.Vector3(b[0], b[1], b[2]);
  const mesh = new T.Mesh(new T.CylinderGeometry(radius, radius, start.distanceTo(end), 6), material);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), end.sub(start).normalize());
  mesh.castShadow = true;
  root.add(mesh);
  return mesh;
}

function paint(color: string, roughness = 0.85, metalness = 0) {
  return new T.MeshStandardMaterial({ color, roughness, metalness });
}

function signMap(title: string, subtitle: string, vertical = false) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = vertical ? 256 : 512;
  canvas.height = vertical ? 512 : 128;
  const c = canvas.getContext('2d');
  if (!c) return null;
  c.fillStyle = '#294840';
  c.fillRect(0, 0, canvas.width, canvas.height);
  c.strokeStyle = '#af9263';
  c.lineWidth = 3;
  c.strokeRect(9, 9, canvas.width - 18, canvas.height - 18);
  c.fillStyle = '#e4c991';
  c.textAlign = 'center';
  if (vertical) {
    // A silhouette/icon above two large words remains readable down the street.
    c.lineWidth = 4;
    c.strokeStyle = '#e4c991';
    c.beginPath();
    c.moveTo(89, 82); c.lineTo(96, 130); c.lineTo(157, 130); c.lineTo(164, 82);
    c.stroke();
    c.beginPath(); c.ellipse(170, 103, 17, 18, 0, -Math.PI / 2, Math.PI / 2); c.stroke();
    c.fillRect(85, 142, 86, 4);
    c.font = 'bold 73px Georgia';
    c.fillText('CÀ', 128, 258);
    c.fillText('PHÊ', 128, 354);
    c.font = '20px Arial';
    c.fillText('MỞ ĐẾN 23:00', 128, 437);
  } else {
    c.font = 'bold 42px Georgia';
    c.fillText(title, 256, 64, 472);
    c.font = '17px Arial';
    c.fillText(subtitle, 256, 100, 468);
  }
  // Fixed edge wear, no image or font downloaded from the reference clip.
  c.fillStyle = '#ddcfaa';
  c.globalAlpha = 0.16;
  for (let i = 0; i < 35; i++) {
    c.fillRect((i * 89) % canvas.width, (i * 37) % canvas.height, 2 + i % 5, 1);
  }
  const map = new T.CanvasTexture(canvas);
  map.colorSpace = T.SRGBColorSpace;
  map.anisotropy = 4;
  return map;
}

function sign(
  root: T.Object3D,
  position: [number, number, number],
  size: [number, number],
  map: T.Texture | null,
  rotationY = 0,
) {
  const material = new T.MeshStandardMaterial({
    color: map ? '#ffffff' : '#36554a',
    map, roughness: 0.8, side: T.DoubleSide,
    emissive: '#b18c54', emissiveMap: map, emissiveIntensity: 0.23,
  });
  const mesh = new T.Mesh(new T.PlaneGeometry(...size), material);
  mesh.position.set(...position);
  mesh.rotation.y = rotationY;
  root.add(mesh);
  return mesh;
}

function cafeFrontage(root: T.Group, surfaces: StreetMaterials) {
  const p: Palette = {
    plaster: surfaces.plaster.clone(), cream: paint('#c6b999'),
    green: paint('#344e44'), iron: paint('#2c3937', 0.65, 0.45),
    amber: paint('#c9a16a'), dark: paint('#292f2b'),
    paper: paint('#cdbf9e'), cool: paint('#9eb8c1', 0.65),
  };
  p.plaster.color.set('#cfb88f');
  p.plaster.userData.worldUV = true;
  p.amber.emissive.set('#e0a95c');
  p.amber.emissiveIntensity = 0.34;
  p.cool.emissive.set('#9fbdcf');
  p.cool.emissiveIntensity = 0.12;

  // Same original building footprint; the high/low roof line breaks repeated modules.
  box(root, [0, 5.3, -4], [7.9, 4.9, 8], p.plaster);
  box(root, [-1.12, 7.88, -4], [5.66, 0.55, 8], p.plaster);
  box(root, [-1.12, 8.18, -4], [5.84, 0.12, 8.12], p.cream);
  box(root, [2.84, 7.8, -4], [2.22, 0.15, 8.08], p.iron);
  box(root, [0, 1.37, -7.9], [7.9, 2.74, 0.2], p.plaster);
  for (const x of [-3.8, 1.75, 3.8]) {
    box(root, [x, 1.4, -3.99], [0.25, 2.8, 8.02], p.plaster);
    box(root, [x, 0.31, 0.025], [0.3, 0.62, 0.15], surfaces.brick);
  }

  // One broad warm window, rather than uniformly emissive windows along the block.
  box(root, [-1.05, 0.43, -0.08], [5.1, 0.86, 0.26], p.green);
  box(root, [-1.05, 0.11, -0.8], [5.1, 0.08, 1.5], surfaces.timber);
  box(root, [-1.05, 1.45, -1.48], [5.05, 2.24, 0.08], p.amber);
  box(root, [-1.05, 2.65, -0.76], [5.12, 0.07, 1.6], p.cream);
  // Recessed counter, a short shelf, and a few large silhouettes carry depth.
  box(root, [-1.15, 0.91, -0.52], [4.45, 0.11, 0.62], surfaces.timber);
  box(root, [-1.15, 0.61, -0.75], [4.35, 0.53, 0.3], p.green);
  box(root, [-1.05, 1.63, -1.29], [4.55, 0.065, 0.22], surfaces.timber);
  for (const x of [-2.6, -1.5, 0.2]) {
    box(root, [x, 1.85, -1.25], [0.3, 0.37, 0.2], p.paper);
    box(root, [x + 0.11, 1.02, -0.5], [0.15, 0.18, 0.14], p.cream);
  }
  const glass = new T.MeshStandardMaterial({
    color: '#8faaa0', transparent: true, opacity: 0.14,
    roughness: 0.36, metalness: 0.12, depthWrite: false,
  });
  box(root, [-1.05, 1.64, 0.015], [5.03, 1.49, 0.015], glass).castShadow = false;
  for (const x of [-3.56, -1.82, 0.07, 1.47])
    box(root, [x, 1.61, 0.075], [0.055, 1.72, 0.11], p.green);
  box(root, [-1.05, 2.5, 0.035], [5.1, 0.12, 0.17], p.green);
  box(root, [0.45, 1.21, 0.12], [0.025, 0.25, 0.045], surfaces.metal);

  // A narrow closed neighbor gives the café an asymmetric end and a quieter patch.
  box(root, [2.76, 1.35, -0.015], [1.72, 2.55, 0.08], surfaces.shutter);
  box(root, [2.76, 2.74, 0.015], [1.85, 0.27, 0.18], p.iron);
  box(root, [2.76, 0.14, 0.05], [1.87, 0.13, 0.25], surfaces.brick);
  box(root, [2.76, 1.14, 0.045], [0.18, 0.04, 0.035], surfaces.metal);

  // Fabric canopy has only three broad strips, avoiding dense repeated trim.
  const canopy = box(root, [-1.05, 2.77, 0.44], [5.35, 0.07, 1.04], p.green);
  canopy.rotation.x = 0.1;
  box(root, [-1.05, 2.68, 0.96], [5.35, 0.16, 0.035], p.green);
  for (const x of [-3.2, 1.1])
    rod(root, [x, 2.66, 0.72], [x, 3.35, 0.14], 0.018, p.iron);
  box(root, [-1.05, 3.2, 0.08], [5.32, 0.6, 0.18], p.green);
  sign(root, [-1.05, 3.2, 0.181], [5.05, 0.56],
    signMap('CÀ PHÊ CUỐI PHỐ', 'NÂU NÓNG · TRÀ SEN · TỪ 1986'));
  // Large projecting blade: readable from spawn without filling the walking lane.
  rod(root, [3.48, 4.94, 0.01], [3.48, 4.94, 0.7], 0.026, p.iron);
  box(root, [3.48, 4.2, 0.64], [0.105, 1.8, 0.91], p.green);
  const bladeFace = sign(root, [3.419, 4.2, 0.64], [0.84, 1.72],
    signMap('', '', true), -Math.PI / 2);
  bladeFace.name = 'cafe-blade-east-face';
  bladeFace.material.side = T.FrontSide;
  // Two outward faces share one texture/material/geometry. A DoubleSide plane
  // would mirror the words on its reverse and remain hidden behind the solid sign.
  const reverseFace = bladeFace.clone();
  reverseFace.name = 'cafe-blade-west-face';
  reverseFace.position.x = 3.541;
  reverseFace.rotation.y = Math.PI / 2;
  root.add(reverseFace);

  // Two upper windows at different widths; one modestly lit domestic room.
  for (const window of [{ x: -2.2, width: 1.55, lit: false }, { x: 0.55, width: 1.05, lit: true }]) {
    box(root, [window.x, 5.32, 0.025], [window.width + 0.16, 1.71, 0.1], p.cream);
    box(root, [window.x, 5.32, 0.087], [window.width, 1.53, 0.035], window.lit ? p.amber : p.dark);
    box(root, [window.x, 5.32, 0.114], [0.055, 1.56, 0.06], p.green);
    box(root, [window.x, 5.44, 0.114], [window.width, 0.05, 0.06], p.green);
    box(root, [window.x - window.width * 0.32, 5.32, 0.117], [window.width * 0.18, 1.48, 0.018], p.paper);
  }
  box(root, [-0.87, 4.37, 0.46], [4.9, 0.11, 0.92], p.cream);
  for (const y of [4.59, 5.03])
    rod(root, [-3.22, y, 0.86], [1.45, y, 0.86], 0.022, p.iron);
  for (const x of [-3.2, -2.05, -0.9, 0.25, 1.45])
    rod(root, [x, 4.46, 0.86], [x, 5.04, 0.86], 0.015, p.iron);
  box(root, [3.34, 5.69, 0.022], [0.45, 1.22, 0.08], p.cool);
  rod(root, [3.73, 0.1, 0.16], [3.73, 7.65, 0.16], 0.041, p.iron);

  // One domestic story: three stools stacked behind closed glazing, not on the pavement.
  for (let i = 0; i < 3; i++) {
    box(root, [0.78, 0.28 + i * 0.18, -0.4], [0.38, 0.06, 0.35], p.green);
  }
  for (const dx of [-0.14, 0.14])
    rod(root, [0.78 + dx, 0.07, -0.51], [0.78 + dx, 0.6, -0.51], 0.022, p.green);
  // A single warm pendant is geometry plus emission; pooled street lights do illumination.
  rod(root, [-0.7, 2.66, -0.5], [-0.7, 2.19, -0.5], 0.012, p.iron);
  const shade = new T.Mesh(new T.ConeGeometry(0.21, 0.16, 10, 1, true), p.green);
  shade.position.set(-0.7, 2.17, -0.5); root.add(shade);
  box(root, [-0.7, 2.08, -0.5], [0.17, 0.035, 0.17], p.amber);
}

/**
 * Call before static spatial batching and camera-collider collection.
 * No scene lights are allocated: append emitters to the existing four-light pool.
 * All generated maps/materials are owned by the normal scene traversal/disposal.
 */
export function addCornerDetail(root: T.Object3D, surfaces: StreetMaterials) {
  const corner = new T.Group();
  corner.name = 'cafe-depot-hero-corner';
  root.add(corner);
  const cafe = new T.Group();
  cafe.name = 'cafe-cuoi-pho';
  cafe.position.set(CORNER_LAYOUT.cafe.x, 0, CORNER_LAYOUT.cafe.z);
  cafe.rotation.y = CORNER_LAYOUT.cafe.yaw;
  corner.add(cafe);
  cafeFrontage(cafe, surfaces);

  const iron = paint('#34444a', 0.7, 0.45);
  const cool = paint('#a1bdca', 0.65);
  cool.emissive.set('#a6c4d1'); cool.emissiveIntensity = 0.34;
  // Reuse the existing depot signpost position; no new post on the working floor.
  const d = CORNER_LAYOUT.depot;
  rod(corner, [d.signX, 2.45, d.signZ], [d.signX, 2.86, d.signZ], 0.027, iron);
  box(corner, [d.signX, 2.85, d.signZ + 0.08], [0.57, 0.08, 0.22], iron);
  box(corner, [d.signX, 2.805, d.signZ + 0.08], [0.47, 0.013, 0.15], cool);

  // Flat worn lane mark guides the existing cart toward depot without glossy pools.
  const marking = paint('#afa16b', 0.98);
  const arrow = new T.Shape();
  arrow.moveTo(-0.13, -0.65); arrow.lineTo(0.13, -0.65);
  arrow.lineTo(0.13, 0.05); arrow.lineTo(0.37, 0.05);
  arrow.lineTo(0, 0.55); arrow.lineTo(-0.37, 0.05);
  arrow.lineTo(-0.13, 0.05); arrow.closePath();
  const mesh = new T.Mesh(new T.ShapeGeometry(arrow), marking);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(d.x, -0.014, 34.15);
  mesh.receiveShadow = true;
  mesh.userData.nonSolid = true;
  corner.add(mesh);

  const emitters: StreetLight[] = [
    { x: 26.7, y: 3.1, z: 39.3, color: '#e7bc80', power: 58 },
    { x: d.signX, y: 2.77, z: d.signZ + 0.08, color: '#acc5d0', power: 24 },
  ];
  let meshCount = 0;
  let vertices = 0;
  corner.traverse((object) => {
    if (object instanceof T.Mesh) {
      meshCount++;
      vertices += object.geometry.attributes.position.count;
    }
  });
  return { root: corner, emitters, layout: CORNER_LAYOUT, meshCount, vertices };
}
