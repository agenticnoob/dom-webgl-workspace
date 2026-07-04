import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import {
  WebGLRuntimeProvider,
  useWebGLRuntime,
} from "../../../src/react";
import type { WebGLRuntime } from "../../../src/lib/renderer/runtime";

describe("useWebGLRuntime", () => {
  test("returns the runtime from the provider context", () => {
    const runtime = createRuntimeStub();
    let receivedRuntime: WebGLRuntime | undefined;

    function RuntimeConsumer() {
      receivedRuntime = useWebGLRuntime();
      return createElement("div");
    }

    renderToStaticMarkup(
      createElement(
        WebGLRuntimeProvider,
        { runtime },
        createElement(RuntimeConsumer),
      ),
    );

    expect(receivedRuntime).toBe(runtime);
  });

  test("throws a clear error when used outside the provider", () => {
    function RuntimeConsumer() {
      useWebGLRuntime();
      return createElement("div");
    }

    expect(() => renderToStaticMarkup(createElement(RuntimeConsumer))).toThrow(
      /useWebGLRuntime must be used within a WebGLRuntimeProvider/i,
    );
  });
});

function createRuntimeStub(): WebGLRuntime {
  return {
    container: {} as HTMLElement,
    registerScene() {},
    unregisterScene() {},
    registerCamera() {},
    unregisterCamera() {},
    registerRenderPass() {},
    unregisterRenderPass() {},
    registerStagePrimitive() {},
    unregisterStagePrimitive() {},
    registerLight() {},
    unregisterLight() {},
    registerTarget() {
      throw new Error("not implemented in test");
    },
    unregisterTarget() {},
    sync() {},
    getDebugState() {
      throw new Error("not implemented in test");
    },
    dispose() {},
  };
}
