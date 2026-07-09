import { AmbientLight } from "three/src/lights/AmbientLight.js";
import { DirectionalLight } from "three/src/lights/DirectionalLight.js";
import { PointLight } from "three/src/lights/PointLight.js";

import type {
  WebGLEffectAmbientLightRequest,
  WebGLEffectDirectionalLightRequest,
  WebGLEffectLightsFacade,
  WebGLEffectPointLightRequest,
} from "../../effects/effectLights";
import type {
  WebGLEffectManagedObjectHandle,
  WebGLEffectResourceScope,
  WebGLEffectTargetHandle,
} from "../../effects/effectAuthoring";

type InternalTargetWithObjects = WebGLEffectTargetHandle & {
  addObject3D?(
    object3D: unknown,
    options?: { dispose?: (object3D: unknown) => void },
  ): WebGLEffectManagedObjectHandle;
};

type ManagedLightEntry =
  | {
      kind: "ambient";
      light: AmbientLight;
      handle: WebGLEffectManagedObjectHandle;
    }
  | {
      kind: "directional";
      light: DirectionalLight;
      handle: WebGLEffectManagedObjectHandle;
    }
  | {
      kind: "point";
      light: PointLight;
      handle: WebGLEffectManagedObjectHandle;
    };

type ManagedLightDraft =
  | {
      kind: "ambient";
      light: AmbientLight;
    }
  | {
      kind: "directional";
      light: DirectionalLight;
    }
  | {
      kind: "point";
      light: PointLight;
    };

export function createManagedLightsFacade(options: {
  target?: InternalTargetWithObjects;
  resources: WebGLEffectResourceScope;
  readObjectPosition(): { x: number; y: number; z: number };
}): WebGLEffectLightsFacade | undefined {
  const addObject3D = options.target?.addObject3D;

  if (!addObject3D) {
    return undefined;
  }

  const attachObject3D: NonNullable<InternalTargetWithObjects["addObject3D"]> =
    addObject3D;
  const entriesByKey = new Map<string, ManagedLightEntry>();

  options.resources.addDisposable(() => {
    for (const entry of entriesByKey.values()) {
      entry.handle.dispose();
    }
    entriesByKey.clear();
  });

  return {
    ambient(key, request) {
      const existing = entriesByKey.get(key);

      if (existing?.kind === "ambient") {
        applyAmbientRequest(existing.light, request);
        return existing.handle;
      }

      const light = new AmbientLight();
      applyAmbientRequest(light, request);
      return replaceLight(key, { kind: "ambient", light });
    },
    directional(key, request) {
      const existing = entriesByKey.get(key);

      if (existing?.kind === "directional") {
        applyDirectionalRequest(existing.light, request);
        return existing.handle;
      }

      const light = new DirectionalLight();
      applyDirectionalRequest(light, request);
      return replaceLight(key, { kind: "directional", light });
    },
    point(key, request) {
      const existing = entriesByKey.get(key);

      if (existing?.kind === "point") {
        applyPointRequest(existing.light, request);
        return existing.handle;
      }

      const light = new PointLight();
      applyPointRequest(light, request);
      return replaceLight(key, { kind: "point", light });
    },
    remove(key) {
      entriesByKey.get(key)?.handle.dispose();
      entriesByKey.delete(key);
    },
  };

  function applyDirectionalRequest(
    light: DirectionalLight,
    request: WebGLEffectDirectionalLightRequest,
  ): void {
    light.color.set(readColor(request.color));
    light.intensity = readIntensity(request.intensity, 1);
    applyPosition(
      light,
      request.position,
      options.readObjectPosition(),
      request.follow,
    );
    applyDirectionalTarget(light, request.target);
  }

  function applyPointRequest(
    light: PointLight,
    request: WebGLEffectPointLightRequest,
  ): void {
    light.color.set(readColor(request.color));
    light.intensity = readIntensity(request.intensity, 1);
    light.distance = readPositive(request.distance, 0);
    light.decay = readPositive(request.decay, 2);
    applyPosition(
      light,
      request.position,
      options.readObjectPosition(),
      request.follow,
    );
  }

  function replaceLight(
    key: string,
    entry: ManagedLightDraft,
  ): WebGLEffectManagedObjectHandle {
    entriesByKey.get(key)?.handle.dispose();
    const handle = attachObject3D(entry.light, {
      dispose(object3D) {
        disposeLightObject(object3D);
      },
    });

    if (!handle) {
      return createDisposedHandle();
    }
    entriesByKey.set(key, createManagedLightEntry(entry, handle));
    return handle;
  }
}

function createManagedLightEntry(
  entry: ManagedLightDraft,
  handle: WebGLEffectManagedObjectHandle,
): ManagedLightEntry {
  switch (entry.kind) {
    case "ambient":
      return { kind: "ambient", light: entry.light, handle };
    case "directional":
      return { kind: "directional", light: entry.light, handle };
    case "point":
      return { kind: "point", light: entry.light, handle };
  }
}

function applyAmbientRequest(
  light: AmbientLight,
  request: WebGLEffectAmbientLightRequest,
): void {
  light.color.set(readColor(request.color));
  light.intensity = readIntensity(request.intensity, 1);
}

function applyPosition(
  light: DirectionalLight | PointLight,
  explicit: readonly [number, number, number] | undefined,
  objectPosition: { x: number; y: number; z: number },
  follow: "object" | "layout-center" | "none" | undefined,
): void {
  const position =
    explicit ??
    (follow === "object" || follow === "layout-center"
      ? ([objectPosition.x, objectPosition.y, objectPosition.z + 120] as const)
      : ([0, 0, 120] as const));
  light.position.set(position[0], position[1], position[2]);
}

function applyDirectionalTarget(
  light: DirectionalLight,
  targetPosition: readonly [number, number, number] | undefined,
): void {
  if (!targetPosition) {
    return;
  }

  light.target.position.set(targetPosition[0], targetPosition[1], targetPosition[2]);
}

function readColor(value: unknown): string | number {
  if (typeof value === "string" || typeof value === "number") {
    return value;
  }
  if (Array.isArray(value) && value.length === 3) {
    return colorTupleToHex(value);
  }
  return 0xffffff;
}

function readIntensity(value: number | undefined, fallback: number): number {
  return readPositive(value, fallback);
}

function readPositive(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, value)
    : fallback;
}

function colorTupleToHex(value: readonly unknown[]): number {
  const [r, g, b] = value.map((entry) =>
    typeof entry === "number" && Number.isFinite(entry)
      ? Math.round(Math.min(1, Math.max(0, entry)) * 255)
      : 255,
  );
  return ((r ?? 255) << 16) + ((g ?? 255) << 8) + (b ?? 255);
}

function disposeLightObject(object3D: unknown): void {
  if (!object3D || typeof object3D !== "object" || !("dispose" in object3D)) {
    return;
  }

  const dispose = (object3D as { dispose?: unknown }).dispose;
  if (typeof dispose === "function") {
    dispose.call(object3D);
  }
}

function createDisposedHandle(): WebGLEffectManagedObjectHandle {
  return {
    setVisible() {},
    remove() {},
    dispose() {},
  };
}
