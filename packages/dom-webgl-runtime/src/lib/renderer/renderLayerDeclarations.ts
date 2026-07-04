import type {
  WebGLCameraDeclaration,
  WebGLCameraMode,
  WebGLCameraType,
  WebGLDOMAnchoredPlacementDeclaration,
  WebGLPlacementDeclaration,
  WebGLPassViewportDeclaration,
  WebGLPostprocessDeclaration,
  WebGLScreenAnchor,
  WebGLScreenAnchoredPlacementDeclaration,
  WebGLScreenDepthPlacementDeclaration,
  WebGLStageLocalPlacementDeclaration,
  WebGLRenderPassDeclaration,
  WebGLSceneDeclaration,
  WebGLSceneProjection,
  WebGLTuple2,
  WebGLTuple3,
} from "../types";
import {
  normalizeTimelineBinding,
  type NormalizedTimelineBinding,
} from "../timeline/timelineDeclarations";
import {
  normalizeCameraControllerDeclaration,
  type NormalizedCameraControllerDeclaration,
} from "./cameraControllerDeclarations";

export const generatedRenderLayerId = "__dom-webgl-default__";

export type NormalizedRenderLayerSceneDeclaration = {
  id: string;
  projection: WebGLSceneProjection;
  defaultCameraId?: string;
  defaultPass: boolean;
  timeline?: NormalizedTimelineBinding;
};

export type NormalizedRenderLayerCameraDeclaration = {
  id: string;
  sceneId: string;
  type: WebGLCameraType;
  mode: WebGLCameraMode;
  default: boolean;
  fov?: number;
  near?: number;
  far?: number;
  position?: WebGLTuple3;
  target?: WebGLTuple3;
  zoom?: number;
  controller?: NormalizedCameraControllerDeclaration;
};

export type NormalizedRenderLayerPassDeclaration = {
  id: string;
  sceneId: string;
  cameraId?: string;
  order: number;
  clear: boolean;
  clearDepth: boolean;
  viewport?: WebGLPassViewportDeclaration;
  postprocess?: WebGLPostprocessDeclaration;
};

export type NormalizedTargetPlacement =
  | Required<WebGLDOMAnchoredPlacementDeclaration>
  | (WebGLScreenAnchoredPlacementDeclaration & {
      anchor: WebGLScreenAnchor;
      offset: WebGLTuple2;
      size: "dom" | WebGLTuple2;
    })
  | (WebGLScreenDepthPlacementDeclaration & {
      depth: number;
      size: "dom" | WebGLTuple2;
    })
  | (WebGLStageLocalPlacementDeclaration & {
      position: WebGLTuple3;
      rotation: WebGLTuple3;
      scale: number | WebGLTuple3;
    });

export function normalizeRenderLayerSceneDeclaration(
  declaration: WebGLSceneDeclaration,
): NormalizedRenderLayerSceneDeclaration {
  const id = normalizePublicId(declaration.id, "scene");
  assertNotReservedGeneratedId(id, "scene");
  const projection = declaration.projection ?? "dom-aligned";
  assertSceneProjection(projection);

  const defaultCameraId = declaration.defaultCameraId
    ? normalizePublicId(declaration.defaultCameraId, "camera")
    : undefined;

  if (defaultCameraId) {
    assertNotReservedGeneratedId(defaultCameraId, "camera");
  }

  return {
    id,
    projection,
    ...(defaultCameraId ? { defaultCameraId } : {}),
    defaultPass: declaration.defaultPass ?? false,
    ...(declaration.timeline
      ? { timeline: normalizeTimelineBinding(declaration.timeline) }
      : {}),
  };
}

export function normalizeRenderLayerCameraDeclaration(
  declaration: WebGLCameraDeclaration,
): NormalizedRenderLayerCameraDeclaration {
  const id = normalizePublicId(declaration.id, "camera");
  const sceneId = normalizePublicId(declaration.sceneId, "scene");
  const type = declaration.type ?? "orthographic";
  const mode = declaration.mode ?? "dom-aligned";

  assertNotReservedGeneratedId(id, "camera");
  assertCameraType(type);
  assertCameraMode(mode);

  return {
    id,
    sceneId,
    type,
    mode,
    default: declaration.default ?? false,
    ...(declaration.fov !== undefined
      ? { fov: normalizePositiveNumber(declaration.fov, 50, "camera fov") }
      : {}),
    ...(declaration.near !== undefined
      ? { near: normalizePositiveNumber(declaration.near, 0.1, "camera near") }
      : {}),
    ...(declaration.far !== undefined
      ? { far: normalizePositiveNumber(declaration.far, 2000, "camera far") }
      : {}),
    ...(declaration.position
      ? {
          position: normalizeTuple3(
            declaration.position,
            [0, 0, 500],
            "camera position",
          ),
        }
      : {}),
    ...(declaration.target
      ? {
          target: normalizeTuple3(
            declaration.target,
            [0, 0, 0],
            "camera target",
          ),
        }
      : {}),
    ...(declaration.zoom !== undefined
      ? { zoom: normalizePositiveNumber(declaration.zoom, 1, "camera zoom") }
      : {}),
    ...(declaration.controller
      ? { controller: normalizeCameraControllerDeclaration(declaration.controller) }
      : {}),
  };
}

