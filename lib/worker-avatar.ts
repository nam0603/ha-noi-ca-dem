import * as T from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Cosmetic inputs only. Time is seconds, speed is metres/second. */
export type WorkerAnimation = {
  dt: number;
  time: number;
  speed: number;
  crouched: boolean;
  working: boolean;
  tool: 'broom' | 'scoop';
  pushing: boolean;
  bag: number;
  taskKind?: string;
  mask: boolean;
};

type Limb = { upper: T.Group; lower: T.Group; hand?: T.Group; foot?: T.Group };
type WorkerRig = {
  torso: T.Group;
  mask: T.Group;
  bag: T.Group;
  bagFill: T.Mesh;
  arms: [Limb, Limb];
  legs: [Limb, Limb];
  broom: T.Group;
  scoop: T.Group;
  load: T.InstancedMesh;
};
const rigs = new WeakMap<T.Group, WorkerRig>();
const up = new T.Vector3(0, 1, 0);
const dummy = new T.Object3D();
const clamp = T.MathUtils.clamp;

/** Batch a rigid part, keeping the joints and its named pivot independently movable. */
function batch(
  part: T.Group,
  surfaces: { matte: T.Material; metal: T.Material },
) {
  part.updateMatrixWorld(true);
  const groups = new Map<T.Material, T.Mesh[]>();
  for (const child of [...part.children]) {
    if (!(child instanceof T.Mesh) || Array.isArray(child.material)) continue;
    const surface =
      child.material instanceof T.MeshStandardMaterial &&
      child.material.metalness > 0.1
        ? surfaces.metal
        : surfaces.matte;
    const list = groups.get(surface) ?? [];
    list.push(child);
    groups.set(surface, list);
  }
  for (const [material, meshes] of groups) {
    const pieces = meshes.map((mesh) => {
      const geometry = mesh.geometry.clone();
      if (!geometry.index) {
        geometry.setIndex(
          Array.from(
            { length: geometry.attributes.position.count },
            (_, i) => i,
          ),
        );
      }
      const color = (mesh.material as T.MeshStandardMaterial).color;
      const colors = new Float32Array(geometry.attributes.position.count * 3);
      for (let i = 0; i < geometry.attributes.position.count; i++) {
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
      }
      geometry.setAttribute('color', new T.BufferAttribute(colors, 3));
      return geometry.applyMatrix4(mesh.matrix);
    });
    const geometry = mergeGeometries(pieces, false);
    if (!geometry) throw new Error('Cannot batch worker avatar rigid part');
    for (const piece of pieces) piece.dispose();
    for (const mesh of meshes) {
      part.remove(mesh);
      mesh.geometry.dispose();
    }
    const mesh = new T.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    part.add(mesh);
  }
}

