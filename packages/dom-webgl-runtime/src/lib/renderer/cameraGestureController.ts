import type {
  NormalizedCameraControllerFrameDeclaration,
  NormalizedCameraDollyGestureDeclaration,
  NormalizedCameraGestureDragDeclaration,
  NormalizedCameraOrbitGestureDeclaration,
  NormalizedCameraPanGestureDeclaration,
  NormalizedCameraPointerControllerDeclaration,
} from "./cameraControllerDeclarations";
import type {
  WebGLFrameInput,
  WebGLTuple3,
} from "../types";

export type CameraGestureName =
  | "orbit"
  | "pan"
  | "dolly"
  | "parallax"
  | "reset"
  | "damping";

export type CameraGestureDragName = "orbit" | "pan" | "dolly";

export type CameraGestureControllerState = {
  readonly targetFrame?: NormalizedCameraControllerFrameDeclaration;
  readonly appliedFrame?: NormalizedCameraControllerFrameDeclaration;
  readonly activeDrag?: {
    readonly gesture: CameraGestureDragName;
    readonly startFrame: NormalizedCameraControllerFrameDeclaration;
  };
  readonly lastClickCount: number;
  readonly lastClickTime?: number;
};

const DOUBLE_CLICK_RESET_MAX_INTERVAL_MS = 320;

export type CameraGestureUpdateInput = {
  readonly baseFrame: NormalizedCameraControllerFrameDeclaration;
  readonly state: CameraGestureControllerState;
  readonly pointer: NormalizedCameraPointerControllerDeclaration;
  readonly frameInput: WebGLFrameInput;
};

export type CameraGestureUpdateResult = {
  readonly frame: NormalizedCameraControllerFrameDeclaration;
  readonly state: CameraGestureControllerState;
  readonly changed: boolean;
  readonly requiresContinuousRendering: boolean;
  readonly activeGesture?: CameraGestureName;
};

export function createInitialCameraGestureState(
  initial: Partial<CameraGestureControllerState> = {},
): CameraGestureControllerState {
  return {
    ...initial,
    lastClickCount: initial.lastClickCount ?? 0,
  };
}

export function updateCameraGestureFrame(
  input: CameraGestureUpdateInput,
): CameraGestureUpdateResult {
  const pointerState = input.frameInput.pointer;
  const previousTargetFrame = input.state.targetFrame ?? input.baseFrame;
  let targetFrame = cloneFrame(previousTargetFrame);
  let gestureTargetFrame = cloneFrame(targetFrame);
  let activeGesture: CameraGestureName | undefined;
  let activeDrag: CameraGestureControllerState["activeDrag"];
  let lastClickCount = input.state.lastClickCount;
  let lastClickTime = input.state.lastClickTime;

  if (shouldReset(input.pointer, input.state, input.frameInput)) {
    targetFrame = cloneFrame(input.baseFrame);
    gestureTargetFrame = cloneFrame(targetFrame);
    activeGesture = "reset";
    lastClickCount = pointerState.clickCount;
    lastClickTime = pointerState.lastClickTime;
  } else {
    const dragGesture = readActiveDragGesture(input.pointer, input.frameInput);
    if (dragGesture) {
      const startFrame =
        input.state.activeDrag?.gesture === dragGesture
          ? input.state.activeDrag.startFrame
          : previousTargetFrame;
      targetFrame = applyDragGesture(
        dragGesture,
        startFrame,
        input.pointer,
        input.frameInput,
      );
      gestureTargetFrame = cloneFrame(targetFrame);
      activeDrag = { gesture: dragGesture, startFrame };
      activeGesture = dragGesture;
    } else if (input.pointer.parallax && pointerState.isInside) {
      gestureTargetFrame = applyParallax(
        targetFrame,
        input.pointer,
        input.frameInput,
      );
      activeGesture = "parallax";
    }
  }

  if (pointerState.clickCount > lastClickCount) {
    lastClickCount = pointerState.clickCount;
    lastClickTime = pointerState.lastClickTime;
  }

  const damping = input.pointer.damping;
  let frame = gestureTargetFrame;
  let dampingSettling = false;
  if (damping) {
    const previousApplied = input.state.appliedFrame ?? gestureTargetFrame;
    frame = interpolateFrame(previousApplied, gestureTargetFrame, damping.factor);
    dampingSettling = !framesWithinEpsilon(
      frame,
      gestureTargetFrame,
      damping.settleEpsilon,
    );
    if (!activeGesture && dampingSettling) {
      activeGesture = "damping";
    }
  }

  const nextState = createInitialCameraGestureState({
    targetFrame,
    appliedFrame: frame,
    ...(activeDrag ? { activeDrag } : {}),
    lastClickCount,
    ...(lastClickTime !== undefined ? { lastClickTime } : {}),
  });

  return {
    frame,
    state: nextState,
    changed: !cameraGestureFramesEqual(input.state.appliedFrame, frame),
    requiresContinuousRendering:
      activeDrag !== undefined || dampingSettling || activeGesture === "reset",
    ...(activeGesture ? { activeGesture } : {}),
  };
}

