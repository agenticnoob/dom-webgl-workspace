import { PerspectiveCamera, type Mesh, Vector3 } from "three";

const cameraDirection = new Vector3();
const screenOffset = new Vector3();

/** Keep a native plane at a fixed camera depth, sized in CSS pixels. */
export function placeHeroScreenPlane(
  mesh: Mesh,
  camera: PerspectiveCamera,
  viewport: { width: number; height: number },
  depth: number,
  rect = { left: 0, top: 0, width: viewport.width, height: viewport.height },
  overscan = 1,
): number {
  const unitsPerPixel =
    (2 * depth * Math.tan((camera.fov * Math.PI) / 360)) /
    Math.max(1, viewport.height);
  screenOffset
    .set(
      (rect.left + rect.width / 2 - viewport.width / 2) * unitsPerPixel,
      (viewport.height / 2 - rect.top - rect.height / 2) * unitsPerPixel,
      0,
    )
    .applyQuaternion(camera.quaternion);
  camera.getWorldDirection(cameraDirection);
  mesh.position
    .copy(camera.position)
    .addScaledVector(cameraDirection, depth)
    .add(screenOffset);
  mesh.quaternion.copy(camera.quaternion);
  mesh.scale.set(
    rect.width * unitsPerPixel * overscan,
    rect.height * unitsPerPixel * overscan,
    1,
  );
  return unitsPerPixel;
}
