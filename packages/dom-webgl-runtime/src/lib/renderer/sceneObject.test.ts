import { describe, expect, test, vi } from "vitest";

import type { WebGLRenderRole } from "../types";
import { compileRenderPolicy, toSceneObjectOrdering } from "../render/renderPolicy";
import {
  createSceneObjectController,
  type WebGLSceneAdapter,
  type WebGLSceneObject,
} from "./sceneObject";

describe("createSceneObjectController", () => {
  test("adds hides shows removes and renders an injected scene object idempotently", () => {
    const object = createSceneObject("hero.surface");
    const adapter = createSceneAdapter();
    const controller = createSceneObjectController(adapter, object);

    controller.attach();
    controller.attach();
    controller.setVisible(false);
    controller.setVisible(false);
    controller.setVisible(true);
    controller.render();
    controller.dispose();
    controller.dispose();

    expect(adapter.addObject).toHaveBeenCalledTimes(1);
    expect(adapter.addObject).toHaveBeenCalledWith(object);
    expect(object.setVisible).toHaveBeenNthCalledWith(1, false);
    expect(object.setVisible).toHaveBeenNthCalledWith(2, true);
    expect(adapter.render).toHaveBeenCalledTimes(1);
    expect(adapter.removeObject).toHaveBeenCalledTimes(1);
    expect(adapter.removeObject).toHaveBeenCalledWith(object);
    expect(object.dispose).toHaveBeenCalledTimes(1);
  });

  test("applies deterministic internal ordering before attaching objects", () => {
    const expectedByRole = {
      surface: {
        renderOrder: 0,
        transparent: false,
        depthWrite: false,
      },
      content: {
        renderOrder: 100,
        transparent: true,
        depthWrite: false,
      },
      media: {
        renderOrder: 200,
        transparent: true,
        depthWrite: false,
      },
      model: {
        renderOrder: 300,
        transparent: true,
        depthWrite: true,
      },
      overlay: {
        renderOrder: 400,
        transparent: true,
        depthWrite: false,
      },
    } satisfies Record<WebGLRenderRole, ReturnType<typeof toSceneObjectOrdering>>;

    for (const [role, expected] of Object.entries(expectedByRole)) {
      const object3D = {
        material: {},
      };
      const object = createSceneObject(`hero.${role}`, object3D);
      const adapter = createSceneAdapter();
      const controller = createSceneObjectController(
        adapter,
        object,
        toSceneObjectOrdering(compileRenderPolicy(role as WebGLRenderRole)),
      );

      controller.attach();

      expect(adapter.addObject).toHaveBeenCalledWith(object);
      expect(object.ordering).toEqual(expected);
      expect(object3D).toMatchObject({
        renderOrder: expected.renderOrder,
        material: {
          transparent: expected.transparent,
          depthWrite: expected.depthWrite,
        },
      });
    }
  });
});

function createSceneObject(key: string, object3D?: unknown): WebGLSceneObject {
  return {
    key,
    object3D,
    setVisible: vi.fn(),
    updateLayout: vi.fn(),
    dispose: vi.fn(),
  };
}

function createSceneAdapter(): WebGLSceneAdapter {
  return {
    addObject: vi.fn(),
    removeObject: vi.fn(),
    render: vi.fn(),
  };
}
