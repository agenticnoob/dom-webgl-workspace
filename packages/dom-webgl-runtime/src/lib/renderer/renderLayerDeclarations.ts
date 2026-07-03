import type {
  WebGLCameraDeclaration,
  WebGLCameraMode,
  WebGLCameraType,
  WebGLRenderPassDeclaration,
  WebGLSceneDeclaration,
  WebGLSceneProjection,
} from "../types";

export const generatedRenderLayerId = "__dom-webgl-default__";

export type NormalizedRenderLayerSceneDeclaration = {
  id: string;
  projection: WebGLSceneProjection;
  defaultCameraId?: string;
  defaultPass: boolean;
};

export type NormalizedRenderLayerCameraDeclaration = {
  id: string;
  sceneId: string;
  type: WebGLCameraType;
  mode: WebGLCameraMode;
  default: boolean;
};

export type NormalizedRenderLayerPassDeclaration = {
  id: string;
  sceneId: string;
  cameraId?: string;
  order: number;
};

export function normalizeRenderLayerSceneDeclaration(
  declaration: WebGLSceneDeclaration,
): NormalizedRenderLayerSceneDeclaration {
  const id = normalizePublicId(declaration.id, "scene");
  assertNotReservedGeneratedId(id, "scene");
  const projection = declaration.projection ?? "dom-aligned";

  if (projection !== "dom-aligned") {
    throw new Error(
      `Unsupported WebGL scene projection "${String(projection)}".`,
    );
  }

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

  if (type !== "orthographic") {
    throw new Error(`Unsupported WebGL camera type "${String(type)}".`);
  }

  if (mode !== "dom-aligned") {
    throw new Error(`Unsupported WebGL camera mode "${String(mode)}".`);
  }

  return {
    id,
    sceneId,
    type,
    mode,
    default: declaration.default ?? false,
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

  return {
    id,
    sceneId,
    ...(cameraId ? { cameraId } : {}),
    order: normalizeOrder(declaration.order),
  };
}

export function normalizeTargetSceneId(sceneId: string | undefined): string {
  if (sceneId === undefined) {
    return generatedRenderLayerId;
  }

  return normalizePublicId(sceneId, "scene");
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
