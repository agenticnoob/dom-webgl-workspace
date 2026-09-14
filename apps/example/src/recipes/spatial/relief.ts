import { faceDefinitions, spatialConfig } from "./config";
import { resolvePortalCameraFrame, type PortalGeometryFrame } from "./geometry";
import {
  addVectors,
  dotVector,
  eulerFromQuaternion,
  lerpVector,
  multiplyQuaternions,
  normalizeVector,
  quaternionFromBasis,
  quaternionFromEuler,
  rotateVector,
  scaleVector,
  slerpQuaternions,
  type Vector3,
} from "./math";
import type { PortalFrame } from "./frame";
import type { ReliefModel, SpatialViewport } from "./types";

export function resolveReliefFrame(
  tetrahedron: PortalGeometryFrame,
  frame: PortalFrame,
  viewport: SpatialViewport,
  model: ReliefModel,
) {
  const faceIndex = model.face ?? 0;
  const face = faceDefinitions[faceIndex];
  const normal = normalizeVector(face.normal);
  const parent = quaternionFromEuler(tetrahedron.rotation);
  const local = scaleVector(
    normal,
    (spatialConfig.geometry.radius / 3 + 0.022) * tetrahedron.scale,
  );
  const facePosition = addVectors(
    tetrahedron.position,
    rotateVector(local, parent),
  );
  const faceRotation = multiplyQuaternions(
    parent,
    quaternionFromBasis(
      normalizeVector(face.right),
      normalizeVector(face.up),
      normal,
    ),
  );
  const faceScale: Vector3 = [
    tetrahedron.scale * 0.27,
    tetrahedron.scale * 0.27,
    tetrahedron.scale * 0.045,
  ];
  const bodySize = (model.bodyScale ?? 1) * (viewport.width <= 700 ? 0.63 : 1);
  const bodyPosition: Vector3 = [0, 0.3, 0.18];
  const bodyScale: Vector3 = [bodySize, bodySize, bodySize];
  const reveal = frame.faceIndex === faceIndex ? frame.triangleReveal : 0;
  const camera = resolvePortalCameraFrame();
  const bodyOffset = addVectors(bodyPosition, scaleVector(camera.position, -1));
  const surfaceOffset = addVectors(
    facePosition,
    scaleVector(camera.position, -1),
  );
  const ratio =
    Math.max(1e-6, dotVector(surfaceOffset, camera.forward)) /
    Math.max(1e-6, dotVector(bodyOffset, camera.forward));
  const position =
    reveal >= 1
      ? bodyPosition
      : lerpVector(
          facePosition,
          addVectors(camera.position, scaleVector(bodyOffset, ratio)),
          reveal,
        );
  const scale =
    reveal >= 1
      ? bodyScale
      : lerpVector(faceScale, scaleVector(bodyScale, ratio), reveal);
  const rotation = eulerFromQuaternion(
    slerpQuaternions(faceRotation, quaternionFromEuler([0, 0, 0]), reveal),
  );
  const normalizedScale = scaleVector(scale, 1 / (model.size ?? 1));
  const center = model.center ?? [0, 0, 0];
  const offset = rotateVector(
    [
      center[0] * normalizedScale[0],
      center[1] * normalizedScale[1],
      center[2] * normalizedScale[2],
    ],
    quaternionFromEuler(rotation),
  );
  return {
    visible: frame.faceIndex === faceIndex || !frame.domContentActive,
    position: addVectors(position, scaleVector(offset, -1)),
    rotation,
    scale: normalizedScale,
  };
}
