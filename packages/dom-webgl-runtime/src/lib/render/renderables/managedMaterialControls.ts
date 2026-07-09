import type { WebGLEffectColorValue } from "../../effects/effectColor";
import type {
  WebGLEffectMaterialFacade,
  WebGLEffectMaterialLayerOptions,
} from "../../effects/effectMaterial";
import type {
  WebGLEffectMaterialLayerHandle,
  WebGLEffectMaterialLayerHost,
} from "../../effects/effectAuthoring";

type MaterialMutationTarget = {
  readonly material: unknown;
  readonly layerHost?: WebGLEffectMaterialLayerHost;
  restoreMaterial?(): void;
};

export function createManagedMaterialFacade(
  target: MaterialMutationTarget,
): WebGLEffectMaterialFacade {
  const activeLayers: WebGLEffectMaterialLayerHandle[] = [];

  return {
    color: createColorFacade(target, "color"),
    emissive: createEmissiveFacade(target),
    get opacity() {
      return readNumberMaterialProperty(target.material, "opacity", 1);
    },
    set opacity(value) {
      setMaterialProperty(target.material, "opacity", clampNumber(value, 0, 1, 1));
      if (value < 1) {
        setMaterialProperty(target.material, "transparent", true);
      }
    },
    get metalness() {
      return readNumberMaterialProperty(target.material, "metalness", 0);
    },
    set metalness(value) {
      setMaterialProperty(
        target.material,
        "metalness",
        clampNumber(value, 0, 1, 0),
      );
    },
    get roughness() {
      return readNumberMaterialProperty(target.material, "roughness", 1);
    },
    set roughness(value) {
      setMaterialProperty(
        target.material,
        "roughness",
        clampNumber(value, 0, 1, 1),
      );
    },
    createLayer(options) {
      if (!target.layerHost) {
        throw new Error("This WebGL object does not expose a material layer host.");
      }

      const layer = target.layerHost.createMaterialLayer(
        options satisfies WebGLEffectMaterialLayerOptions,
      );
      activeLayers.push(layer);
      return layer;
    },
    restore() {
      for (const layer of activeLayers.splice(0)) {
        layer.dispose();
      }
      target.restoreMaterial?.();
    },
  };
}

function createColorFacade(target: MaterialMutationTarget, key: string) {
  return {
    get value() {
      return readColorValue(target.material, key);
    },
    set(value: WebGLEffectColorValue) {
      setColorValue(target.material, key, value);
    },
  };
}

function createEmissiveFacade(target: MaterialMutationTarget) {
  return {
    get value() {
      return readColorValue(target.material, "emissive");
    },
    get intensity() {
      return readNumberMaterialProperty(
        target.material,
        "emissiveIntensity",
        1,
      );
    },
    set(value: WebGLEffectColorValue, intensity?: number) {
      setColorValue(target.material, "emissive", value);
      if (intensity !== undefined) {
        setMaterialProperty(
          target.material,
          "emissiveIntensity",
          Math.max(0, intensity),
        );
      }
    },
  };
}

function readColorValue(material: unknown, key: string): string {
  const color = readMaterialProperty(readFirstMaterial(material), key);
  if (color && typeof color === "object" && "getHexString" in color) {
    const getHexString = (color as { getHexString?: unknown }).getHexString;
    if (typeof getHexString === "function") {
      return `#${getHexString.call(color)}`;
    }
  }
  return "#ffffff";
}

function setColorValue(
  material: unknown,
  key: string,
  value: WebGLEffectColorValue,
): void {
  forEachMaterial(material, (entry) => {
    const color = readMaterialProperty(entry, key);
    if (color && typeof color === "object" && "set" in color) {
      const set = (color as { set?: unknown }).set;
      if (typeof set === "function") {
        set.call(color, value);
        setMaterialProperty(entry, "needsUpdate", true);
      }
    }
  });
}

function readMaterialProperty(material: unknown, key: string): unknown {
  if (!material || typeof material !== "object") {
    return undefined;
  }
  return (material as Record<string, unknown>)[key];
}

function readNumberMaterialProperty(
  material: unknown,
  key: string,
  fallback: number,
): number {
  const value = readMaterialProperty(readFirstMaterial(material), key);
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function setMaterialProperty(material: unknown, key: string, value: unknown): void {
  forEachMaterial(material, (entry) => {
    Object.assign(entry, { [key]: value, needsUpdate: true });
  });
}

function forEachMaterial(material: unknown, visitor: (material: object) => void): void {
  const entries = Array.isArray(material) ? material : [material];
  for (const entry of entries) {
    if (entry && typeof entry === "object") {
      visitor(entry);
    }
  }
}

function readFirstMaterial(material: unknown): unknown {
  return Array.isArray(material) ? material[0] : material;
}

function clampNumber(
  value: number,
  min: number,
  max: number,
  fallback: number,
): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, value));
}
