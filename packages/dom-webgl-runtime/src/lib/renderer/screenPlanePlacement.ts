import type {
  WebGLCameraMode,
  WebGLCameraType,
  WebGLSceneProjection,
  WebGLTuple2,
  WebGLTuple3,
} from "../types";

export type ScreenPlanePlacementPlane = {
  readonly id: string;
  readonly sceneId: string;
  readonly position: WebGLTuple3;
  readonly rotation: WebGLTuple3;
  readonly scale: number | WebGLTuple3;
  readonly size: WebGLTuple2;
};

export type ScreenPlanePlacementDeclaration = {
  readonly mode: "screen-plane";
  readonly planeId: string;
  readonly offset: WebGLTuple3;
  readonly scale: number | WebGLTuple2;
};

export type ScreenPlanePlacementCamera = {
  readonly type: WebGLCameraType;
  readonly mode: WebGLCameraMode;
  readonly fov?: number;
  readonly position?: WebGLTuple3;
  readonly target?: WebGLTuple3;
};

export type ScreenPlanePlacementDiagnostic = {
  readonly kind:
    | "screen-plane-missing-plane"
    | "screen-plane-unsupported-scene"
    | "screen-plane-no-intersection";
  readonly planeId: string;
};

export type ScreenPlaneProjectedLayout = {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly width: number;
  readonly height: number;
  readonly rotation?: WebGLTuple3;
  readonly scale?: number | WebGLTuple3;
  readonly placementDiagnostic?: ScreenPlanePlacementDiagnostic;
};

export type ScreenPlanePlacementInput = {
  readonly sceneProjection: WebGLSceneProjection;
  readonly camera: ScreenPlanePlacementCamera;
  readonly placement: ScreenPlanePlacementDeclaration;
  readonly plane?: ScreenPlanePlacementPlane;
  readonly measurement: Pick<DOMRectReadOnly, "left" | "top" | "width" | "height">;
  readonly viewport: { readonly width: number; readonly height: number };
};

type CameraBasis = {
  readonly position: WebGLTuple3;
  readonly forward: WebGLTuple3;
  readonly right: WebGLTuple3;
  readonly up: WebGLTuple3;
};

const defaultCameraPosition = [0, 0, 500] satisfies WebGLTuple3;
const defaultCameraForward = [0, 0, -1] satisfies WebGLTuple3;
const defaultCameraRight = [1, 0, 0] satisfies WebGLTuple3;
const defaultCameraUp = [0, 1, 0] satisfies WebGLTuple3;

export function projectScreenPlaneLayout(
  input: ScreenPlanePlacementInput,
): ScreenPlaneProjectedLayout {
  if (input.sceneProjection !== "perspective-stage") {
    return createDiagnosticLayout(
      input.placement.planeId,
      "screen-plane-unsupported-scene",
    );
  }

  if (!input.plane) {
    return createDiagnosticLayout(
      input.placement.planeId,
      "screen-plane-missing-plane",
    );
  }

  const basis = readCameraBasis(input.camera);
  const ray = readScreenRay(input, basis);
  const planeBasis = readPlaneBasis(input.plane);
  const denominator = dotVector(ray.direction, planeBasis.normal);

  if (Math.abs(denominator) <= 0.000001) {
    return createDiagnosticLayout(
      input.placement.planeId,
      "screen-plane-no-intersection",
    );
  }

  const distance =
    dotVector(
      subtractVector(input.plane.position, basis.position),
      planeBasis.normal,
    ) / denominator;

  if (distance < 0) {
    return createDiagnosticLayout(
      input.placement.planeId,
      "screen-plane-no-intersection",
    );
  }

  const hit = addVector(basis.position, scaleVector(ray.direction, distance));
  const offset = input.placement.offset;
  const position = addVector(
    addVector(
      addVector(hit, scaleVector(planeBasis.right, offset[0])),
      scaleVector(planeBasis.up, offset[1]),
    ),
    scaleVector(planeBasis.normal, offset[2]),
  );
  const projectedScale = normalizePlacementScale(input.placement.scale);
  const unitsPerPixel =
    (2 * distance * Math.tan(((input.camera.fov ?? 50) * Math.PI) / 360)) /
    input.viewport.height;

  return {
    x: position[0],
    y: position[1],
    z: position[2],
    width: input.measurement.width * unitsPerPixel * projectedScale[0],
    height: input.measurement.height * unitsPerPixel * projectedScale[1],
    rotation: input.plane.rotation,
  };
}

