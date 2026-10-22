import {
  act,
  Activity,
  createElement,
  StrictMode,
  type ReactNode,
} from "react";
import { Clock } from "three";
import { createRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RootState } from "@react-three/fiber";
import {
  WebGLRuntime,
  WebGLTarget,
  useWebGLRuntime,
  useDOMTarget,
} from "../src/react";
import type { RuntimeManager } from "../src/lib/runtimeManager";

const fiber = vi.hoisted(() => ({
  frame: undefined as
    ((state: Pick<RootState, "clock" | "size">) => void) | undefined,
  clock: undefined as RootState["clock"] | undefined,
  gl: undefined as
    | {
        domElement: HTMLCanvasElement;
        getContext: () => { isContextLost: () => boolean };
      }
    | undefined,
  invalidate: vi.fn(),
  setFrameloop: vi.fn(),
  props: undefined as Record<string, unknown> | undefined,
}));

// Only the GPU root is replaced; React and the runtime manager run normally.
vi.mock("@react-three/fiber", () => ({
  Canvas: (props: { children?: ReactNode }) => {
    fiber.props = props;
    return createElement("div", { "data-r3f-canvas": "" }, props.children);
  },
  useThree: (
    selector: (state: {
      invalidate: () => void;
      setFrameloop: typeof fiber.setFrameloop;
      gl: typeof fiber.gl;
      clock: typeof fiber.clock;
    }) => unknown,
  ) =>
    selector({
      invalidate: fiber.invalidate,
      setFrameloop: fiber.setFrameloop,
      gl: fiber.gl,
      clock: fiber.clock,
    }),
  useFrame: (callback: (state: Pick<RootState, "clock" | "size">) => void) => {
    fiber.frame = callback;
  },
}));

