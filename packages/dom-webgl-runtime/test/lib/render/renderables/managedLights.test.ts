import { PointLight } from "three/src/lights/PointLight.js";
import { describe, expect, test, vi } from "vitest";

import type { WebGLEffectManagedObjectHandle } from "../../../../src/lib/effects/effectAuthoring";
import { createManagedLightsFacade } from "../../../../src/lib/render/renderables/managedLights";

describe("createManagedLightsFacade", () => {
  test("updates an existing point light when the same key is requested again", () => {
    const dispose = vi.fn();
    const handle = {
      dispose,
      remove: vi.fn(),
      setVisible: vi.fn(),
    } satisfies WebGLEffectManagedObjectHandle;
    let attachedLight: unknown;
    const target = {
      setVisible: vi.fn(),
      setPosition: vi.fn(),
      setRotation: vi.fn(),
      setScale: vi.fn(),
      setOpacity: vi.fn(),
      addObject3D: vi.fn((object3D: unknown) => {
        attachedLight = object3D;
        return handle;
      }),
    };
    const resources = {
      addDisposable: vi.fn(),
      createObject3D<TObject>(factory: () => TObject): TObject {
        return factory();
      },
      dispose: vi.fn(),
    };
    const facade = createManagedLightsFacade({
      target,
      resources,
      readObjectPosition: () => ({ x: 0, y: 0, z: 0 }),
    });

    facade?.point("model.glow", {
      color: "#7dd3fc",
      intensity: 0.5,
      distance: 120,
      position: [1, 2, 3],
    });
    facade?.point("model.glow", {
      color: "#f472b6",
      intensity: 3,
      distance: 420,
      position: [4, 5, 6],
    });

    expect(target.addObject3D).toHaveBeenCalledTimes(1);
    expect(dispose).not.toHaveBeenCalled();
    expect(attachedLight).toBeInstanceOf(PointLight);
    if (!(attachedLight instanceof PointLight)) {
      throw new Error("Expected managed point light.");
    }
    expect(attachedLight).toMatchObject({
      intensity: 3,
      distance: 420,
      decay: 2,
    });
    expect(attachedLight.color.getHexString()).toBe("f472b6");
    expect(attachedLight.position.toArray()).toEqual([4, 5, 6]);
  });
});
