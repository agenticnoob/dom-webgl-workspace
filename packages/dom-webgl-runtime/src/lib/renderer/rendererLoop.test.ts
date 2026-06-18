import { describe, expect, test, vi } from "vitest";

import { createRendererLoop } from "./rendererLoop";

describe("renderer loop", () => {
  test("starts through renderer.setAnimationLoop and renders once after hooks", () => {
    const calls: string[] = [];
    let loopCallback: ((time: number) => void) | null = null;
    const renderer = {
      setAnimationLoop: vi.fn((callback: ((time: number) => void) | null) => {
        loopCallback = callback;
      }),
    };
    const loop = createRendererLoop({
      renderer,
      beforeRender() {
        calls.push("beforeRender");
      },
      render() {
        calls.push("render");
      },
    });

    loop.start();
    expect(loopCallback).toEqual(expect.any(Function));
    (loopCallback as unknown as (time: number) => void)(16);

    expect(renderer.setAnimationLoop).toHaveBeenCalledWith(expect.any(Function));
    expect(calls).toEqual(["beforeRender", "render"]);
  });

  test("stops by clearing renderer.setAnimationLoop", () => {
    const renderer = { setAnimationLoop: vi.fn() };
    const loop = createRendererLoop({
      renderer,
      beforeRender() {},
      render() {},
    });

    loop.start();
    loop.dispose();

    expect(renderer.setAnimationLoop).toHaveBeenLastCalledWith(null);
  });
});