/** Original procedural full-body worker. Local +Z is forward; feet stand at y=0. */
export function createWorkerAvatar(color: string): T.Group {
  const root = new T.Group();
  root.name = 'worker-avatar';
  const palette: T.MeshStandardMaterial[] = [];
  const material = (value: string, roughness = 0.88, metalness = 0) => {
    const mat = new T.MeshStandardMaterial({
      color: value,
      roughness,
      metalness,
    });
    palette.push(mat);
    return mat;
  };
  // Materials belong to this avatar; the scene owns disposal through traversal.
  const uniform = material(color),
    trousers = material('#324d44'),
    vest = material('#df912d'),
    reflective = material('#d1e1c2', 0.48, 0.18),
    dark = material('#25372f'),
    skin = material('#bf9674'),
    glove = material('#aeb5a1'),
    rubber = material('#3f5347'),
    helmetMaterial = material('#e0bf73', 0.6),
    wood = material('#9b7b4c'),
    straw = material('#bda36a'),
    steel = material('#6d8988', 0.52, 0.45),
    canvas = material('#999a72'),
    leafMaterial = material('#a18438'),
    maskMaterial = material('#b6c9bd');
  const surfaces = {
    matte: new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }),
    metal: new T.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.5,
      metalness: 0.35,
    }),
  };
  const bake = (part: T.Group) => batch(part, surfaces);
  const mesh = (
    parent: T.Group,
    geometry: T.BufferGeometry,
    mat: T.Material,
    x = 0,
    y = 0,
    z = 0,
  ) => {
    const object = new T.Mesh(geometry, mat);
    object.position.set(x, y, z);
    parent.add(object);
    return object;
  };
  const box = (
    parent: T.Group,
    w: number,
    h: number,
    d: number,
    mat: T.Material,
    x = 0,
    y = 0,
    z = 0,
    radius = 0,
  ) =>
    mesh(
      parent,
      radius
        ? new RoundedBoxGeometry(w, h, d, 1, radius)
        : new T.BoxGeometry(w, h, d),
      mat,
      x,
      y,
      z,
    );
  const capsule = (
    parent: T.Group,
    radius: number,
    length: number,
    mat: T.Material,
    x = 0,
    y = 0,
    z = 0,
  ) => mesh(parent, new T.CapsuleGeometry(radius, length, 3, 8), mat, x, y, z);
  const cylinder = (
    parent: T.Group,
    rt: number,
    rb: number,
    length: number,
    mat: T.Material,
    x = 0,
    y = 0,
    z = 0,
  ) => mesh(parent, new T.CylinderGeometry(rt, rb, length, 10), mat, x, y, z);

  const torso = new T.Group();
  torso.name = 'worker-torso';
  box(torso, 0.5, 0.55, 0.29, uniform, 0, 0.29, 0, 0.065);
  // Vest panels and reflective bars on both sides remain legible from the chase camera.
  for (const side of [-1, 1]) {
    box(torso, 0.42, 0.44, 0.018, vest, 0, 0.28, side * 0.151, 0.008);
    for (const y of [0.17, 0.37]) {
      box(torso, 0.44, 0.046, 0.022, dark, 0, y, side * 0.162);
      box(torso, 0.43, 0.031, 0.024, reflective, 0, y, side * 0.165);
    }
    for (const x of [-0.145, 0.145])
      box(torso, 0.035, 0.42, 0.022, reflective, x, 0.29, side * 0.166);
  }
  box(torso, 0.012, 0.43, 0.026, dark, 0, 0.28, 0.172);
  for (const x of [-0.135, 0.135])
    box(torso, 0.095, 0.075, 0.025, uniform, x, 0.25, 0.179, 0.008);
  cylinder(torso, 0.072, 0.08, 0.1, skin, 0, 0.61, 0);
  box(torso, 0.38, 0.06, 0.29, dark, 0, 0.025, 0, 0.015);
  box(torso, 0.055, 0.045, 0.025, steel, 0, 0.025, 0.158);
  // Small back patch, with no texture or unlicensed insignia.
  box(torso, 0.14, 0.065, 0.024, trousers, 0, 0.44, -0.175, 0.008);
  for (const x of [-0.039, 0, 0.039])
    box(torso, 0.018, 0.027, 0.003, reflective, x, 0.44, -0.189);
  bake(torso);
  root.add(torso);

  const head = new T.Group();
  head.name = 'worker-head';
  const face = mesh(
    head,
    new T.SphereGeometry(0.148, 12, 10),
    skin,
    0,
    0.74,
    0.006,
  );
  face.scale.set(0.9, 1.12, 0.92);
  for (const side of [-1, 1]) {
    mesh(
      head,
      new T.SphereGeometry(0.033, 8, 6),
      skin,
      side * 0.134,
      0.74,
      0.005,
    );
    box(head, 0.027, 0.011, 0.011, dark, side * 0.052, 0.772, 0.133, 0.004);
  }
  box(head, 0.035, 0.046, 0.041, skin, 0, 0.744, 0.143, 0.012);
  const helmet = mesh(
    head,
    new T.SphereGeometry(0.172, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    helmetMaterial,
    0,
    0.82,
    0,
  );
  helmet.scale.y = 0.84;
  cylinder(head, 0.209, 0.209, 0.027, helmetMaterial, 0, 0.824, 0.018);
  box(head, 0.05, 0.014, 0.19, reflective, 0, 0.962, -0.005, 0.006);
  bake(head);
  torso.add(head);
  const mask = new T.Group();
  mask.name = 'worker-mask';
  box(mask, 0.19, 0.088, 0.04, maskMaterial, 0, 0.711, 0.137, 0.016);
  for (const y of [0.69, 0.713, 0.737])
    box(mask, 0.15, 0.005, 0.003, reflective, 0, y, 0.159);
  for (const side of [-1, 1])
    box(mask, 0.013, 0.06, 0.13, maskMaterial, side * 0.13, 0.727, 0.063);
  bake(mask);
  torso.add(mask);

  const legs = [-1, 1].map((side) => {
    const upper = new T.Group(),
      lower = new T.Group(),
      foot = new T.Group();
    upper.name = side < 0 ? 'worker-thigh-left' : 'worker-thigh-right';
    lower.name = side < 0 ? 'worker-shin-left' : 'worker-shin-right';
    foot.name = side < 0 ? 'worker-boot-left' : 'worker-boot-right';
    capsule(upper, 0.09, 0.24, trousers);
    box(upper, 0.055, 0.11, 0.018, uniform, side * 0.075, -0.045, 0.035, 0.006);
    capsule(lower, 0.075, 0.23, trousers);
    cylinder(lower, 0.078, 0.078, 0.035, reflective, 0, -0.065, 0);
    box(foot, 0.19, 0.145, 0.32, dark, 0, 0, 0.065, 0.035);
    box(foot, 0.195, 0.027, 0.327, rubber, 0, -0.057, 0.067, 0.009);
    cylinder(foot, 0.074, 0.078, 0.13, rubber, 0, 0.095, 0);
    for (const part of [upper, lower, foot]) {
      bake(part);
      root.add(part);
    }
    return { upper, lower, foot };
  }) as [Limb, Limb];

  const arms = [-1, 1].map((side) => {
    const upper = new T.Group(),
      lower = new T.Group(),
      hand = new T.Group();
    upper.name = side < 0 ? 'worker-upper-arm-left' : 'worker-upper-arm-right';
    lower.name = side < 0 ? 'worker-forearm-left' : 'worker-forearm-right';
    hand.name = side < 0 ? 'worker-hand-left' : 'worker-hand-right';
    capsule(upper, 0.072, 0.19, uniform);
    cylinder(upper, 0.075, 0.075, 0.037, reflective, 0, 0.02, 0);
    capsule(lower, 0.061, 0.2, uniform);
    cylinder(lower, 0.063, 0.065, 0.045, glove, 0, -0.12, 0);
    box(hand, 0.11, 0.115, 0.1, glove, 0, -0.015, 0, 0.024);
    // Curled fingers form a grip around the shaft rather than an open mitten.
    for (let i = 0; i < 4; i++)
      box(
        hand,
        0.019,
        0.057,
        0.052,
        rubber,
        -0.034 + i * 0.023,
        -0.033,
        0.045,
        0.007,
      );
    capsule(hand, 0.022, 0.028, rubber, side * 0.053, -0.016, 0.02).rotation.z =
      side * 0.65;
    for (const part of [upper, lower, hand]) {
      bake(part);
      root.add(part);
    }
    return { upper, lower, hand };
  }) as [Limb, Limb];

  const bag = new T.Group();
  bag.name = 'worker-leaf-bag';
  box(bag, 0.21, 0.25, 0.18, canvas, 0, -0.09, 0, 0.034);
  box(bag, 0.23, 0.025, 0.195, dark, 0, 0.034, 0, 0.009);
  for (const x of [-0.078, 0.078])
    box(bag, 0.015, 0.11, 0.025, dark, x, 0.083, 0);
  bake(bag);
  const bagFill = box(bag, 0.17, 0.035, 0.145, leafMaterial, 0, 0.037, 0, 0.01);
  bagFill.name = 'worker-bag-load';
  root.add(bag);

  const broom = new T.Group(),
    scoop = new T.Group();
  broom.name = 'worker-broom';
  scoop.name = 'worker-scoop';
  for (const tool of [broom, scoop]) {
    cylinder(tool, 0.019, 0.022, 1.18, wood, 0, 0.66, 0);
    cylinder(tool, 0.024, 0.024, 0.16, dark, 0, 1.13, 0);
  }
  box(broom, 0.18, 0.055, 0.09, wood, 0, 0.17, 0, 0.013);
  for (let i = 0; i < 15; i++) {
    const blade = cylinder(
      broom,
      0.011,
      0.015,
      0.17,
      straw,
      (i - 7) * 0.024,
      0.073,
      ((i % 3) - 1) * 0.018,
    );
    blade.rotation.z = -(i - 7) * 0.043;
  }
  box(broom, 0.205, 0.025, 0.095, dark, 0, 0.145, 0);
  box(scoop, 0.35, 0.032, 0.31, steel, 0, 0.022, 0.1, 0.016);
  box(scoop, 0.35, 0.115, 0.025, steel, 0, 0.065, -0.045, 0.008);
  for (const side of [-1, 1]) {
    const wall = box(
      scoop,
      0.02,
      0.068,
      0.29,
      steel,
      side * 0.172,
      0.052,
      0.1,
      0.008,
    );
    wall.rotation.z = -side * 0.18;
  }
  cylinder(scoop, 0.026, 0.035, 0.15, steel, 0, 0.15, 0);
  bake(broom);
  bake(scoop);
  const load = new T.InstancedMesh(
    new T.SphereGeometry(0.034, 5, 3),
    leafMaterial,
    18,
  );
  load.name = 'worker-scoop-load';
  load.castShadow = true;
  // Moving tool bounds cannot be inferred from the initial all-identity instance matrices.
  load.frustumCulled = false;
  for (let i = 0; i < 18; i++) {
    dummy.position.set(
      Math.sin(i * 13.7) * 0.125,
      0.065 + Math.floor(i / 7) * 0.022,
      0.1 + Math.cos(i * 5.1) * 0.095,
    );
    dummy.rotation.set(0, i * 1.9, 0.3);
    dummy.scale.set(1.25, 0.3, 0.7);
    dummy.updateMatrix();
    load.setMatrixAt(i, dummy.matrix);
  }
  load.instanceMatrix.needsUpdate = true;
  scoop.add(load);
  root.add(broom, scoop);
  // These palette-only materials never reach the renderer. Leaf material remains on load meshes.
  for (const mat of palette) if (mat !== leafMaterial) mat.dispose();
  rigs.set(root, { torso, mask, bag, bagFill, arms, legs, broom, scoop, load });
  animateWorkerAvatar(root, {
    dt: 0,
    time: 0,
    speed: 0,
    crouched: false,
    working: false,
    tool: 'broom',
    pushing: false,
    bag: 0,
    mask: false,
  });
  return root;
}