export function normalizeRenderLayerPassDeclaration(
  declaration: WebGLRenderPassDeclaration,
): NormalizedRenderLayerPassDeclaration {
  const sceneId = normalizePublicId(declaration.sceneId, "scene");
  const cameraId = declaration.cameraId
    ? normalizePublicId(declaration.cameraId, "camera")
    : undefined;
  const id = declaration.id
    ? normalizePublicId(declaration.id, "render pass")
    : `${sceneId}:${cameraId ?? "default"}:pass`;

  assertNotReservedGeneratedId(id, "render pass");
  const viewport = normalizePassViewport(declaration.viewport);

  return {
    id,
    sceneId,
    ...(cameraId ? { cameraId } : {}),
    order: normalizeOrder(declaration.order),
    clear: declaration.clear ?? false,
    clearDepth: declaration.clearDepth ?? false,
    ...(viewport ? { viewport } : {}),
    ...(declaration.postprocess
      ? { postprocess: clonePostprocessDeclaration(declaration.postprocess) }
      : {}),
  };
}

function normalizePassViewport(
  viewport: WebGLPassViewportDeclaration | undefined,
): WebGLPassViewportDeclaration | undefined {
  if (!viewport || !isDOMRectPassViewport(viewport)) {
    return undefined;
  }

  if (!viewport.anchorId) {
    throw new Error("WebGL render pass dom-rect viewport requires an anchorId.");
  }

  const anchorId = normalizePublicId(viewport.anchorId, "pass viewport anchor");
  return {
    mode: "dom-rect",
    anchorId,
    scissor: viewport.scissor ?? true,
  };
}

function isDOMRectPassViewport(
  viewport: WebGLPassViewportDeclaration,
): viewport is Extract<WebGLPassViewportDeclaration, { mode: "dom-rect" }> {
  return "mode" in viewport && viewport.mode === "dom-rect";
}

function clonePostprocessDeclaration(
  declaration: WebGLPostprocessDeclaration,
): WebGLPostprocessDeclaration {
  return {
    ...(declaration.bloom ? { bloom: { ...declaration.bloom } } : {}),
    ...(declaration.grain ? { grain: { ...declaration.grain } } : {}),
    ...(declaration.blur ? { blur: { ...declaration.blur } } : {}),
  };
}

export function normalizeTargetSceneId(sceneId: string | undefined): string {
  if (sceneId === undefined) {
    return generatedRenderLayerId;
  }

  return normalizePublicId(sceneId, "scene");
}

export function normalizeTargetPlacement(
  placement: WebGLPlacementDeclaration | undefined,
): NormalizedTargetPlacement {
  if (
    !placement ||
    placement.mode === undefined ||
    placement.mode === "dom-anchored"
  ) {
    return { mode: "dom-anchored" };
  }

  switch (placement.mode) {
    case "screen-anchored":
      return {
        mode: "screen-anchored",
        anchor: placement.anchor ?? "center",
        offset: normalizeTuple2(
          placement.offset,
          [0, 0],
          "screen-anchored offset",
        ),
        size: normalizePlacementSize(placement.size),
      };
    case "screen-depth":
      return {
        mode: "screen-depth",
        depth: normalizePositiveNumber(
          placement.depth,
          500,
          "screen-depth depth",
        ),
        size: normalizePlacementSize(placement.size),
      };
    case "stage-local":
      return {
        mode: "stage-local",
        position: normalizeTuple3(
          placement.position,
          [0, 0, 0],
          "stage-local position",
        ),
        rotation: normalizeTuple3(
          placement.rotation,
          [0, 0, 0],
          "stage-local rotation",
        ),
        scale: normalizePlacementScale(placement.scale),
        ...(placement.size
          ? { size: normalizeTuple2(placement.size, [1, 1], "stage-local size") }
          : {}),
      };
  }
}