describe("React runtime host", () => {
  let container: HTMLDivElement;
  let root: Root;
  let runtime: RuntimeManager | undefined;
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    fiber.gl = {
      domElement: document.createElement("canvas"),
      getContext: () => ({ isContextLost: () => false }),
    };
    fiber.invalidate.mockClear();
    fiber.clock = new Clock();
    fiber.setFrameloop.mockReset();
    fiber.setFrameloop.mockImplementation(() => {
      if (fiber.clock) fiber.clock.elapsedTime = 0;
    });
    runtime = undefined;
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
  function Reader() {
    runtime = useWebGLRuntime();
    const target = useDOMTarget("title");
    return createElement(
      "output",
      null,
      target?.element.textContent ?? "pending",
    );
  }
  function app(progress = 0.25) {
    return createElement(
      WebGLRuntime,
      {
        progressSignals: { get: () => progress },
        scene: createElement(Reader),
      },
      createElement(WebGLTarget, {
        id: "title",
        hideWhenReady: true,
        children: createElement("h1", null, "Accessible title"),
      }),
    );
  }

  it("survives StrictMode replay, shares scene/DOM context, and keeps one Canvas", async () => {
    await act(async () => root.render(createElement(StrictMode, null, app())));
    expect(container.querySelectorAll("[data-r3f-canvas]")).toHaveLength(1);
    expect(container.querySelector("output")?.textContent).toBe(
      "Accessible title",
    );
    expect(runtime?.progress.get("chapter")).toBe(0.25);
    expect(runtime?.getDebugState().ready).toBe(true);
    const target = runtime?.getTarget("title");
    expect(target).toBeDefined();
    await act(async () => runtime?.setTargetReady("title", true, target));
    expect(runtime?.getDebugState().targetCount).toBe(1);
    await act(async () =>
      root.render(createElement(StrictMode, null, app(0.75))),
    );
    expect(runtime?.progress.get("chapter")).toBe(0.75);
    expect(runtime?.getDebugState().targetCount).toBe(1);
  });

  it("bounds the managed pixel ratio by the device and canvas.dpr", async () => {
    await act(async () =>
      root.render(
        createElement(WebGLRuntime, {
          canvas: { dpr: 1.5 },
          scene: createElement(Reader),
        }),
      ),
    );
    const dpr = fiber.props?.dpr;
    expect(typeof dpr).toBe("number");
    expect(dpr).toBeLessThanOrEqual(Math.max(window.devicePixelRatio, 0.5));
    expect(dpr).toBeLessThanOrEqual(1.5);
  });

  it("routes pointer events from the common parent and permits native Canvas settings", async () => {
    await act(async () =>
      root.render(
        createElement(
          WebGLRuntime,
          {
            canvas: { frameloop: "demand", dpr: 2 },
            quality: false,
            scene: createElement(Reader),
          },
          createElement("p", null, "DOM"),
        ),
      ),
    );
    expect(fiber.props?.frameloop).toBe("demand");
    expect(fiber.props?.dpr).toBe(2);
    expect(fiber.props?.eventPrefix).toBe("client");
    expect(fiber.props?.eventSource).toMatchObject({
      current: container.querySelector("[data-webgl-runtime]"),
    });
  });

  it("retains the runtime across Activity hiding and disposes only on final removal", async () => {
    const render = (mode: "visible" | "hidden") =>
      root.render(createElement(Activity, { mode, children: app() }));
    await act(async () => render("visible"));
    const original = runtime;
    await act(async () => render("hidden"));
    expect(original?.getDebugState().ready).toBe(false);
    await act(async () => render("visible"));
    expect(runtime).toBe(original);
    expect(runtime?.getDebugState()).toMatchObject({
      ready: true,
      targetCount: 1,
    });
    await act(async () => runtime?.setTargetReady("title", true));
    expect(runtime?.getTarget("title")?.ready).toBe(true);
    await act(async () => render("hidden"));
    await act(async () => root.render(null));
    expect(original?.getDebugState()).toMatchObject({
      ready: false,
      targetCount: 0,
    });
  });

  it("preserves animation time and debug updates when a tab resumes", async () => {
    let hidden = false;
    vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden);
    const debug = vi.fn();
    await act(async () =>
      root.render(
        createElement(WebGLRuntime, {
          onDebugStateChange: debug,
        }),
      ),
    );
    const clock = fiber.clock!;
    const frame = () =>
      fiber.frame?.({
        clock,
        size: { width: 800, height: 600, top: 0, left: 0 },
      });
    debug.mockClear();
    clock.elapsedTime = 42;
    frame();
    expect(debug).toHaveBeenCalledTimes(1);
    hidden = true;
    await act(async () =>
      document.dispatchEvent(new Event("visibilitychange")),
    );
    expect(clock.elapsedTime).toBe(42);
    hidden = false;
    await act(async () =>
      document.dispatchEvent(new Event("visibilitychange")),
    );
    expect(clock.elapsedTime).toBe(42);
    clock.elapsedTime += 0.2;
    debug.mockClear();
    frame();
    expect(debug).toHaveBeenCalledTimes(1);
  });

  it("reports unavailable state without waiting for a paused frame", async () => {
    const debug = vi.fn();
    await act(async () =>
      root.render(
        createElement(WebGLRuntime, {
          onDebugStateChange: debug,
        }),
      ),
    );
    expect(debug).toHaveBeenLastCalledWith(
      expect.objectContaining({ ready: true }),
    );
    await act(async () =>
      fiber.gl?.domElement.dispatchEvent(
        new Event("webglcontextlost", { cancelable: true }),
      ),
    );
    expect(debug).toHaveBeenLastCalledWith(
      expect.objectContaining({ ready: false }),
    );
  });

  it("restores semantic fallback on WebGL context loss", async () => {
    await act(async () => root.render(app()));
    const element = runtime?.getTarget("title")?.element;
    await act(async () => runtime?.setTargetReady("title", true));
    await act(async () =>
      fiber.gl?.domElement.dispatchEvent(
        new Event("webglcontextlost", { cancelable: true }),
      ),
    );
    expect(runtime?.getDebugState().ready).toBe(false);
    expect(fiber.setFrameloop).toHaveBeenLastCalledWith("never");
    expect(element?.style.opacity).not.toBe("0");
    await act(async () =>
      document.dispatchEvent(new Event("visibilitychange")),
    );
    expect(runtime?.getDebugState().ready).toBe(false);
    await act(async () =>
      fiber.gl?.domElement.dispatchEvent(new Event("webglcontextrestored")),
    );
    expect(runtime?.getDebugState().ready).toBe(true);
    expect(fiber.setFrameloop).toHaveBeenLastCalledWith("always");
  });

  it("pauses hidden tabs and restores the requested demand frameloop", async () => {
    let hidden = false;
    vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden);
    await act(async () =>
      root.render(
        createElement(WebGLRuntime, {
          canvas: { frameloop: "demand" },
          scene: createElement(Reader),
        }),
      ),
    );
    expect(fiber.setFrameloop).toHaveBeenLastCalledWith("demand");
    hidden = true;
    await act(async () =>
      document.dispatchEvent(new Event("visibilitychange")),
    );
    expect(runtime?.getDebugState().ready).toBe(false);
    expect(fiber.setFrameloop).toHaveBeenLastCalledWith("never");
    hidden = false;
    await act(async () =>
      document.dispatchEvent(new Event("visibilitychange")),
    );
    expect(runtime?.getDebugState().ready).toBe(true);
    expect(fiber.setFrameloop).toHaveBeenLastCalledWith("demand");
  });

  it("renders semantic content on the server without registering DOM targets", () => {
    const html = renderToString(app());
    expect(html).toContain("Accessible title");
    expect(html).not.toContain("visibility:hidden");
    expect(html).not.toContain("opacity:0");
  });
});