function setLink(
  link: T.Group,
  from: T.Vector3,
  to: T.Vector3,
  nominalLength: number,
) {
  const delta = to.clone().sub(from);
  link.position.copy(from).add(to).multiplyScalar(0.5);
  link.quaternion.setFromUnitVectors(up, delta.clone().normalize());
  link.scale.set(1, delta.length() / nominalLength, 1);
}

/** A two-bone joint with a stable preferred bend direction, in avatar-local space. */
function joint(
  from: T.Vector3,
  to: T.Vector3,
  lengthA: number,
  lengthB: number,
  bend: T.Vector3,
) {
  const axis = to.clone().sub(from),
    distance = Math.max(0.0001, axis.length());
  axis.multiplyScalar(1 / distance);
  const reach = clamp(
    distance,
    Math.abs(lengthA - lengthB) + 0.001,
    lengthA + lengthB - 0.001,
  );
  const along =
    (lengthA * lengthA - lengthB * lengthB + reach * reach) / (2 * reach);
  const height = Math.sqrt(Math.max(0, lengthA * lengthA - along * along));
  const normal = bend
    .clone()
    .addScaledVector(axis, -bend.dot(axis))
    .normalize();
  return from
    .clone()
    .addScaledVector(axis, along)
    .addScaledVector(normal, height);
}