export function cameraGestureFramesEqual(
  left: NormalizedCameraControllerFrameDeclaration | undefined,
  right: NormalizedCameraControllerFrameDeclaration | undefined,
): boolean {
  if (left === undefined || right === undefined) {
    return left === right;
  }

  return (
    tuple3Equal(left.position, right.position) &&
    tuple3Equal(left.target, right.target) &&
    left.fov === right.fov
  );
}

function shouldReset(
  pointer: NormalizedCameraPointerControllerDeclaration,
  state: CameraGestureControllerState,
  input: WebGLFrameInput,
): boolean {
  const pointerState = input.pointer;
  if (
    !pointer.reset?.onDoubleClick ||
    !pointerState.isInside ||
    pointerState.lastClickTime === undefined ||
    state.lastClickTime === undefined ||
    pointerState.clickCount !== state.lastClickCount + 1 ||
    hasPointerDrag(pointerState)
  ) {
    return false;
  }

  return Boolean(
    pointerState.lastClickTime - state.lastClickTime <=
      DOUBLE_CLICK_RESET_MAX_INTERVAL_MS,
  );
}

function readActiveDragGesture(
  pointer: NormalizedCameraPointerControllerDeclaration,
  input: WebGLFrameInput,
): CameraGestureDragName | undefined {
  if (!input.pointer.isDown || !input.pointer.isDragging) {
    return undefined;
  }

  if (pointer.dolly && dragMatches(pointer.dolly.drag, input)) {
    return "dolly";
  }
  if (pointer.pan && dragMatches(pointer.pan.drag, input)) {
    return "pan";
  }
  if (pointer.orbit && dragMatches(pointer.orbit.drag, input)) {
    return "orbit";
  }

  return undefined;
}

function dragMatches(
  drag: NormalizedCameraGestureDragDeclaration,
  input: WebGLFrameInput,
): boolean {
  if (input.pointer.button !== drag.button) {
    return false;
  }
  if (drag.modifier) {
    return input.pointer.modifiers[drag.modifier];
  }

  return noModifiersActive(input.pointer.modifiers);
}

function noModifiersActive(
  modifiers: WebGLFrameInput["pointer"]["modifiers"],
): boolean {
  return !modifiers.alt && !modifiers.shift && !modifiers.ctrl && !modifiers.meta;
}

function hasPointerDrag(pointer: WebGLFrameInput["pointer"]): boolean {
  return pointer.isDragging || pointer.dragDeltaX !== 0 || pointer.dragDeltaY !== 0;
}

function applyDragGesture(
  gesture: CameraGestureDragName,
  startFrame: NormalizedCameraControllerFrameDeclaration,
  pointer: NormalizedCameraPointerControllerDeclaration,
  input: WebGLFrameInput,
): NormalizedCameraControllerFrameDeclaration {
  switch (gesture) {
    case "orbit":
      return applyOrbit(startFrame, readRequiredOrbit(pointer), input);
    case "pan":
      return applyPan(startFrame, readRequiredPan(pointer), input);
    case "dolly":
      return applyDolly(startFrame, readRequiredDolly(pointer), input);
  }
}

function readRequiredOrbit(
  pointer: NormalizedCameraPointerControllerDeclaration,
): NormalizedCameraOrbitGestureDeclaration {
  if (!pointer.orbit) {
    throw new Error("Expected normalized camera orbit gesture.");
  }

  return pointer.orbit;
}

function readRequiredPan(
  pointer: NormalizedCameraPointerControllerDeclaration,
): NormalizedCameraPanGestureDeclaration {
  if (!pointer.pan) {
    throw new Error("Expected normalized camera pan gesture.");
  }

  return pointer.pan;
}

function readRequiredDolly(
  pointer: NormalizedCameraPointerControllerDeclaration,
): NormalizedCameraDollyGestureDeclaration {
  if (!pointer.dolly) {
    throw new Error("Expected normalized camera dolly gesture.");
  }

  return pointer.dolly;
}

