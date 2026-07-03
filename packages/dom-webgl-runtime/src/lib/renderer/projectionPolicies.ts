import type {
  WebGLCameraMode,
  WebGLCameraType,
  WebGLSceneProjection,
  WebGLScreenAnchor,
  WebGLTuple2,
  WebGLTuple3,
} from "../types";
import type { NormalizedTargetPlacement } from "./renderLayerDeclarations";

type ScreenAnchoredPlacement = Extract<
  NormalizedTargetPlacement,
  { mode: "screen-anchored" }
>;
type ScreenDepthPlacement = Extract<
  NormalizedTargetPlacement,
  { mode: "screen-depth" }
>;
type StageLocalPlacement = Extract<
  NormalizedTargetPlacement,
  { mode: "stage-local" }
>;

export type DOMViewportSize = {
  width: number;
  height: number;
};

export type ProjectedDOMRect = {
  x: number;
  y: number;
  z?: number;
  width: number;
  height: number;
  rotation?: WebGLTuple3;
  scale?: number | WebGLTuple3;
};

export type ProjectionCameraState = {
  type: WebGLCameraType;
  mode: WebGLCameraMode;
  fov?: number;
  position?: WebGLTuple3;
  target?: WebGLTuple3;
};

export type ProjectTargetLayoutInput = {
  sceneProjection: WebGLSceneProjection;
  camera: ProjectionCameraState;
  placement: NormalizedTargetPlacement;
  measurement: Pick<DOMRectReadOnly, "left" | "top" | "width" | "height">;
  viewport: DOMViewportSize;
};

export function projectDOMRectToSceneLayout(
  rect: Pick<DOMRectReadOnly, "left" | "top" | "width" | "height">,
  viewport: DOMViewportSize,
): ProjectedDOMRect {
  return {
    x: rect.left + rect.width / 2,
    y: viewport.height - (rect.top + rect.height / 2),
    width: rect.width,
    height: rect.height,
  };
}

export function projectTargetLayout(
  input: ProjectTargetLayoutInput,
): ProjectedDOMRect {
  switch (input.placement.mode) {
    case "dom-anchored":
      return projectDOMRectToSceneLayout(input.measurement, input.viewport);
    case "screen-anchored":
      return projectScreenAnchoredLayout(
        input.placement,
        input.measurement,
        input.viewport,
      );
    case "screen-depth":
      return projectScreenDepthLayout(
        input.placement,
        input.camera,
        input.measurement,
        input.viewport,
      );
    case "stage-local":
      return projectStageLocalLayout(input.placement, input.measurement);
  }
}

function projectScreenAnchoredLayout(
  placement: ScreenAnchoredPlacement,
  measurement: Pick<DOMRectReadOnly, "width" | "height">,
  viewport: DOMViewportSize,
): ProjectedDOMRect {
  const [anchorX, anchorY] = readScreenAnchorPoint(
    placement.anchor,
    viewport,
  );
  const [offsetX, offsetY] = placement.offset;
  const [width, height] = readScreenSize(
    placement.size,
    measurement,
  );

  return {
    x: anchorX + offsetX,
    y: anchorY - offsetY,
    z: 0,
    width,
    height,
  };
}

function projectScreenDepthLayout(
  placement: ScreenDepthPlacement,
  camera: ProjectionCameraState,
  measurement: Pick<DOMRectReadOnly, "left" | "top" | "width" | "height">,
  viewport: DOMViewportSize,
): ProjectedDOMRect {
  const depth = placement.depth;
  const fov = camera.fov ?? 50;
  const verticalSpan = 2 * depth * Math.tan((fov * Math.PI) / 360);
  const unitsPerPixel = verticalSpan / viewport.height;
  const centerX = measurement.left + measurement.width / 2;
  const centerY = measurement.top + measurement.height / 2;
  const cameraZ = camera.position?.[2] ?? 500;

  return {
    x: (centerX - viewport.width / 2) * unitsPerPixel,
    y: (viewport.height / 2 - centerY) * unitsPerPixel,
    z: cameraZ - depth,
    width: readProjectedSize(
      placement.size,
      measurement.width,
      unitsPerPixel,
      0,
    ),
    height: readProjectedSize(
      placement.size,
      measurement.height,
      unitsPerPixel,
      1,
    ),
  };
}

function projectStageLocalLayout(
  placement: StageLocalPlacement,
  measurement: Pick<DOMRectReadOnly, "width" | "height">,
): ProjectedDOMRect {
  const size = placement.size ?? [
    measurement.width,
    measurement.height,
  ];

  return {
    x: placement.position[0],
    y: placement.position[1],
    z: placement.position[2],
    width: size[0],
    height: size[1],
    rotation: placement.rotation,
    scale: placement.scale,
  };
}

function readScreenAnchorPoint(
  anchor: WebGLScreenAnchor,
  viewport: DOMViewportSize,
): WebGLTuple2 {
  switch (anchor) {
    case "top-left":
      return [0, viewport.height];
    case "top":
      return [viewport.width / 2, viewport.height];
    case "top-right":
      return [viewport.width, viewport.height];
    case "right":
      return [viewport.width, viewport.height / 2];
    case "bottom-right":
      return [viewport.width, 0];
    case "bottom":
      return [viewport.width / 2, 0];
    case "bottom-left":
      return [0, 0];
    case "left":
      return [0, viewport.height / 2];
    case "center":
      return [viewport.width / 2, viewport.height / 2];
  }
}

function readScreenSize(
  size: "dom" | WebGLTuple2,
  measurement: Pick<DOMRectReadOnly, "width" | "height">,
): WebGLTuple2 {
  if (size === "dom") {
    return [measurement.width, measurement.height];
  }

  return size;
}

function readProjectedSize(
  size: "dom" | WebGLTuple2,
  measurement: number,
  unitsPerPixel: number,
  axis: 0 | 1,
): number {
  if (size === "dom") {
    return measurement * unitsPerPixel;
  }

  return size[axis];
}
