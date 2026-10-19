import * as T from 'three';
import { clampViewPitch } from './view-controls';

// Render-only collision volumes, captured before material batching. A small spatial
// grid keeps camera queries independent of the street's triangle count.
export function createCameraCollision(root: T.Object3D) {
  root.updateMatrixWorld(true);
  const boxes: T.Box3[] = [];
  const cells = new Map<string, number[]>();
  const size = 3;
  root.traverse((object) => {
    if (!(object instanceof T.Mesh) || object instanceof T.InstancedMesh)
      return;
    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    if (
      materials.every((m) => !m.visible || (m.transparent && m.opacity < 0.15))
    )
      return;
    object.geometry.computeBoundingBox();
    const bounds = object.geometry
      .boundingBox!.clone()
      .applyMatrix4(object.matrixWorld);
    // Decals, paving and ground cannot occlude the boom; its endpoint has a floor.
    if (bounds.isEmpty() || bounds.max.y < 0.25) return;
    bounds.expandByScalar(0.22);
    const id = boxes.push(bounds) - 1;
    for (
      let x = Math.floor(bounds.min.x / size);
      x <= Math.floor(bounds.max.x / size);
      x++
    )
      for (
        let z = Math.floor(bounds.min.z / size);
        z <= Math.floor(bounds.max.z / size);
        z++
      ) {
        const key = `${x},${z}`;
        const bucket = cells.get(key) ?? [];
        bucket.push(id);
        cells.set(key, bucket);
      }
  });
  const ray = new T.Ray(),
    hit = new T.Vector3(),
    delta = new T.Vector3();
  const candidates = new Set<number>();
  return {
    count: boxes.length,
    fraction(start: T.Vector3, end: T.Vector3) {
      delta.subVectors(end, start);
      const length = delta.length();
      if (length < 0.0001) return 1;
      ray.set(start, delta.multiplyScalar(1 / length));
      candidates.clear();
      // A boom is <4 metres; querying the rectangle is bounded to a few grid cells.
      for (
        let x = Math.floor(Math.min(start.x, end.x) / size);
        x <= Math.floor(Math.max(start.x, end.x) / size);
        x++
      )
        for (
          let z = Math.floor(Math.min(start.z, end.z) / size);
          z <= Math.floor(Math.max(start.z, end.z) / size);
          z++
        )
          for (const id of cells.get(`${x},${z}`) ?? []) candidates.add(id);
      let distance = length;
      for (const id of candidates) {
        const box = boxes[id];
        // An anchor at a wall must retract, rather than use the exit face of a solid.
        if (box.containsPoint(start)) return 0;
        if (ray.intersectBox(box, hit))
          distance = Math.min(distance, start.distanceTo(hit));
      }
      return Math.max(0, (distance - (distance < length ? 0.025 : 0)) / length);
    },
  };
}

export type CameraCollision = ReturnType<typeof createCameraCollision>;
export function createFollowCamera(collision: CameraCollision) {
  const anchor = new T.Vector3(),
    desired = new T.Vector3(),
    offset = new T.Vector3();
  const rotation = new T.Euler(0, 0, 0, 'YXZ');
  let length = 1;
  let anchorHeight: number | undefined;
  return {
    reset() {
      length = 1;
      anchorHeight = undefined;
    },
    update(
      camera: T.PerspectiveCamera,
      position: T.Vector3,
      yaw: number,
      pitch: number,
      crouched: boolean,
      dt: number,
      pushing = false,
    ) {
      const targetHeight = crouched ? 0.92 : 1.24;
      anchorHeight = T.MathUtils.lerp(
        anchorHeight ?? targetHeight,
        targetHeight,
        1 - Math.exp(-dt * 12),
      );
      anchor.set(position.x, anchorHeight, position.z);
      rotation.set(clampViewPitch(pitch, 'third') - 0.16, yaw, 0);
      const crouchBlend = T.MathUtils.clamp((1.24 - anchorHeight) / 0.32, 0, 1);
      offset.set(0.52, 0, T.MathUtils.lerp(3.15, 2.8, crouchBlend)).applyEuler(rotation);
      desired.copy(anchor).add(offset);
      desired.y = Math.max(0.32, desired.y);
      const available = collision.fraction(anchor, desired);
      // Retract instantly to avoid crossing a surface; only recovery is damped.
      length =
        available < length
          ? available
          : T.MathUtils.lerp(length, available, 1 - Math.exp(-dt * 7));
      camera.position.copy(anchor).lerp(desired, length);
      const distance = camera.position.distanceTo(anchor);
      // Keep the look direction stable, including when a wall leaves no boom.
      // The lateral offset places the worker to the left of the sightline.
      camera.rotation.set(rotation.x, yaw, 0, 'YXZ');
      return { distance, avatarVisible: distance > (pushing ? 2.15 : 0.78) };
    },
  };
}
