import { describe, expect, test, vi } from "vitest";

import { createPostprocessController } from "./postprocessController";

type TestRenderTarget = {
  texture: { id: string };
  dispose: ReturnType<typeof vi.fn>;
};

type TestPooledRenderTarget = {
  kind: string;
  width: number;
  height: number;
  target: TestRenderTarget;
};

type PostprocessControllerOptions = NonNullable<
  Parameters<typeof createPostprocessController>[0]
>;

describe("postprocess controller", () => {
  test("stores named requests and updates duplicate keys", () => {
    const controller = createPostprocessController();
    const first = controller.requestPostprocess({
      key: "glow",
      bloom: { strength: 0.4 },
    });
    const second = controller.requestPostprocess({
      key: "glow",
      bloom: { strength: 0.9 },
      grain: { amount: 0.05 },
    });

    expect(controller.inspectRequests()).toEqual([
      {
        key: "glow",
        bloom: { strength: 0.9 },
        grain: { amount: 0.05 },
      },
    ]);

    first.dispose();
    expect(controller.inspectRequests()).toHaveLength(1);

    second.dispose();
    expect(controller.inspectRequests()).toHaveLength(0);
  });

  test("handle update replaces the current request and dispose is idempotent", () => {
    const controller = createPostprocessController();
    const handle = controller.requestPostprocess({
      key: "blur",
      blur: { radius: 0.1 },
    });

    handle.update({ key: "blur", blur: { radius: 0.5 } });
    handle.dispose();
    handle.dispose();

    expect(controller.inspectRequests()).toEqual([]);
  });

  test("falls back to the base render path when no requests are active", () => {
    const controller = createPostprocessController();
    const renderBase = vi.fn();

    controller.render(renderBase);

    expect(renderBase).toHaveBeenCalledTimes(1);
  });

  test("renders active requests through a bounded low-resolution effect pass after the base render", () => {
    const renderOrder: string[] = [];
    const renderer = {
      setRenderTarget: vi.fn((target: object | null) => {
        renderOrder.push(
          isTestRenderTarget(target)
            ? `target:${target.texture.id}`
            : "target:screen",
        );
      }),
      render: vi.fn(),
    };
    const scene = { label: "scene" };
    const camera = { label: "camera" };
    const pooledTarget: TestPooledRenderTarget = {
      kind: "postprocess",
      width: 1024,
      height: 768,
      target: {
        texture: { id: "postprocess.lowres" },
        dispose: vi.fn(),
      },
    };
    const pool = {
      acquire: vi.fn(() => pooledTarget),
      release: vi.fn(),
      dispose: vi.fn(),
    };
    const effectPass = {
      render: vi.fn(() => {
        renderOrder.push("effect-pass");
      }),
      dispose: vi.fn(),
    };
    const controller = createPostprocessController({
      renderer,
      scene,
      camera,
      getViewportSize() {
        return { width: 2400, height: 1800 };
      },
      now() {
        return 42;
      },
      createRenderTargetPool() {
        return pool;
      },
      createEffectPass() {
        return effectPass;
      },
    } satisfies PostprocessControllerOptions);
    controller.requestPostprocess({
      key: "hero.fx",
      bloom: { strength: 4, radius: 3, threshold: -1 },
      grain: { amount: 2 },
      blur: { radius: 2 },
    });
    const renderBase = vi.fn(() => {
      renderOrder.push("base-render");
    });

    controller.render(renderBase);

    expect(renderOrder).toEqual([
      "target:postprocess.lowres",
      "base-render",
      "target:screen",
      "effect-pass",
    ]);
    expect(pool.acquire).toHaveBeenCalledWith("postprocess", 1024, 768);
    expect(effectPass.render).toHaveBeenCalledWith(
      expect.objectContaining({
        renderer,
        scene,
        camera,
        time: 42,
        outputSize: { width: 1024, height: 768 },
        sourceTarget: pooledTarget.target,
        request: {
          bloom: { strength: 1, radius: 1, threshold: 0 },
          grain: { amount: 1 },
          blur: { radius: 1 },
        },
      }),
    );
    expect(pool.release).toHaveBeenCalledWith(pooledTarget);
  });

  test("dispose releases retained render targets and remains idempotent", () => {
    const pooledTarget: TestPooledRenderTarget = {
      kind: "postprocess",
      width: 600,
      height: 400,
      target: {
        texture: { id: "retained" },
        dispose: vi.fn(),
      },
    };
    const pool = {
      acquire: vi.fn(() => pooledTarget),
      release: vi.fn(),
      dispose: vi.fn(() => {
        pooledTarget.target.dispose();
      }),
    };
    const effectPass = {
      render: vi.fn(),
      dispose: vi.fn(),
    };
    const controller = createPostprocessController({
      renderer: {
        setRenderTarget: vi.fn(),
        render: vi.fn(),
      },
      scene: {},
      camera: {},
      getViewportSize() {
        return { width: 1200, height: 800 };
      },
      now() {
        return 1;
      },
      createRenderTargetPool() {
        return pool;
      },
      createEffectPass() {
        return effectPass;
      },
    } satisfies PostprocessControllerOptions);

    controller.requestPostprocess({
      key: "hero.fx",
      grain: { amount: 0.2 },
    });
    controller.render(vi.fn());
    controller.dispose();
    controller.dispose();

    expect(effectPass.dispose).toHaveBeenCalledTimes(1);
    expect(pool.dispose).toHaveBeenCalledTimes(1);
    expect(pooledTarget.target.dispose).toHaveBeenCalledTimes(1);
  });

  test("disposes retained targets when the postprocess output size changes", () => {
    let viewport = { width: 1200, height: 800 };
    let nextId = 0;
    const createdTargets: TestRenderTarget[] = [];
    const retained = new Map<string, TestPooledRenderTarget>();
    const leased = new Set<TestPooledRenderTarget>();
    const pool = {
      acquire: vi.fn((kind: string, width: number, height: number) => {
        const key = `${kind}:${width}x${height}`;
        const retainedTarget = retained.get(key);

        if (retainedTarget) {
          retained.delete(key);
          leased.add(retainedTarget);
          return retainedTarget;
        }

        const target: TestRenderTarget = {
          texture: { id: `target.${nextId}` },
          dispose: vi.fn(),
        };
        const pooled = {
          kind,
          width,
          height,
          target,
        };

        nextId += 1;
        createdTargets.push(target);
        leased.add(pooled);
        return pooled;
      }),
      release: vi.fn((target: TestPooledRenderTarget) => {
        if (!leased.delete(target)) {
          return;
        }

        retained.set(`${target.kind}:${target.width}x${target.height}`, target);
      }),
      dispose: vi.fn(() => {
        for (const target of leased) {
          target.target.dispose();
        }
        leased.clear();

        for (const target of retained.values()) {
          target.target.dispose();
        }
        retained.clear();
      }),
    };
    const controller = createPostprocessController({
      renderer: {
        setRenderTarget: vi.fn(),
        render: vi.fn(),
      },
      scene: {},
      camera: {},
      getViewportSize() {
        return viewport;
      },
      now() {
        return 1;
      },
      createRenderTargetPool() {
        return pool;
      },
      createEffectPass() {
        return {
          render: vi.fn(),
          dispose: vi.fn(),
        };
      },
    } satisfies PostprocessControllerOptions);

    controller.requestPostprocess({
      key: "hero.fx",
      bloom: { strength: 0.2 },
    });
    controller.render(vi.fn());
    viewport = { width: 1600, height: 900 };
    controller.render(vi.fn());

    expect(pool.acquire).toHaveBeenNthCalledWith(1, "postprocess", 600, 400);
    expect(pool.acquire).toHaveBeenNthCalledWith(2, "postprocess", 800, 450);
    expect(pool.dispose).toHaveBeenCalledTimes(1);
    expect(createdTargets).toHaveLength(2);
    expect(createdTargets[0]?.dispose).toHaveBeenCalledTimes(1);
    expect(createdTargets[1]?.dispose).not.toHaveBeenCalled();
  });

  test("clamps bloom threshold below the shader smoothstep upper edge", () => {
    const effectPass = {
      render: vi.fn(),
      dispose: vi.fn(),
    };
    const controller = createPostprocessController({
      renderer: {
        setRenderTarget: vi.fn(),
        render: vi.fn(),
      },
      scene: {},
      camera: {},
      getViewportSize() {
        return { width: 1000, height: 800 };
      },
      now() {
        return 1;
      },
      createRenderTargetPool() {
        return createSingleTargetPool();
      },
      createEffectPass() {
        return effectPass;
      },
    } satisfies PostprocessControllerOptions);

    controller.requestPostprocess({
      key: "hero.fx",
      bloom: { threshold: 2 },
    });
    controller.render(vi.fn());

    expect(effectPass.render).toHaveBeenCalledWith(
      expect.objectContaining({
        request: {
          bloom: { strength: 0.35, radius: 0.25, threshold: 0.999 },
        },
      }),
    );
  });

  test("passes a safe disabled bloom threshold for grain-only requests", () => {
    const effectPass = {
      render: vi.fn(),
      dispose: vi.fn(),
    };
    const controller = createPostprocessController({
      renderer: {
        setRenderTarget: vi.fn(),
        render: vi.fn(),
      },
      scene: {},
      camera: {},
      getViewportSize() {
        return { width: 1000, height: 800 };
      },
      now() {
        return 1;
      },
      createRenderTargetPool() {
        return createSingleTargetPool();
      },
      createEffectPass() {
        return effectPass;
      },
    } satisfies PostprocessControllerOptions);

    controller.requestPostprocess({
      key: "hero.fx",
      grain: { amount: 0.4 },
    });
    controller.render(vi.fn());

    expect(effectPass.render).toHaveBeenCalledWith(
      expect.objectContaining({
        request: {
          bloom: { strength: 0, radius: 0, threshold: 0.999 },
          grain: { amount: 0.4 },
        },
      }),
    );
  });

  test("creates default postprocess render targets with depth buffering", async () => {
    const renderTargetOptions: Array<{
      depthBuffer?: boolean;
      stencilBuffer?: boolean;
    }> = [];

    vi.resetModules();
    vi.doMock("three/src/renderers/WebGLRenderTarget.js", () => ({
      WebGLRenderTarget: function MockWebGLRenderTarget(
        _width: number,
        _height: number,
        options: { depthBuffer?: boolean; stencilBuffer?: boolean },
      ) {
        renderTargetOptions.push(options);

        return {
          texture: { id: "default.depth" },
          dispose: vi.fn(),
        };
      },
    }));

    try {
      const { createPostprocessController: createControllerWithMock } =
        await import("./postprocessController");
      const controller = createControllerWithMock({
        renderer: {
          setRenderTarget: vi.fn(),
          render: vi.fn(),
        },
        scene: {},
        camera: {},
        getViewportSize() {
          return { width: 800, height: 600 };
        },
        now() {
          return 1;
        },
        createEffectPass() {
          return {
            render: vi.fn(),
            dispose: vi.fn(),
          };
        },
      });

      controller.requestPostprocess({
        key: "hero.fx",
        blur: { radius: 0.2 },
      });
      controller.render(vi.fn());

      expect(renderTargetOptions).toEqual([
        { depthBuffer: true, stencilBuffer: false },
      ]);

      controller.dispose();
    } finally {
      vi.doUnmock("three/src/renderers/WebGLRenderTarget.js");
      vi.resetModules();
    }
  });
});

function isTestRenderTarget(target: object | null): target is TestRenderTarget {
  return (
    target !== null &&
    "texture" in target &&
    typeof target.texture === "object" &&
    target.texture !== null &&
    "id" in target.texture
  );
}

function createSingleTargetPool(): PostprocessControllerOptions extends {
  createRenderTargetPool?(): infer TPool;
}
  ? TPool
  : never {
  const pooledTarget: TestPooledRenderTarget = {
    kind: "postprocess",
    width: 500,
    height: 400,
    target: {
      texture: { id: "single" },
      dispose: vi.fn(),
    },
  };

  return {
    acquire: vi.fn(() => pooledTarget),
    release: vi.fn(),
    dispose: vi.fn(),
  };
}