export function assertCameraMatchesSceneProjection(
  scene: Pick<NormalizedRenderLayerSceneDeclaration, "id" | "projection">,
  camera: Pick<
    NormalizedRenderLayerCameraDeclaration,
    "id" | "type" | "mode"
  >,
): void {
  switch (scene.projection) {
    case "dom-aligned":
      if (camera.type === "orthographic" && camera.mode === "dom-aligned") {
        return;
      }
      break;
    case "screen":
      if (camera.type === "orthographic" && camera.mode === "screen") {
        return;
      }
      break;
    case "perspective-stage":
      if (camera.type === "perspective" && camera.mode === "perspective-stage") {
        return;
      }
      break;
  }

  throw new Error(
    `WebGL camera "${camera.id}" uses ${camera.type}/${camera.mode} but scene "${scene.id}" uses projection "${scene.projection}".`,
  );
}

function normalizePublicId(value: string, kind: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`WebGL ${kind} declaration requires a non-empty id.`);
  }

  return normalized;
}

function assertNotReservedGeneratedId(
  id: string,
  kind: "scene" | "camera" | "render pass",
): void {
  if (id !== generatedRenderLayerId) {
    return;
  }

  throw new Error(
    `WebGL ${kind} id "${generatedRenderLayerId}" is reserved by the generated Level 1 ${readLevelOneResourceName(kind)}.`,
  );
}

function readLevelOneResourceName(kind: "scene" | "camera" | "render pass"): string {
  if (kind === "render pass") {
    return "pass";
  }

  return kind;
}

function normalizeOrder(value: number | undefined): number {
  if (value === undefined) {
    return 0;
  }

  if (!Number.isFinite(value)) {
    throw new Error("WebGL render pass order must be a finite number.");
  }

  return value;
}

function normalizePositiveNumber(
  value: number | undefined,
  fallback: number,
  label: string,
): number {
  if (value === undefined) {
    return fallback;
  }

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`WebGL ${label} must be a positive finite number.`);
  }

  return value;
}

function normalizeTuple2(
  value: WebGLTuple2 | undefined,
  fallback: WebGLTuple2,
  label: string,
): WebGLTuple2 {
  if (value === undefined) {
    return fallback;
  }

  if (!Number.isFinite(value[0]) || !Number.isFinite(value[1])) {
    throw new Error(`WebGL ${label} must contain finite numbers.`);
  }

  return [value[0], value[1]];
}

function normalizeTuple3(
  value: WebGLTuple3 | undefined,
  fallback: WebGLTuple3,
  label: string,
): WebGLTuple3 {
  if (value === undefined) {
    return fallback;
  }

  if (
    !Number.isFinite(value[0]) ||
    !Number.isFinite(value[1]) ||
    !Number.isFinite(value[2])
  ) {
    throw new Error(`WebGL ${label} must contain finite numbers.`);
  }

  return [value[0], value[1], value[2]];
}

function normalizePlacementSize(
  size: "dom" | WebGLTuple2 | undefined,
): "dom" | WebGLTuple2 {
  if (size === undefined || size === "dom") {
    return "dom";
  }

  return normalizeTuple2(size, [1, 1], "placement size");
}

function normalizePlacementScale(
  scale: number | WebGLTuple3 | undefined,
): number | WebGLTuple3 {
  if (scale === undefined) {
    return 1;
  }

  if (typeof scale === "number") {
    return normalizePositiveNumber(scale, 1, "stage-local scale");
  }

  return normalizeTuple3(scale, [1, 1, 1], "stage-local scale");
}

function assertSceneProjection(value: WebGLSceneProjection): void {
  if (
    value === "dom-aligned" ||
    value === "screen" ||
    value === "perspective-stage"
  ) {
    return;
  }

  throw new Error(`Unsupported WebGL scene projection "${String(value)}".`);
}

function assertCameraType(value: WebGLCameraType): void {
  if (value === "orthographic" || value === "perspective") {
    return;
  }

  throw new Error(`Unsupported WebGL camera type "${String(value)}".`);
}

function assertCameraMode(value: WebGLCameraMode): void {
  if (
    value === "dom-aligned" ||
    value === "screen" ||
    value === "perspective-stage"
  ) {
    return;
  }

  throw new Error(`Unsupported WebGL camera mode "${String(value)}".`);
}
