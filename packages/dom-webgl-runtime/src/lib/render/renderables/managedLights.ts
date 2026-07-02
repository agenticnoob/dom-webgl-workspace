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

export function createManagedLightsFacade(options: {
  target?: InternalTargetWithObjects;
  resources: WebGLEffectResourceScope;
  readObjectPosition(): { x: number; y: number; z: number };
}): WebGLEffectLightsFacade | undefined {
  if (!options.target?.addObject3D) {
    return undefined;
  }

  const handlesByKey = new Map<string, WebGLEffectManagedObjectHandle>();

  options.resources.addDisposable(() => {
    for (const handle of handlesByKey.values()) {
      handle.dispose();
    }
    handlesByKey.clear();
  });

  return {
    ambient(key, request) {
      const light = new AmbientLight(
        readColor(request.color),
        readIntensity(request.intensity, 1),
      );
      return replaceLight(key, light);
    },
    directional(key, request) {
      const light = new DirectionalLight(
        readColor(request.color),
        readIntensity(request.intensity, 1),
      );
      applyPosition(
        light,
        request.position,
        options.readObjectPosition(),
        request.follow,
      );
      applyDirectionalTarget(light, request.target);
      return replaceLight(key, light);
    },
    point(key, request) {
      const light = new PointLight(
        readColor(request.color),
        readIntensity(request.intensity, 1),
        readPositive(request.distance, 0),
        readPositive(request.decay, 2),
      );
      applyPosition(
        light,
        request.position,
        options.readObjectPosition(),
        request.follow,
      );
      return replaceLight(key, light);
    },
    remove(key) {
      handlesByKey.get(key)?.dispose();
      handlesByKey.delete(key);
    },
  };

  function replaceLight(
    key: string,
    light: unknown,
  ): WebGLEffectManagedObjectHandle {
    handlesByKey.get(key)?.dispose();
    const handle = options.target?.addObject3D?.(light, {
      dispose(object3D) {
        disposeLightObject(object3D);
      },
    });

    if (!handle) {
      return createDisposedHandle();
    }
    handlesByKey.set(key, handle);
    return handle;
  }
}

function applyPosition(
  light: unknown,
  explicit: readonly [number, number, number] | undefined,
  objectPosition: { x: number; y: number; z: number },
  follow: "object" | "layout-center" | "none" | undefined,
): void {
  const position =
    explicit ??
    (follow === "object" || follow === "layout-center"
      ? ([objectPosition.x, objectPosition.y, objectPosition.z + 120] as const)
      : ([0, 0, 120] as const));
  const target = (
    light as { position?: { set?: (x: number, y: number, z: number) => void } }
  ).position;
  target?.set?.(position[0], position[1], position[2]);
}

function applyDirectionalTarget(
  light: unknown,
  targetPosition: readonly [number, number, number] | undefined,
): void {
  if (!targetPosition) {
    return;
  }

  const target = (
    light as {
      target?: {
        position?: { set?: (x: number, y: number, z: number) => void };
      };
    }
  ).target;
  target?.position?.set?.(targetPosition[0], targetPosition[1], targetPosition[2]);
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
