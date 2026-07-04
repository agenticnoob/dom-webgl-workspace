import type {
  WebGLCameraControllerDeclaration,
  WebGLCameraControllerEasing,
  WebGLCameraControllerFrameDeclaration,
  WebGLCameraControllerTimelineDeclaration,
  WebGLProgressSignalSource,
  WebGLTimelineActiveRangeDeclaration,
  WebGLTuple3,
} from "../types";

export type NormalizedCameraControllerFrameDeclaration = {
  readonly position?: WebGLTuple3;
  readonly target?: WebGLTuple3;
  readonly fov?: number;
};

export type NormalizedCameraControllerTimelineDeclaration = {
  readonly id: string;
  readonly progressKey: string;
  readonly range?: {
    readonly from: number;
    readonly to: number;
  };
};

export type NormalizedCameraControllerDeclaration = {
  readonly timeline: NormalizedCameraControllerTimelineDeclaration;
  readonly from?: NormalizedCameraControllerFrameDeclaration;
  readonly to: NormalizedCameraControllerFrameDeclaration;
  readonly easing: WebGLCameraControllerEasing;
};

export function normalizeCameraControllerDeclaration(
  declaration: WebGLCameraControllerDeclaration,
): NormalizedCameraControllerDeclaration {
  const to = normalizeControllerFrame(declaration.to, "to");
  assertControllerFrameHasFields(to, "to");

  return {
    timeline: normalizeControllerTimeline(declaration.timeline),
    ...(declaration.from
      ? { from: normalizeControllerFrame(declaration.from, "from") }
      : {}),
    to,
    easing: normalizeEasing(declaration.easing),
  };
}

export function readCameraControllerProgress(
  declaration: NormalizedCameraControllerDeclaration,
  progressSignals: WebGLProgressSignalSource,
): number {
  const raw = clampProgress(progressSignals.get(declaration.timeline.progressKey));
  const range = declaration.timeline.range;

  if (!range) {
    return applyEasing(raw, declaration.easing);
  }

  const span = range.to - range.from;
  const progress = span <= 0 ? 1 : clampProgress((raw - range.from) / span);

  return applyEasing(progress, declaration.easing);
}

export function readCameraControllerFrame(
  declaration: NormalizedCameraControllerDeclaration,
  base: NormalizedCameraControllerFrameDeclaration,
  progress: number,
): NormalizedCameraControllerFrameDeclaration {
  const t = clampProgress(progress);
  const frame: {
    position?: WebGLTuple3;
    target?: WebGLTuple3;
    fov?: number;
  } = {};

  if (declaration.to.position) {
    frame.position = interpolateTuple3(
      declaration.from?.position ?? base.position ?? [0, 0, 500],
      declaration.to.position,
      t,
    );
  }

  if (declaration.to.target) {
    frame.target = interpolateTuple3(
      declaration.from?.target ?? base.target ?? [0, 0, 0],
      declaration.to.target,
      t,
    );
  }

  if (declaration.to.fov !== undefined) {
    frame.fov = interpolateNumber(
      declaration.from?.fov ?? base.fov ?? 50,
      declaration.to.fov,
      t,
    );
  }

  return frame;
}

function normalizeControllerTimeline(
  declaration: WebGLCameraControllerTimelineDeclaration,
): NormalizedCameraControllerTimelineDeclaration {
  if (typeof declaration === "string") {
    const id = normalizeControllerTimelineId(declaration);
    return { id, progressKey: id };
  }

  const id = normalizeControllerTimelineId(declaration.id);
  const progressKey =
    declaration.progressKey === undefined
      ? id
      : normalizeControllerTimelineId(declaration.progressKey);

  return {
    id,
    progressKey,
    ...(declaration.range
      ? { range: normalizeControllerRange(declaration.range) }
      : {}),
  };
}

function normalizeControllerTimelineId(value: string): string {
  const id = value.trim();

  if (!id) {
    throw new Error(
      "WebGL camera controller timeline id must be a non-empty string.",
    );
  }

  return id;
}

function normalizeControllerRange(
  range: WebGLTimelineActiveRangeDeclaration,
): { readonly from: number; readonly to: number } {
  return {
    from: normalizeRangeBoundary(range.from, 0, "from"),
    to: normalizeRangeBoundary(range.to, 1, "to"),
  };
}

function normalizeRangeBoundary(
  value: number | undefined,
  fallback: number,
  label: "from" | "to",
): number {
  if (value === undefined) {
    return fallback;
  }

  if (!Number.isFinite(value)) {
    throw new Error(`WebGL camera controller range ${label} must be finite.`);
  }

  return clampProgress(value);
}

function normalizeControllerFrame(
  frame: WebGLCameraControllerFrameDeclaration,
  label: "from" | "to",
): NormalizedCameraControllerFrameDeclaration {
  return {
    ...(frame.position
      ? { position: normalizeTuple3(frame.position, `camera controller ${label} position`) }
      : {}),
    ...(frame.target
      ? { target: normalizeTuple3(frame.target, `camera controller ${label} target`) }
      : {}),
    ...(frame.fov !== undefined
      ? { fov: normalizePositiveNumber(frame.fov, `camera controller ${label} fov`) }
      : {}),
  };
}

function assertControllerFrameHasFields(
  frame: NormalizedCameraControllerFrameDeclaration,
  label: "from" | "to",
): void {
  if (
    frame.position !== undefined ||
    frame.target !== undefined ||
    frame.fov !== undefined
  ) {
    return;
  }

  throw new Error(
    `WebGL camera controller "${label}" must include position, target, or fov.`,
  );
}

function normalizeTuple3(value: WebGLTuple3, label: string): WebGLTuple3 {
  if (
    !Number.isFinite(value[0]) ||
    !Number.isFinite(value[1]) ||
    !Number.isFinite(value[2])
  ) {
    throw new Error(`WebGL ${label} must contain finite numbers.`);
  }

  return [value[0], value[1], value[2]];
}

function normalizePositiveNumber(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`WebGL ${label} must be a positive finite number.`);
  }

  return value;
}

function normalizeEasing(
  easing: WebGLCameraControllerEasing | undefined,
): WebGLCameraControllerEasing {
  if (easing === undefined || easing === "linear" || easing === "smoothstep") {
    return easing ?? "linear";
  }

  throw new Error(
    `Unsupported WebGL camera controller easing "${String(easing)}".`,
  );
}

function applyEasing(
  progress: number,
  easing: WebGLCameraControllerEasing,
): number {
  switch (easing) {
    case "linear":
      return progress;
    case "smoothstep":
      return progress * progress * (3 - 2 * progress);
  }
}

function interpolateTuple3(
  from: WebGLTuple3,
  to: WebGLTuple3,
  progress: number,
): WebGLTuple3 {
  return [
    interpolateNumber(from[0], to[0], progress),
    interpolateNumber(from[1], to[1], progress),
    interpolateNumber(from[2], to[2], progress),
  ];
}

function interpolateNumber(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}
