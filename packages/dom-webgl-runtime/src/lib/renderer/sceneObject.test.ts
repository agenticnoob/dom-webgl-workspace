import { describe, expect, test, vi } from "vitest";

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
});

function createSceneObject(key: string): WebGLSceneObject {
  return {
    key,
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
