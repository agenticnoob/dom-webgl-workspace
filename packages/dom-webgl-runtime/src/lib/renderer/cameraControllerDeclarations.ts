import type {
  WebGLCameraControllerDeclaration,
  WebGLCameraControllerEasing,
  WebGLCameraControllerFrameDeclaration,
  WebGLCameraDollyGestureDeclaration,
  WebGLCameraGestureButton,
  WebGLCameraGestureDampingDeclaration,
  WebGLCameraGestureDragDeclaration,
  WebGLCameraGestureModifier,
  WebGLCameraGestureResetDeclaration,
  WebGLCameraOrbitGestureDeclaration,
  WebGLCameraPanGestureDeclaration,
  WebGLCameraPointerControllerDeclaration,
  WebGLCameraPointerParallaxDeclaration,
  WebGLCameraControllerTimelineDeclaration,
  WebGLProgressSignalSource,
  WebGLTimelineActiveRangeDeclaration,
  WebGLTuple2,
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

export type NormalizedCameraGestureDragDeclaration = {
  readonly button: WebGLCameraGestureButton;
  readonly modifier?: WebGLCameraGestureModifier;
};

export type NormalizedCameraOrbitGestureDeclaration = {
  readonly drag: NormalizedCameraGestureDragDeclaration;
  readonly target: WebGLTuple3;
  readonly sensitivity: WebGLTuple2;
  readonly minPolarAngle?: number;
  readonly maxPolarAngle?: number;
  readonly minDistance?: number;
  readonly maxDistance?: number;
};

export type NormalizedCameraPanGestureDeclaration = {
  readonly drag: NormalizedCameraGestureDragDeclaration;
  readonly sensitivity: WebGLTuple2;
};

export type NormalizedCameraDollyGestureDeclaration = {
  readonly drag: NormalizedCameraGestureDragDeclaration;
  readonly sensitivity: number;
  readonly minDistance?: number;
  readonly maxDistance?: number;
};

export type NormalizedCameraPointerParallaxDeclaration = {
  readonly scope: "camera";
  readonly strength: WebGLTuple2;
  readonly maxOffset: WebGLTuple2;
};

export type NormalizedCameraGestureDampingDeclaration = {
  readonly factor: number;
  readonly settleEpsilon: number;
};

export type NormalizedCameraGestureResetDeclaration = {
  readonly onDoubleClick: boolean;
  readonly durationMs: number;
};

export type NormalizedCameraPointerControllerDeclaration = {
  readonly activation: "empty-space";
  readonly orbit?: NormalizedCameraOrbitGestureDeclaration;
  readonly pan?: NormalizedCameraPanGestureDeclaration;
  readonly dolly?: NormalizedCameraDollyGestureDeclaration;
  readonly parallax?: NormalizedCameraPointerParallaxDeclaration;
  readonly damping?: NormalizedCameraGestureDampingDeclaration;
  readonly reset?: NormalizedCameraGestureResetDeclaration;
};

export type NormalizedCameraControllerDeclaration = {
  readonly timeline?: NormalizedCameraControllerTimelineDeclaration;
  readonly from?: NormalizedCameraControllerFrameDeclaration;
  readonly to?: NormalizedCameraControllerFrameDeclaration;
  readonly easing: WebGLCameraControllerEasing;
  readonly pointer?: NormalizedCameraPointerControllerDeclaration;
};

export function normalizeCameraControllerDeclaration(
  declaration: WebGLCameraControllerDeclaration,
): NormalizedCameraControllerDeclaration {
  const to = declaration.to
    ? normalizeControllerFrame(declaration.to, "to")
    : undefined;
  if (declaration.timeline && !to) {
    throw new Error(
      'WebGL camera controller "to" must include position, target, or fov when timeline is declared.',
    );
  }
  if (to) {
    assertControllerFrameHasFields(to, "to");
  }
  if (!declaration.timeline && !declaration.pointer) {
    throw new Error(
      "WebGL camera controller requires timeline or pointer behavior.",
    );
  }

  return {
    ...(declaration.timeline
      ? { timeline: normalizeControllerTimeline(declaration.timeline) }
      : {}),
    ...(declaration.from
      ? { from: normalizeControllerFrame(declaration.from, "from") }
      : {}),
    ...(to ? { to } : {}),
    easing: normalizeEasing(declaration.easing),
    ...(declaration.pointer
      ? { pointer: normalizePointerController(declaration.pointer) }
      : {}),
  };
}

export function readCameraControllerProgress(
  declaration: NormalizedCameraControllerDeclaration,
  progressSignals: WebGLProgressSignalSource,
): number {
  if (!declaration.timeline) {
    return 0;
  }

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
  const to = declaration.to;

  if (!to) {
    return frame;
  }

  if (to.position) {
    frame.position = interpolateTuple3(
      declaration.from?.position ?? base.position ?? [0, 0, 500],
      to.position,
      t,
    );
  }

  if (to.target) {
    frame.target = interpolateTuple3(
      declaration.from?.target ?? base.target ?? [0, 0, 0],
      to.target,
      t,
    );
  }

  if (to.fov !== undefined) {
    frame.fov = interpolateNumber(
      declaration.from?.fov ?? base.fov ?? 50,
      to.fov,
      t,
    );
  }

  return frame;
}

function normalizePointerController(
  declaration: WebGLCameraPointerControllerDeclaration,
): NormalizedCameraPointerControllerDeclaration {
  if ("kind" in declaration) {
    return {
      activation: "empty-space",
      orbit: normalizeOrbitGesture({
        drag: { button: "primary" },
        target: declaration.target,
        sensitivity: declaration.sensitivity,
        minPolarAngle: declaration.minPolarAngle,
        maxPolarAngle: declaration.maxPolarAngle,
      }),
    };
  }

  const activation = declaration.activation ?? "empty-space";
  if (activation !== "empty-space") {
    throw new Error(
      `Unsupported WebGL camera gesture activation \"${String(activation)}\".`,
    );
  }

  return {
    activation,
    ...(declaration.orbit
      ? { orbit: normalizeOrbitGesture(declaration.orbit) }
      : {}),
    ...(declaration.pan ? { pan: normalizePanGesture(declaration.pan) } : {}),
    ...(declaration.dolly
      ? { dolly: normalizeDollyGesture(declaration.dolly) }
      : {}),
    ...(declaration.parallax
      ? { parallax: normalizePointerParallax(declaration.parallax) }
      : {}),
    ...(declaration.damping
      ? { damping: normalizeGestureDamping(declaration.damping) }
      : {}),
    ...(declaration.reset ? { reset: normalizeGestureReset(declaration.reset) } : {}),
  };
}

function normalizeOrbitGesture(
  declaration: true | WebGLCameraOrbitGestureDeclaration,
): NormalizedCameraOrbitGestureDeclaration {
  const input = declaration === true ? {} : declaration;
  const minDistance =
    input.minDistance === undefined
      ? undefined
      : normalizePositiveNumber(
          input.minDistance,
          "camera orbit gesture minDistance",
        );
  const maxDistance =
    input.maxDistance === undefined
      ? undefined
      : normalizePositiveNumber(
          input.maxDistance,
          "camera orbit gesture maxDistance",
        );

  assertMinMaxRange(
    minDistance,
    maxDistance,
    "WebGL camera orbit gesture minDistance must be <= maxDistance.",
  );

  return {
    drag: normalizeGestureDrag(input.drag, { button: "primary" }),
    target: input.target
      ? normalizeTuple3(input.target, "camera orbit gesture target")
      : [0, 0, 0],
    sensitivity: input.sensitivity
      ? normalizeTuple2(input.sensitivity, "camera orbit gesture sensitivity")
      : [0.004, 0.004],
    ...(input.minPolarAngle !== undefined
      ? {
          minPolarAngle: normalizeFiniteNumber(
            input.minPolarAngle,
            "camera orbit gesture minPolarAngle",
          ),
        }
      : {}),
    ...(input.maxPolarAngle !== undefined
      ? {
          maxPolarAngle: normalizeFiniteNumber(
            input.maxPolarAngle,
            "camera orbit gesture maxPolarAngle",
          ),
        }
      : {}),
    ...(minDistance !== undefined ? { minDistance } : {}),
    ...(maxDistance !== undefined ? { maxDistance } : {}),
  };
}

function normalizePanGesture(
  declaration: true | WebGLCameraPanGestureDeclaration,
): NormalizedCameraPanGestureDeclaration {
  const input = declaration === true ? {} : declaration;

  return {
    drag: normalizeGestureDrag(input.drag, { button: "secondary" }),
    sensitivity: input.sensitivity
      ? normalizeTuple2(input.sensitivity, "camera pan gesture sensitivity")
      : [1, 1],
  };
}

function normalizeDollyGesture(
  declaration: true | WebGLCameraDollyGestureDeclaration,
): NormalizedCameraDollyGestureDeclaration {
  const input = declaration === true ? {} : declaration;
  const minDistance =
    input.minDistance === undefined
      ? undefined
      : normalizePositiveNumber(
          input.minDistance,
          "camera dolly gesture minDistance",
        );
  const maxDistance =
    input.maxDistance === undefined
      ? undefined
      : normalizePositiveNumber(
          input.maxDistance,
          "camera dolly gesture maxDistance",
        );

  assertMinMaxRange(
    minDistance,
    maxDistance,
    "WebGL camera dolly gesture minDistance must be <= maxDistance.",
  );

  return {
    drag: normalizeGestureDrag(input.drag, {
      button: "primary",
      modifier: "alt",
    }),
    sensitivity:
      input.sensitivity === undefined
        ? 1
        : normalizeFiniteNumber(input.sensitivity, "camera dolly gesture sensitivity"),
    ...(minDistance !== undefined ? { minDistance } : {}),
    ...(maxDistance !== undefined ? { maxDistance } : {}),
  };
}

function normalizePointerParallax(
  declaration: WebGLCameraPointerParallaxDeclaration,
): NormalizedCameraPointerParallaxDeclaration {
  if (declaration.scope !== "camera") {
    throw new Error(
      `Unsupported WebGL camera pointer parallax scope \"${String(declaration.scope)}\".`,
    );
  }

  return {
    scope: "camera",
    strength: declaration.strength
      ? normalizeTuple2(declaration.strength, "camera pointer parallax strength")
      : [0, 0],
    maxOffset: declaration.maxOffset
      ? normalizeTuple2(declaration.maxOffset, "camera pointer parallax maxOffset")
      : [Infinity, Infinity],
  };
}

function normalizeGestureDamping(
  declaration: Exclude<WebGLCameraGestureDampingDeclaration, false>,
): NormalizedCameraGestureDampingDeclaration {
  if (declaration === true) {
    return { factor: 0.18, settleEpsilon: 0.001 };
  }

  return {
    factor:
      declaration.factor === undefined
        ? 0.18
        : normalizeUnitNumber(declaration.factor, "camera gesture damping factor"),
    settleEpsilon:
      declaration.settleEpsilon === undefined
        ? 0.001
        : normalizePositiveNumber(
            declaration.settleEpsilon,
            "camera gesture damping settleEpsilon",
          ),
  };
}

function normalizeGestureReset(
  declaration: WebGLCameraGestureResetDeclaration,
): NormalizedCameraGestureResetDeclaration {
  return {
    onDoubleClick: declaration.onDoubleClick ?? true,
    durationMs:
      declaration.durationMs === undefined
        ? 0
        : normalizeNonNegativeNumber(
            declaration.durationMs,
            "camera gesture reset durationMs",
          ),
  };
}

function normalizeGestureDrag(
  declaration: WebGLCameraGestureDragDeclaration | undefined,
  fallback: NormalizedCameraGestureDragDeclaration,
): NormalizedCameraGestureDragDeclaration {
  const button = declaration?.button ?? fallback.button;
  const modifier = declaration?.modifier ?? fallback.modifier;

  return {
    button: normalizeGestureButton(button),
    ...(modifier ? { modifier: normalizeGestureModifier(modifier) } : {}),
  };
}

function normalizeGestureButton(
  button: WebGLCameraGestureButton,
): WebGLCameraGestureButton {
  switch (button) {
    case "primary":
    case "middle":
    case "secondary":
      return button;
  }
}

function normalizeGestureModifier(
  modifier: WebGLCameraGestureModifier,
): WebGLCameraGestureModifier {
  switch (modifier) {
    case "shift":
    case "alt":
    case "ctrl":
    case "meta":
      return modifier;
  }
}

function assertMinMaxRange(
  min: number | undefined,
  max: number | undefined,
  message: string,
): void {
  if (min !== undefined && max !== undefined && min > max) {
    throw new Error(message);
  }
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

function normalizeTuple2(value: WebGLTuple2, label: string): WebGLTuple2 {
  if (!Number.isFinite(value[0]) || !Number.isFinite(value[1])) {
    throw new Error(`WebGL ${label} must contain finite numbers.`);
  }

  return [value[0], value[1]];
}

function normalizeFiniteNumber(value: number, label: string): number {
  if (!Number.isFinite(value)) {
    throw new Error(`WebGL ${label} must be finite.`);
  }

  return value;
}

function normalizePositiveNumber(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`WebGL ${label} must be a positive finite number.`);
  }

  return value;
}

function normalizeNonNegativeNumber(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`WebGL ${label} must be a non-negative finite number.`);
  }

  return value;
}

function normalizeUnitNumber(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0 || value > 1) {
    throw new Error(`WebGL ${label} must be a finite number between 0 and 1.`);
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
