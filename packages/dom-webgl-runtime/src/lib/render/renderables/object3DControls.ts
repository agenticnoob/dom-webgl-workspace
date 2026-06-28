type DefaultZ = number | "current" | "x";

type Object3DOpacityTarget =
  | { kind: "material"; material: unknown }
  | { kind: "object" };

export type Object3DControlsOptions = {
  positionZ?: DefaultZ;
  rotationZ?: DefaultZ;
  scaleZ?: DefaultZ;
  opacity?: Object3DOpacityTarget;
};

export function createObject3DControls(
  object3D: unknown,
  options: Object3DControlsOptions = {},
) {
  const positionZ = options.positionZ ?? 0;
  const rotationZ = options.rotationZ ?? 0;
  const scaleZ = options.scaleZ ?? "x";

  return {
    object3D,
    setVisible(visible: boolean) {
      if (object3D && typeof object3D === "object") {
        (object3D as { visible?: boolean }).visible = visible;
      }
    },
    setPosition(x: number, y: number, z?: number) {
      setVector3(
        (object3D as { position?: unknown } | undefined)?.position,
        x,
        y,
        resolveDefaultZ(
          (object3D as { position?: { z?: number } } | undefined)?.position,
          z,
          positionZ,
          x,
        ),
      );
    },
    setRotation(x: number, y: number, z?: number) {
      setVector3(
        (object3D as { rotation?: unknown } | undefined)?.rotation,
        x,
        y,
        resolveDefaultZ(
          (object3D as { rotation?: { z?: number } } | undefined)?.rotation,
          z,
          rotationZ,
          x,
        ),
      );
    },
    setScale(x: number, y = x, z?: number) {
      setVector3(
        (object3D as { scale?: unknown } | undefined)?.scale,
        x,
        y,
        resolveDefaultZ(
          (object3D as { scale?: { z?: number } } | undefined)?.scale,
          z,
          scaleZ,
          x,
        ),
      );
    },
    setOpacity(opacity: number) {
      const opacityTarget = options.opacity ?? { kind: "object" };
      if (opacityTarget.kind === "material") {
        setMaterialOpacity(opacityTarget.material, opacity);
        return;
      }

      setObject3DOpacity(object3D, opacity);
    },
  };
}

function resolveDefaultZ(
  vector: { z?: number } | undefined,
  explicitZ: number | undefined,
  defaultZ: DefaultZ,
  x: number,
): number {
  if (explicitZ !== undefined) {
    return explicitZ;
  }

  if (defaultZ === "current") {
    return vector?.z ?? 0;
  }

  if (defaultZ === "x") {
    return x;
  }

  return defaultZ;
}

function setVector3(vector: unknown, x: number, y: number, z: number): void {
  if (vector && typeof vector === "object" && "set" in vector) {
    (vector as { set: (x: number, y: number, z: number) => void }).set(x, y, z);
    return;
  }

  if (vector && typeof vector === "object") {
    Object.assign(vector, { x, y, z });
  }
}

function setObject3DOpacity(object3D: unknown, opacity: number): void {
  if (!object3D || typeof object3D !== "object") {
    return;
  }

  setMaterialOpacity((object3D as { material?: unknown }).material, opacity);

  const children = (object3D as { children?: unknown }).children;
  if (Array.isArray(children)) {
    for (const child of children) {
      setObject3DOpacity(child, opacity);
    }
  }
}

function setMaterialOpacity(material: unknown, opacity: number): void {
  const materials = Array.isArray(material) ? material : [material];

  for (const entry of materials) {
    if (entry && typeof entry === "object") {
      Object.assign(entry, {
        opacity,
        needsUpdate: true,
      });
      if (opacity < 1) {
        Object.assign(entry, { transparent: true });
      }
    }
  }
}
