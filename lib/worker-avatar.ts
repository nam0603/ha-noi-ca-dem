import * as T from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Cosmetic inputs only. Time is seconds, speed is metres/second. */
export type WorkerAnimation = {
  dt: number;
  time: number;
  speed: number;
  /** Avatar-local velocity and cumulative rendered travel, all in metres. */
  movement?: { x: number; z: number; distance: number };
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
  pose?: {
    time: number;
    crouch: number;
    work: number;
    dump: number;
    push: number;
    moving: number;
    phase: number;
    direction: T.Vector2;
    distance?: number;
  };
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
  const teamColor = new T.Color('#71806b').lerp(new T.Color(color), 0.48);
  const uniform = material(teamColor.getStyle()),
    trousers = material('#35483e'),
    vest = material('#c78b3b'),
    reflective = material('#c9d0b9', 0.58, 0.12),
    dark = material('#28362e'),
    skin = material('#b98e6b'),
    glove = material('#89937b'),
    rubber = material('#34493f'),
    helmetMaterial = material('#cbb17b', 0.68),
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
  const shirt = box(torso, 0.48, 0.56, 0.285, uniform, 0, 0.29, 0, 0.055);
  const shirtPositions = shirt.geometry.attributes.position;
  // A waist narrower than the shoulders avoids a rigid rectangular torso silhouette.
  for (let i = 0; i < shirtPositions.count; i++) {
    const taper =
      0.84 + clamp((shirtPositions.getY(i) + 0.28) / 0.56, 0, 1) * 0.16;
    shirtPositions.setX(i, shirtPositions.getX(i) * taper);
  }
  shirt.geometry.computeVertexNormals();
  box(torso, 0.35, 0.16, 0.255, trousers, 0, -0.035, -0.005, 0.045);
  // Vest panels and reflective bars on both sides remain legible from the chase camera.
  for (const side of [-1, 1]) {
    box(torso, 0.4, 0.43, 0.009, vest, 0, 0.28, side * 0.146, 0.004);
    for (const y of [0.17, 0.37]) {
      box(torso, 0.405, 0.036, 0.004, dark, 0, y, side * 0.153);
      box(torso, 0.4, 0.025, 0.005, reflective, 0, y, side * 0.156);
    }
    for (const x of [-0.14, 0.14])
      box(torso, 0.026, 0.41, 0.005, reflective, x, 0.29, side * 0.156);
  }
  box(torso, 0.009, 0.42, 0.006, dark, 0, 0.28, 0.159);
  for (const x of [-0.135, 0.135])
    box(torso, 0.09, 0.067, 0.01, uniform, x, 0.26, 0.159, 0.005);
  cylinder(torso, 0.061, 0.067, 0.087, skin, 0, 0.61, 0);
  box(torso, 0.355, 0.047, 0.273, dark, 0, 0.025, 0, 0.012);
  box(torso, 0.045, 0.035, 0.015, steel, 0, 0.025, 0.146);
  // Small back patch, with no texture or unlicensed insignia.
  box(torso, 0.14, 0.06, 0.008, trousers, 0, 0.44, -0.154, 0.004);
  for (const x of [-0.039, 0, 0.039])
    box(torso, 0.018, 0.027, 0.002, reflective, x, 0.44, -0.159);
  bake(torso);
  root.add(torso);

  const head = new T.Group();
  head.name = 'worker-head';
  const face = mesh(
    head,
    new T.SphereGeometry(0.127, 12, 10),
    skin,
    0,
    0.727,
    0.006,
  );
  face.scale.set(0.9, 1.12, 0.92);
  for (const side of [-1, 1]) {
    mesh(
      head,
      new T.SphereGeometry(0.026, 8, 6),
      skin,
      side * 0.116,
      0.727,
      0.005,
    );
    box(head, 0.023, 0.009, 0.009, dark, side * 0.045, 0.755, 0.114, 0.003);
  }
  box(head, 0.03, 0.037, 0.035, skin, 0, 0.727, 0.122, 0.01);
  const helmet = mesh(
    head,
    new T.SphereGeometry(0.15, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    helmetMaterial,
    0,
    0.798,
    0,
  );
  helmet.scale.y = 0.84;
  cylinder(head, 0.179, 0.179, 0.021, helmetMaterial, 0, 0.8, 0.018);
  box(head, 0.044, 0.009, 0.16, uniform, 0, 0.923, -0.005, 0.004);
  bake(head);
  torso.add(head);
  const mask = new T.Group();
  mask.name = 'worker-mask';
  box(mask, 0.165, 0.074, 0.032, maskMaterial, 0, 0.698, 0.117, 0.013);
  for (const y of [0.68, 0.7, 0.721])
    box(mask, 0.13, 0.004, 0.002, reflective, 0, y, 0.134);
  for (const side of [-1, 1])
    box(mask, 0.01, 0.052, 0.11, maskMaterial, side * 0.113, 0.71, 0.056);
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
    box(foot, 0.166, 0.133, 0.279, dark, 0, 0, 0.05, 0.028);
    box(foot, 0.172, 0.024, 0.286, rubber, 0, -0.057, 0.052, 0.008);
    cylinder(foot, 0.067, 0.074, 0.123, rubber, 0, 0.087, 0);
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
    capsule(upper, 0.067, 0.2, uniform);
    cylinder(upper, 0.069, 0.069, 0.025, reflective, 0, 0.02, 0);
    capsule(lower, 0.057, 0.205, uniform);
    // Broad cuff and elbow folds are readable without a dense layer of tiny detail.
    cylinder(lower, 0.059, 0.062, 0.036, trousers, 0, 0.095, 0);
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
  const contact = new T.Mesh(
    new T.PlaneGeometry(0.95, 0.72),
    new T.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      vertexShader: `varying vec2 contactUv;
        void main() {
          contactUv = uv - vec2(0.5);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `varying vec2 contactUv;
        void main() {
          float radius = length(contactUv * 2.0);
          float opacity = 0.13 * exp(-radius * radius * 4.5) * (1.0 - smoothstep(0.65, 1.0, radius));
          gl_FragColor = vec4(0.015, 0.025, 0.02, opacity);
        }`,
    }),
  );
  contact.name = 'worker-ground-contact';
  contact.rotation.x = -Math.PI / 2;
  contact.position.y = -0.025;
  // A restrained contact cue also anchors the worker when real shadows are off.
  // It is deliberately not a directional or physically accurate cast shadow.
  root.add(contact);
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

/** Bounded cosmetic state; repeating a frame timestamp never advances the pose twice. */
export function animateWorkerAvatar(root: T.Group, options: WorkerAnimation) {
  const rig = rigs.get(root);
  if (!rig) return;
  const t = Number.isFinite(options.time) ? options.time : 0;
  const speed = clamp(Number.isFinite(options.speed) ? options.speed : 0, 0, 7);
  const pushing = options.pushing;
  const dumping =
    options.working &&
    (options.taskKind === 'cart' || options.taskKind === 'depot');
  const working = options.working && !pushing && !dumping;
  const travel = options.movement?.distance;
  const distance =
    travel !== undefined && Number.isFinite(travel)
      ? Math.max(0, travel)
      : undefined;
  const pose = (rig.pose ??= {
    time: t,
    crouch: options.crouched ? 1 : 0,
    work: working ? 1 : 0,
    dump: dumping ? 1 : 0,
    push: pushing ? 1 : 0,
    moving: 0,
    phase: 0,
    direction: new T.Vector2(0, 1),
    distance,
  });
  if (t > pose.time) {
    const dt = clamp(Number.isFinite(options.dt) ? options.dt : 0, 0, 0.12);
    const ease = 1 - Math.exp(-dt * 12);
    pose.crouch = T.MathUtils.lerp(pose.crouch, options.crouched ? 1 : 0, ease);
    pose.work = T.MathUtils.lerp(
      pose.work,
      working ? 1 : 0,
      1 - Math.exp(-dt * 9),
    );
    pose.dump = T.MathUtils.lerp(pose.dump, dumping ? 1 : 0, ease);
    pose.push = T.MathUtils.lerp(pose.push, pushing ? 1 : 0, ease);
    pose.moving = T.MathUtils.lerp(pose.moving, clamp(speed / 1.4, 0, 1), ease);
    const velocity = options.movement;
    if (
      velocity &&
      Number.isFinite(velocity.x) &&
      Number.isFinite(velocity.z)
    ) {
      const direction = new T.Vector2(velocity.x, velocity.z);
      if (direction.lengthSq() > 0.003) {
        direction.normalize();
        const angle = Math.atan2(pose.direction.x, pose.direction.y);
        const target = Math.atan2(direction.x, direction.y);
        const turn = Math.atan2(
          Math.sin(target - angle),
          Math.cos(target - angle),
        );
        const facing = angle + turn * ease;
        pose.direction.set(Math.sin(facing), Math.cos(facing));
      }
    }
    let travelled = speed * dt;
    if (distance !== undefined) {
      travelled =
        pose.distance === undefined
          ? 0
          : clamp(distance - pose.distance, 0, 0.6);
      if (pose.distance !== undefined && distance < pose.distance)
        pose.phase = 0;
    }
    const stride =
      T.MathUtils.lerp(0.94, 0.62, pose.crouch) * (pushing ? 0.9 : 1);
    pose.phase = (pose.phase + travelled / stride) % 1;
    pose.distance = distance;
    pose.time = t;
  }
  const crouch = pose.crouch,
    moving = pose.moving;
  const gait = Math.sin(pose.phase * Math.PI * 2);
  const hipY = 0.88 - crouch * 0.25 + Math.abs(gait) * moving * 0.013;
  const lean = crouch * 0.46 + pose.push * 0.13 + pose.work * 0.08;
  rig.torso.position.set(0, hipY, 0);
  rig.torso.rotation.set(lean, -gait * moving * 0.025, -gait * moving * 0.018);
  rig.torso.updateMatrix();
  rig.mask.visible = options.mask;

  for (let i = 0; i < 2; i++) {
    const side = i ? 1 : -1;
    const cycle = (pose.phase + i * 0.5) % 1;
    const swing = clamp((cycle - 0.6) / 0.4, 0, 1);
    const stride = T.MathUtils.lerp(0.94, 0.62, crouch) * (pushing ? 0.9 : 1);
    // In stance the foot travels backwards relative to the hips by the same
    // distance the worker moves. The shorter swing arc returns it to the front.
    const reach = stride * 0.3;
    const step =
      cycle < 0.6
        ? reach - cycle * stride
        : -reach + 2 * reach * (swing * swing * (3 - 2 * swing));
    const lift = Math.sin(swing * Math.PI) * moving * (0.075 - crouch * 0.025);
    const foot = new T.Vector3(
      side * (0.13 + crouch * 0.025 + Math.abs(pose.direction.x) * 0.035) +
        pose.direction.x * step * moving * 0.65,
      0.071 + lift,
      pose.direction.y * step * moving,
    );
    const hip = new T.Vector3(side * 0.13, hipY, 0);
    const ankle = foot.clone().add(new T.Vector3(0, 0.08, -0.015));
    const knee = joint(hip, ankle, 0.4, 0.39, new T.Vector3(side * 0.08, 0, 1));
    setLink(rig.legs[i].upper, hip, knee, 0.42);
    setLink(rig.legs[i].lower, knee, ankle, 0.38);
    rig.legs[i].foot!.position.copy(foot);
    rig.legs[i].foot!.rotation.set(
      -Math.sin(swing * Math.PI) * moving * 0.1,
      side * 0.035 + clamp(pose.direction.x, -0.5, 0.5) * 0.38,
      0,
    );
  }

  const sweep = options.tool === 'broom';
  const workPhase = Math.sin(t * 6.9);
  const bottom = new T.Vector3(-0.37, 0.018, 0.59);
  const top = new T.Vector3(0.075, 1.27 - crouch * 0.2, 0.22 + crouch * 0.1);
  // The scene rotates this +Z-facing rig by PI+yaw. Camera +X is therefore
  // worker-local -X: contact belongs on that near side, opposite the leaf bag.
  // This cosmetic offset does not alter reach or target selection.
  bottom.lerp(
    new T.Vector3(
      sweep ? -0.43 - workPhase * 0.25 : -0.43,
      sweep ? 0.016 : 0.023 + (1 + Math.sin(t * 6.2)) * 0.055,
      sweep ? 1.0 + Math.cos(t * 6.9) * 0.07 : 0.98 - Math.cos(t * 6.2) * 0.1,
    ),
    pose.work,
  );
  top.lerp(
    new T.Vector3(
      0.05 - (sweep ? workPhase * 0.025 : 0),
      1.24 - crouch * 0.2,
      0.3,
    ),
    pose.work,
  );
  bottom.lerp(
    new T.Vector3(-0.37, 1.15 + Math.sin(t * 7.5) * 0.025, 1.02),
    pose.dump,
  );
  top.lerp(new T.Vector3(0.015, 1.3, 0.34), pose.dump);
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
  const dumpTool = dumping || pose.dump > 0.08;
  rig.broom.visible = !pushing && !dumpTool && options.tool === 'broom';
  rig.scoop.visible = !pushing && (dumpTool || options.tool === 'scoop');
  const amount = clamp(Number.isFinite(options.bag) ? options.bag : 0, 0, 18);
  rig.load.count = Math.ceil(amount);
  rig.bagFill.visible = amount > 0;
  rig.bagFill.scale.y = 0.3 + amount / 18;
  rig.bag.position.set(0.29, hipY - 0.02, -0.02);
  rig.bag.rotation.set(0, 0, gait * moving * 0.035);

  for (let i = 0; i < 2; i++) {
    const side = i ? 1 : -1;
    const shoulder = new T.Vector3(side * 0.255, 0.47, 0).applyMatrix4(
      rig.torso.matrix,
    );
    // Both grips lie exactly on the same shaft. Cart mode supplies two separated handles.
    const hand = bottom.clone().addScaledVector(shaft, i ? 0.93 : 0.69);
    hand.lerp(new T.Vector3(side * 0.34, 1.05, 0.45), pose.push);
    const elbow = joint(
      shoulder,
      hand,
      0.32,
      0.34,
      new T.Vector3(side * 0.32, -1, -0.16),
    );
    setLink(rig.arms[i].upper, shoulder, elbow, 0.335);
    setLink(rig.arms[i].lower, elbow, hand, 0.33);
    rig.arms[i].hand!.position.copy(hand);
    rig.arms[i].hand!.quaternion.copy(toolRotation);
    if (pushing) rig.arms[i].hand!.rotation.set(Math.PI / 2, 0, 0);
  }
}
