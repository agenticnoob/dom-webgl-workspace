import { describe, expect, test, vi } from "vitest";

import type { WebGLRenderRole } from "../types";
import { compileRenderPolicy, toSceneObjectOrdering } from "../render/renderPolicy";
import {
  applySceneObjectOrdering,
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
        transparent: true,
        depthWrite: false,
        depthTest: false,
      },
      content: {
        renderOrder: 100,
        transparent: true,
        depthWrite: false,
        depthTest: false,
      },
      media: {
        renderOrder: 200,
        transparent: true,
        depthWrite: false,
        depthTest: false,
      },
      model: {
        renderOrder: 300,
        transparent: true,
        depthWrite: true,
        depthTest: true,
      },
      overlay: {
        renderOrder: 400,
        transparent: true,
        depthWrite: false,
        depthTest: false,
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
          depthTest: expected.depthTest,
        },
      });
    }
  });

  test("applies ordering to object3D descendants", () => {
    const childMaterial = {};
    const object = {
      key: "layer",
      object3D: {
        renderOrder: 0,
        children: [
          {
            renderOrder: 0,
            material: childMaterial,
            children: [],
          },
        ],
      },
      setVisible: vi.fn(),
      updateLayout: vi.fn(),
      dispose: vi.fn(),
    };

    applySceneObjectOrdering(object, {
      renderOrder: 320,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    });

    expect((object.object3D as { renderOrder: number }).renderOrder).toBe(320);
    expect(
      (object.object3D.children[0] as { renderOrder: number }).renderOrder,
    ).toBe(320);
    expect(childMaterial).toMatchObject({
      transparent: true,
      depthWrite: false,
      depthTest: false,
    });
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