/** Absolute poses: repeated frames never accumulate rotation or move the game player. */
export function animateWorkerAvatar(root: T.Group, options: WorkerAnimation) {
  const rig = rigs.get(root);
  if (!rig) return;
  const t = Number.isFinite(options.time) ? options.time : 0;
  const speed = clamp(Number.isFinite(options.speed) ? options.speed : 0, 0, 7);
  const moving = clamp(speed / 1.6, 0, 1);
  const crouch = options.crouched ? 1 : 0;
  const pushing = options.pushing;
  const dumping =
    options.working &&
    (options.taskKind === 'cart' || options.taskKind === 'depot');
  const working = options.working && !pushing && !dumping;
  const phase = t * (pushing ? 5.8 : 7.4);
  const gait = Math.sin(phase);
  const hipY = 0.88 - crouch * 0.22 + Math.abs(gait) * moving * 0.018;
  const lean = crouch * 0.42 + (pushing ? 0.17 : working ? 0.1 : 0);
  rig.torso.position.set(0, hipY, 0);
  rig.torso.rotation.set(lean, 0, -gait * moving * 0.025);
  rig.torso.updateMatrix();
  rig.mask.visible = options.mask;

  for (let i = 0; i < 2; i++) {
    const side = i ? 1 : -1;
    const step = Math.sin(phase + i * Math.PI);
    const foot = new T.Vector3(
      side * (0.13 + crouch * 0.025),
      0.084 + Math.max(0, step) * moving * 0.075,
      step * moving * (crouch ? 0.11 : 0.22),
    );
    const hip = new T.Vector3(side * 0.13, hipY, 0);
    const ankle = foot.clone().add(new T.Vector3(0, 0.08, -0.015));
    const knee = joint(hip, ankle, 0.4, 0.39, new T.Vector3(side * 0.08, 0, 1));
    setLink(rig.legs[i].upper, hip, knee, 0.42);
    setLink(rig.legs[i].lower, knee, ankle, 0.38);
    rig.legs[i].foot!.position.copy(foot);
    rig.legs[i].foot!.rotation.set(
      -Math.max(0, step) * moving * 0.14,
      side * 0.06,
      0,
    );
  }

  const sweep = working && options.tool === 'broom';
  const scoop = working && options.tool === 'scoop';
  const workPhase = Math.sin(t * 8.5);
  const bottom = new T.Vector3(
    sweep ? 0.2 + workPhase * 0.3 : 0.35,
    dumping
      ? 0.93 + Math.sin(t * 8) * 0.045
      : scoop
        ? 0.035 + (1 + Math.sin(t * 7)) * 0.06
        : 0.025,
    dumping
      ? 0.68
      : sweep
        ? 0.88
        : scoop
          ? 0.92 - Math.cos(t * 7) * 0.12
          : 0.53,
  );
  const top = new T.Vector3(
    sweep ? -0.11 + workPhase * 0.055 : -0.1,
    dumping ? 1.15 : 1.27 - crouch * 0.2,
    dumping ? 0.27 : 0.19 + crouch * 0.1,
  );
  const shaft = top.clone().sub(bottom);
  const toolRotation = new T.Quaternion().setFromUnitVectors(
    up,
    shaft.clone().normalize(),
  );
  for (const tool of [rig.broom, rig.scoop]) {
    tool.position.copy(bottom);
    tool.quaternion.copy(toolRotation);
    tool.scale.set(1, shaft.length() / 1.2, 1);
  }
  rig.broom.visible = !pushing && !dumping && options.tool === 'broom';
  rig.scoop.visible = !pushing && (dumping || options.tool === 'scoop');
  const amount = clamp(Number.isFinite(options.bag) ? options.bag : 0, 0, 18);
  rig.load.count = Math.ceil(amount);
  rig.bagFill.visible = amount > 0;
  rig.bagFill.scale.y = 0.3 + amount / 18;
  rig.bag.position.set(-0.29, hipY - 0.02, -0.02);
  rig.bag.rotation.set(0, 0, gait * moving * 0.035);

  for (let i = 0; i < 2; i++) {
    const side = i ? 1 : -1;
    const shoulder = new T.Vector3(side * 0.275, 0.46, 0).applyMatrix4(
      rig.torso.matrix,
    );
    // Both grips lie exactly on the same shaft. Cart mode supplies two separated handles.
    const hand = pushing
      ? new T.Vector3(side * 0.34, 1.05, 0.45)
      : bottom.clone().addScaledVector(shaft, i ? 0.62 : 0.91);
    const elbow = joint(
      shoulder,
      hand,
      0.32,
      0.34,
      new T.Vector3(side, -0.15, -0.4),
    );
    setLink(rig.arms[i].upper, shoulder, elbow, 0.335);
    setLink(rig.arms[i].lower, elbow, hand, 0.33);
    rig.arms[i].hand!.position.copy(hand);
    rig.arms[i].hand!.quaternion.copy(toolRotation);
    if (pushing) rig.arms[i].hand!.rotation.set(Math.PI / 2, 0, 0);
  }
}
