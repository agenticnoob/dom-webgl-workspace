import { PlaneGeometry } from "three/src/geometries/PlaneGeometry.js";

export type SharedPlaneGeometryHandle = {
  geometry: PlaneGeometry;
  dispose(): void;
};

let sharedGeometry: PlaneGeometry | undefined;
let referenceCount = 0;

export function acquireSharedPlaneGeometry(): SharedPlaneGeometryHandle {
  if (!sharedGeometry) {
    sharedGeometry = new PlaneGeometry(1, 1);
  }

  const geometry = sharedGeometry;
  let disposed = false;
  referenceCount += 1;

  return {
    geometry,
    dispose(): void {
      if (disposed) {
        return;
      }

      disposed = true;
      referenceCount = Math.max(0, referenceCount - 1);

      if (referenceCount === 0 && sharedGeometry === geometry) {
        sharedGeometry = undefined;
        geometry.dispose();
      }
    },
  };
}