function applyOrbit(
  base: NormalizedCameraControllerFrameDeclaration,
  orbit: NormalizedCameraOrbitGestureDeclaration,
  input: WebGLFrameInput,
): NormalizedCameraControllerFrameDeclaration {
  const target = orbit.target;
  const basePosition = base.position ?? [0, 0, 500];
  const offset = subtractTuple3(basePosition, target);
  const radius = clampDistance(
    Math.max(0.0001, length(offset)),
    orbit.minDistance,
    orbit.maxDistance,
  );
  const baseYaw = Math.atan2(offset[0], offset[2]);
  const basePolar = Math.acos(clamp(offset[1] / Math.max(0.0001, length(offset)), -1, 1));
  const yaw = baseYaw - input.pointer.dragDeltaX * orbit.sensitivity[0];
  const polar = clamp(
    basePolar + input.pointer.dragDeltaY * orbit.sensitivity[1],
    orbit.minPolarAngle ?? 0.001,
    orbit.maxPolarAngle ?? Math.PI - 0.001,
  );
  const sinPolar = Math.sin(polar);
  const nextOffset: WebGLTuple3 = [
    Math.sin(yaw) * sinPolar * radius,
    Math.cos(polar) * radius,
    Math.cos(yaw) * sinPolar * radius,
  ];

  return {
    position: addTuple3(target, nextOffset),
    target,
    ...(base.fov !== undefined ? { fov: base.fov } : {}),
  };
}

function applyPan(
  base: NormalizedCameraControllerFrameDeclaration,
  pan: NormalizedCameraPanGestureDeclaration,
  input: WebGLFrameInput,
): NormalizedCameraControllerFrameDeclaration {
  const position = base.position ?? [0, 0, 500];
  const target = base.target ?? [0, 0, 0];
  const basis = createCameraPlaneBasis(position, target);
  const rightOffset = scaleTuple3(
    basis.right,
    -input.pointer.dragDeltaX * pan.sensitivity[0],
  );
  const upOffset = scaleTuple3(
    basis.up,
    input.pointer.dragDeltaY * pan.sensitivity[1],
  );
  const offset = addTuple3(rightOffset, upOffset);

  return {
    position: addTuple3(position, offset),
    target: addTuple3(target, offset),
    ...(base.fov !== undefined ? { fov: base.fov } : {}),
  };
}

function applyDolly(
  base: NormalizedCameraControllerFrameDeclaration,
  dolly: NormalizedCameraDollyGestureDeclaration,
  input: WebGLFrameInput,
): NormalizedCameraControllerFrameDeclaration {
  const position = base.position ?? [0, 0, 500];
  const target = base.target ?? [0, 0, 0];
  const offset = subtractTuple3(position, target);
  const distance = Math.max(0.0001, length(offset));
  const nextDistance = clampDistance(
    distance + input.pointer.dragDeltaY * dolly.sensitivity,
    dolly.minDistance,
    dolly.maxDistance,
  );
  const direction = normalizeTuple3(offset, [0, 0, 1]);

  return {
    position: addTuple3(target, scaleTuple3(direction, nextDistance)),
    target,
    ...(base.fov !== undefined ? { fov: base.fov } : {}),
  };
}

function applyParallax(
  base: NormalizedCameraControllerFrameDeclaration,
  pointer: NormalizedCameraPointerControllerDeclaration,
  input: WebGLFrameInput,
): NormalizedCameraControllerFrameDeclaration {
  const parallax = pointer.parallax;
  if (!parallax) {
    return base;
  }

  const position = base.position ?? [0, 0, 500];
  const offset: WebGLTuple3 = [
    clamp(
      input.pointer.normalizedX * parallax.strength[0],
      -parallax.maxOffset[0],
      parallax.maxOffset[0],
    ),
    clamp(
      input.pointer.normalizedY * parallax.strength[1],
      -parallax.maxOffset[1],
      parallax.maxOffset[1],
    ),
    0,
  ];

  return {
    position: addTuple3(position, offset),
    ...(base.target ? { target: base.target } : {}),
    ...(base.fov !== undefined ? { fov: base.fov } : {}),
  };
}

function createCameraPlaneBasis(
  position: WebGLTuple3,
  target: WebGLTuple3,
): { readonly right: WebGLTuple3; readonly up: WebGLTuple3 } {
  const forward = normalizeTuple3(subtractTuple3(target, position), [0, 0, -1]);
  const worldUp: WebGLTuple3 = [0, 1, 0];
  const right = normalizeTuple3(crossTuple3(forward, worldUp), [1, 0, 0]);
  const up = normalizeTuple3(crossTuple3(right, forward), [0, 1, 0]);

  return { right, up };
}