function createDiagnosticLayout(
  planeId: string,
  kind: ScreenPlanePlacementDiagnostic["kind"],
): ScreenPlaneProjectedLayout {
  return {
    x: 0,
    y: 0,
    z: 0,
    width: 0,
    height: 0,
    placementDiagnostic: { kind, planeId },
  };
}

function readCameraBasis(camera: ScreenPlanePlacementCamera): CameraBasis {
  const position = camera.position ?? defaultCameraPosition;
  const forward = camera.target
    ? normalizeVector(
        subtractVector(camera.target, position),
        defaultCameraForward,
      )
    : defaultCameraForward;
  const right = normalizeVector(
    crossVector(forward, defaultCameraUp),
    defaultCameraRight,
  );
  const up = normalizeVector(crossVector(right, forward), defaultCameraUp);

  return { position, forward, right, up };
}

function readScreenRay(
  input: ScreenPlanePlacementInput,
  basis: CameraBasis,
): { readonly direction: WebGLTuple3 } {
  const centerX = input.measurement.left + input.measurement.width / 2;
  const centerY = input.measurement.top + input.measurement.height / 2;
  const fov = input.camera.fov ?? 50;
  const viewport = input.viewport;
  const tangent = Math.tan((fov * Math.PI) / 360);
  const aspect = viewport.width / viewport.height;
  const offsetX = ((centerX / viewport.width) * 2 - 1) * tangent * aspect;
  const offsetY = (1 - (centerY / viewport.height) * 2) * tangent;

  return {
    direction: normalizeVector(
      addVector(
        addVector(basis.forward, scaleVector(basis.right, offsetX)),
        scaleVector(basis.up, offsetY),
      ),
      basis.forward,
    ),
  };
}

function readPlaneBasis(plane: ScreenPlanePlacementPlane): {
  readonly right: WebGLTuple3;
  readonly up: WebGLTuple3;
  readonly normal: WebGLTuple3;
} {
  return {
    right: normalizeVector(rotateVector([1, 0, 0], plane.rotation), [1, 0, 0]),
    up: normalizeVector(rotateVector([0, 1, 0], plane.rotation), [0, 1, 0]),
    normal: normalizeVector(
      rotateVector([0, 0, 1], plane.rotation),
      [0, 0, 1],
    ),
  };
}

function rotateVector(vector: WebGLTuple3, rotation: WebGLTuple3): WebGLTuple3 {
  const [x1, y1, z1] = rotateX(vector, rotation[0]);
  const [x2, y2, z2] = rotateY([x1, y1, z1], rotation[1]);
  return rotateZ([x2, y2, z2], rotation[2]);
}

function rotateX(vector: WebGLTuple3, angle: number): WebGLTuple3 {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [
    vector[0],
    vector[1] * cos - vector[2] * sin,
    vector[1] * sin + vector[2] * cos,
  ];
}

function rotateY(vector: WebGLTuple3, angle: number): WebGLTuple3 {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [
    vector[0] * cos + vector[2] * sin,
    vector[1],
    -vector[0] * sin + vector[2] * cos,
  ];
}

function rotateZ(vector: WebGLTuple3, angle: number): WebGLTuple3 {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [
    vector[0] * cos - vector[1] * sin,
    vector[0] * sin + vector[1] * cos,
    vector[2],
  ];
}

function normalizePlacementScale(
  scale: number | WebGLTuple2,
): WebGLTuple2 {
  if (typeof scale === "number") {
    return [scale, scale];
  }

  return scale;
}

function subtractVector(left: WebGLTuple3, right: WebGLTuple3): WebGLTuple3 {
  return [left[0] - right[0], left[1] - right[1], left[2] - right[2]];
}

function addVector(left: WebGLTuple3, right: WebGLTuple3): WebGLTuple3 {
  return [left[0] + right[0], left[1] + right[1], left[2] + right[2]];
}

function scaleVector(vector: WebGLTuple3, scale: number): WebGLTuple3 {
  return [vector[0] * scale, vector[1] * scale, vector[2] * scale];
}

function dotVector(left: WebGLTuple3, right: WebGLTuple3): number {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

function crossVector(left: WebGLTuple3, right: WebGLTuple3): WebGLTuple3 {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0],
  ];
}

function normalizeVector(
  vector: WebGLTuple3,
  fallback: WebGLTuple3,
): WebGLTuple3 {
  const length = Math.hypot(vector[0], vector[1], vector[2]);
  if (length <= 0.000001) {
    return fallback;
  }

  return [vector[0] / length, vector[1] / length, vector[2] / length];
}
