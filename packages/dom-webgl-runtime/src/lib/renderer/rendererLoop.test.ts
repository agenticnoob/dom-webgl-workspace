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
        return { mode: "continuous" };
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

  test("runs the initial dirty frame then idles in on-demand mode", () => {
    const calls: string[] = [];
    let loopCallback: ((time: number) => void) | null = null;
    const renderer = {
      setAnimationLoop: vi.fn((callback: ((time: number) => void) | null) => {
        loopCallback = callback;
      }),
    };
    const loop = createRendererLoop({
      renderer,
      beforeRender(_time, frame) {
        calls.push(`before:${frame.dirtyReasons.join(",")}`);
        return { mode: "on-demand" };
      },
      render() {
        calls.push("render");
      },
    });

    loop.start();
    (loopCallback as unknown as (time: number) => void)(16);
    (loopCallback as unknown as (time: number) => void)(32);

    expect(calls).toEqual(["before:initial", "render"]);
  });

  test("requestFrame renders one additional on-demand frame with the dirty reason", () => {
    const calls: string[] = [];
    let loopCallback: ((time: number) => void) | null = null;
    const renderer = {
      setAnimationLoop: vi.fn((callback: ((time: number) => void) | null) => {
        loopCallback = callback;
      }),
    };
    const loop = createRendererLoop({
      renderer,
      beforeRender(_time, frame) {
        calls.push(`before:${frame.dirtyReasons.join(",")}`);
        return { mode: "on-demand" };
      },
      render() {
        calls.push("render");
      },
    });

    loop.start();
    (loopCallback as unknown as (time: number) => void)(16);
    loop.requestFrame("resource-ready");
    (loopCallback as unknown as (time: number) => void)(32);
    (loopCallback as unknown as (time: number) => void)(48);

    expect(calls).toEqual([
      "before:initial",
      "render",
      "before:resource-ready",
      "render",
    ]);
  });

  test("stops by clearing renderer.setAnimationLoop", () => {
    const renderer = { setAnimationLoop: vi.fn() };
    const loop = createRendererLoop({
      renderer,
      beforeRender() {
        return { mode: "continuous" };
      },
      render() {},
    });

    loop.start();
    loop.dispose();

    expect(renderer.setAnimationLoop).toHaveBeenLastCalledWith(null);
  });
});