function interpolateFrame(
  from: NormalizedCameraControllerFrameDeclaration,
  to: NormalizedCameraControllerFrameDeclaration,
  factor: number,
): NormalizedCameraControllerFrameDeclaration {
  return {
    ...(to.position
      ? { position: interpolateTuple3(from.position ?? to.position, to.position, factor) }
      : {}),
    ...(to.target
      ? { target: interpolateTuple3(from.target ?? to.target, to.target, factor) }
      : {}),
    ...(to.fov !== undefined
      ? { fov: interpolateNumber(from.fov ?? to.fov, to.fov, factor) }
      : {}),
  };
}

function framesWithinEpsilon(
  left: NormalizedCameraControllerFrameDeclaration,
  right: NormalizedCameraControllerFrameDeclaration,
  epsilon: number,
): boolean {
  return (
    tuple3WithinEpsilon(left.position, right.position, epsilon) &&
    tuple3WithinEpsilon(left.target, right.target, epsilon) &&
    numberWithinEpsilon(left.fov, right.fov, epsilon)
  );
}

function cloneFrame(
  frame: NormalizedCameraControllerFrameDeclaration,
): NormalizedCameraControllerFrameDeclaration {
  return {
    ...(frame.position ? { position: cloneTuple3(frame.position) } : {}),
    ...(frame.target ? { target: cloneTuple3(frame.target) } : {}),
    ...(frame.fov !== undefined ? { fov: frame.fov } : {}),
  };
}

function cloneTuple3(value: WebGLTuple3): WebGLTuple3 {
  return [value[0], value[1], value[2]];
}

function addTuple3(left: WebGLTuple3, right: WebGLTuple3): WebGLTuple3 {
  return [left[0] + right[0], left[1] + right[1], left[2] + right[2]];
}

function subtractTuple3(left: WebGLTuple3, right: WebGLTuple3): WebGLTuple3 {
  return [left[0] - right[0], left[1] - right[1], left[2] - right[2]];
}

function scaleTuple3(value: WebGLTuple3, scale: number): WebGLTuple3 {
  return [value[0] * scale, value[1] * scale, value[2] * scale];
}

function crossTuple3(left: WebGLTuple3, right: WebGLTuple3): WebGLTuple3 {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0],
  ];
}

function normalizeTuple3(value: WebGLTuple3, fallback: WebGLTuple3): WebGLTuple3 {
  const tupleLength = length(value);
  if (tupleLength <= 0.0001) {
    return fallback;
  }

  return scaleTuple3(value, 1 / tupleLength);
}

function length(value: WebGLTuple3): number {
  return Math.hypot(value[0], value[1], value[2]);
}

function clampDistance(
  value: number,
  min: number | undefined,
  max: number | undefined,
): number {
  return clamp(value, min ?? 0.0001, max ?? Number.POSITIVE_INFINITY);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function interpolateTuple3(
  from: WebGLTuple3,
  to: WebGLTuple3,
  factor: number,
): WebGLTuple3 {
  return [
    interpolateNumber(from[0], to[0], factor),
    interpolateNumber(from[1], to[1], factor),
    interpolateNumber(from[2], to[2], factor),
  ];
}

function interpolateNumber(from: number, to: number, factor: number): number {
  return from + (to - from) * factor;
}

function tuple3Equal(
  left: WebGLTuple3 | undefined,
  right: WebGLTuple3 | undefined,
): boolean {
  if (left === undefined || right === undefined) {
    return left === right;
  }

  return left[0] === right[0] && left[1] === right[1] && left[2] === right[2];
}

function tuple3WithinEpsilon(
  left: WebGLTuple3 | undefined,
  right: WebGLTuple3 | undefined,
  epsilon: number,
): boolean {
  if (left === undefined || right === undefined) {
    return left === right;
  }

  return (
    Math.abs(left[0] - right[0]) <= epsilon &&
    Math.abs(left[1] - right[1]) <= epsilon &&
    Math.abs(left[2] - right[2]) <= epsilon
  );
}

function numberWithinEpsilon(
  left: number | undefined,
  right: number | undefined,
  epsilon: number,
): boolean {
  if (left === undefined || right === undefined) {
    return left === right;
  }

  return Math.abs(left - right) <= epsilon;
}
