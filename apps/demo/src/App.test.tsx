import {
  act,
  Children,
  cloneElement,
  createElement,
  isValidElement,
  type ReactNode,
} from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const runtimeProps: RuntimeMockProps[] = [];
const targetProps: Array<Record<string, unknown>> = [];
const roots: Root[] = [];

type RuntimeMockProps = {
  children?: ReactNode;
  effects?: readonly unknown[];
  [key: string]: unknown;
  onDebugStateChange?: (state: {
    targetCount: number;
    renderableCount: number;
    currentScrollMode: "page" | "gate";
    pointer: Record<string, unknown>;
    targets: unknown[];
  }) => void;
};

type TargetMockProps = {
  as?: keyof HTMLElementTagNameMap;
  children?: ReactNode;
  webgl: Record<string, unknown>;
} & Record<string, unknown>;

vi.mock("@project/dom-webgl-runtime/react", () => ({
  WebGLRuntime: (props: RuntimeMockProps) => {
    runtimeProps.push(props);
    return createElement("div", { "data-testid": "webgl-runtime" }, props.children);
  },
  WebGLTarget: ({
    as = "div",
    webgl,
    children,
    ...props
  }: TargetMockProps) => {
    const lifecycle = webgl.lifecycle as
      | { hideWhenReady?: boolean; hideMode?: "subtree" | "self" }
      | undefined;
    const fallbackHidden =
      lifecycle?.hideWhenReady !== false &&
      (lifecycle?.hideMode ?? "self") === "self";
    const renderedChildren = fallbackHidden
      ? cloneChildrenWithVisibleFallback(children)
      : children;

    targetProps.push({ ...props, as, webgl, children });
    return createElement(
      as,
      {
        ...props,
        "data-fallback-hidden": fallbackHidden ? "self" : undefined,
        style: fallbackHidden ? { visibility: "hidden" } : undefined,
      },
      renderedChildren,
    );
  },
}));

describe("demo App", () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    runtimeProps.length = 0;
    targetProps.length = 0;
    for (const root of roots.splice(0)) {
      act(() => {
        root.unmount();
      });
    }
    document.body.replaceChildren();
  });

  test("renders the visible renderable demo through the public React runtime API", async () => {
    const { default: App } = await import("./App");
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    roots.push(root);

    await act(async () => {
      root.render(createElement(App));
    });
    await flushSmoothScrollPublishFrame();

    expect(runtimeProps).toHaveLength(1);
    expect(runtimeProps[0]?.className).toBe("demo-runtime");
    expect(host.querySelector('[data-testid="webgl-runtime"]')).not.toBeNull();
    expect(host.querySelector(".demo-scene")).not.toBeNull();

    expect(targetProps.map(({ webgl }) => (webgl as { key: string }).key)).toEqual([
      "demo.section",
      "demo.surface",
      "demo.text",
      "demo.image",
      "demo.video",
      "demo.model",
      "demo.layout.surface",
      "demo.layout.text",
      "demo.layout.image",
      "demo.effects.surface",
      "demo.effects.surface.phase6",
      "demo.scroll.marker.01",
      "demo.scroll.marker.01.content",
      "demo.scroll.marker.01.gallery.0",
      "demo.scroll.marker.01.gallery.0.caption",
      "demo.scroll.marker.01.gallery.1",
      "demo.scroll.marker.01.gallery.1.caption",
      "demo.scroll.marker.01.gallery.2",
      "demo.scroll.marker.01.gallery.2.caption",
      "demo.scroll.marker.01.gallery.3",
      "demo.scroll.marker.01.gallery.3.caption",
      "demo.scroll.marker.02",
      "demo.scroll.marker.02.copy",
      "demo.scroll.marker.03",
      "demo.scroll.marker.04",
      "demo.scroll.marker.05",
      "demo.scroll.marker.06",
      "demo.scroll.marker.06.copy",
      "demo.scroll.marker.07",
      "demo.scroll.marker.08",
    ]);
    expect(
      targetProps.map(({ webgl }) => ({
        key: (webgl as { key: string }).key,
        source: (webgl as { source?: { kind: string; mode?: string; format?: string; src?: string } })
          .source,
      })),
    ).toEqual([
      {
        key: "demo.section",
        source: { kind: "snapshot", mode: "element" },
      },
      { key: "demo.surface", source: { kind: "snapshot", mode: "element" } },
      { key: "demo.text", source: { kind: "snapshot", mode: "text" } },
      { key: "demo.image", source: { kind: "image", src: "/demo/image.png" } },
      { key: "demo.video", source: { kind: "video", src: "/demo/video.mp4" } },
      {
        key: "demo.model",
        source: { kind: "model", format: "glb", src: "/models/hero.glb" },
      },
      {
        key: "demo.layout.surface",
        source: { kind: "snapshot", mode: "element" },
      },
      {
        key: "demo.layout.text",
        source: { kind: "snapshot", mode: "text" },
      },
      {
        key: "demo.layout.image",
        source: { kind: "image", src: "/demo/layout-cover.png" },
      },
      {
        key: "demo.effects.surface",
        source: { kind: "snapshot", mode: "element" },
      },
      {
        key: "demo.effects.surface.phase6",
        source: { kind: "snapshot", mode: "element" },
      },
      {
        key: "demo.scroll.marker.01",
        source: { kind: "image", src: "/demo/bg.png" },
      },
      {
        key: "demo.scroll.marker.01.content",
        source: { kind: "snapshot", mode: "element" },
      },
      {
        key: "demo.scroll.marker.01.gallery.0",
        source: { kind: "image", src: "/demo/image.png" },
      },
      {
        key: "demo.scroll.marker.01.gallery.0.caption",
        source: { kind: "snapshot", mode: "text" },
      },
      {
        key: "demo.scroll.marker.01.gallery.1",
        source: { kind: "image", src: "/demo/layout-cover.png" },
      },
      {
        key: "demo.scroll.marker.01.gallery.1.caption",
        source: { kind: "snapshot", mode: "text" },
      },
      {
        key: "demo.scroll.marker.01.gallery.2",
        source: { kind: "image", src: "/demo/bg.png" },
      },
      {
        key: "demo.scroll.marker.01.gallery.2.caption",
        source: { kind: "snapshot", mode: "text" },
      },
      {
        key: "demo.scroll.marker.01.gallery.3",
        source: { kind: "image", src: "/demo/image.png" },
      },
      {
        key: "demo.scroll.marker.01.gallery.3.caption",
        source: { kind: "snapshot", mode: "text" },
      },
      {
        key: "demo.scroll.marker.02",
        source: { kind: "snapshot", mode: "element" },
      },
      {
        key: "demo.scroll.marker.02.copy",
        source: { kind: "snapshot", mode: "text" },
      },
      {
        key: "demo.scroll.marker.03",
        source: { kind: "snapshot", mode: "element" },
      },
      {
        key: "demo.scroll.marker.04",
        source: { kind: "snapshot", mode: "element" },
      },
      {
        key: "demo.scroll.marker.05",
        source: { kind: "snapshot", mode: "element" },
      },
      {
        key: "demo.scroll.marker.06",
        source: { kind: "snapshot", mode: "element" },
      },
      {
        key: "demo.scroll.marker.06.copy",
        source: { kind: "snapshot", mode: "text" },
      },
      {
        key: "demo.scroll.marker.07",
        source: { kind: "snapshot", mode: "element" },
      },
      {
        key: "demo.scroll.marker.08",
        source: { kind: "snapshot", mode: "element" },
      },
    ]);
    expect(targetProps.map(({ as }) => as)).toEqual([
      "section",
      "div",
      "h2",
      "img",
      "video",
      "div",
      "div",
      "p",
      "img",
      "div",
      "section",
      "img",
      "div",
      "img",
      "figcaption",
      "img",
      "figcaption",
      "img",
      "figcaption",
      "img",
      "figcaption",
      "div",
      "p",
      "div",
      "div",
      "div",
      "div",
      "p",
      "div",
      "div",
    ]);
  });

  test("declares every visible source category through public WebGLTarget props", async () => {
    await renderApp();

    expect(webglDeclarationFor("demo.surface")).toMatchObject({
      key: "demo.surface",
      source: { kind: "snapshot", mode: "element" },
      effects: [{ kind: "demo.capabilitySurface" }],
    });
    expect(webglDeclarationFor("demo.text")).toMatchObject({
      key: "demo.text",
      source: { kind: "snapshot", mode: "text" },
      effects: [
        { kind: "demo.capabilityTextLayer" },
        {
          kind: "demo.textPressure",
          intensity: 0.95,
          radius: 92,
        },
      ],
    });
    expect(webglDeclarationFor("demo.image")).toMatchObject({
      key: "demo.image",
      source: { kind: "image", src: "/demo/image.png" },
      effects: [{ kind: "demo.capabilityImageTexture" }],
    });
    expect(webglDeclarationFor("demo.video")).toMatchObject({
      key: "demo.video",
      source: { kind: "video", src: "/demo/video.mp4" },
      effects: [{ kind: "demo.capabilityVideoPlayback" }],
    });
    expect(webglDeclarationFor("demo.model")).toMatchObject({
      key: "demo.model",
      source: { kind: "model", format: "glb", src: "/models/hero.glb" },
      lifecycle: { hideWhenReady: true, hideMode: "subtree" },
      effects: [
        {
          kind: "demo.glbRotate",
          rotationSpeed: 0.5,
        },
        {
          kind: "demo.glbVertexParticles",
          color: "rgb(255, 0, 0)",
          density: 2.5,
          size: 0.026,
          scatterRadius: 0.42,
          hitRadius: 0.075,
          scatterStrength: 1.8,
          returnStrength: 0.075,
          damping: 0.9,
        },
      ],
    });
  });

  test("declares the layout/content harness through public WebGLTarget props", async () => {
    await renderApp();

    expect(webglDeclarationFor("demo.layout.surface")).toMatchObject({
      key: "demo.layout.surface",
      source: { kind: "snapshot", mode: "element" },
    });
    expect(webglDeclarationFor("demo.layout.text")).toMatchObject({
      key: "demo.layout.text",
      source: { kind: "snapshot", mode: "text" },
    });
    expect(webglDeclarationFor("demo.layout.image")).toMatchObject({
      key: "demo.layout.image",
      source: { kind: "image", src: "/demo/layout-cover.png" },
    });
    expect(
      targetProps.some(({ webgl }) =>
        (webgl as { key: string }).key.includes("fidelity"),
      ),
    ).toBe(false);
  });

  test("declares the Phase 8 effect harness through public WebGLTarget props", async () => {
    await renderApp();

    expect(runtimeProps[0]).toMatchObject({
      effects: expect.arrayContaining([
        expect.objectContaining({ kind: "demo.surface" }),
        expect.objectContaining({ kind: "demo.pointerTilt" }),
        expect.objectContaining({ kind: "demo.glbRotate" }),
        expect.objectContaining({ kind: "demo.glbVertexParticles" }),
        expect.objectContaining({ kind: "demo.capabilitySurface" }),
        expect.objectContaining({ kind: "demo.capabilityTextLayer" }),
        expect.objectContaining({ kind: "demo.capabilityImageTexture" }),
        expect.objectContaining({ kind: "demo.capabilityVideoPlayback" }),
        expect.objectContaining({ kind: "demo.scrambledText" }),
        expect.objectContaining({ kind: "demo.textPressure" }),
        expect.objectContaining({ kind: "demo.scrollImageZoom" }),
      ]),
    });

    expect(webglDeclarationFor("demo.effects.surface")).toMatchObject({
      key: "demo.effects.surface",
      source: { kind: "snapshot", mode: "element" },
      effects: [
        { kind: "demo.surface", opacity: 0.82 },
        { kind: "demo.pointerTilt", strength: 0.6, maxDegrees: 8 },
      ],
    });
  });

  test("passes the official smooth scroll adapter into the demo runtime", async () => {
    await renderApp();

    expect(runtimeProps[0]?.scrollAdapter).toMatchObject({
      kind: "lenis",
      readMetrics: expect.any(Function),
    });
  });

  test("keeps runtime effect definitions stable across debug re-renders", async () => {
    await renderApp();
    const initialEffects = runtimeProps[0]?.effects;
    const initialScrollAdapter = runtimeProps[0]?.scrollAdapter;

    await act(async () => {
      runtimeProps[0]?.onDebugStateChange?.(createEmptyDebugState());
    });

    expect(runtimeProps).toHaveLength(2);
    expect(runtimeProps[1]?.effects).toBe(initialEffects);
    expect(runtimeProps[1]?.scrollAdapter).toBe(initialScrollAdapter);
  });

  test("declares a demo-owned surface effect harness through public WebGLTarget props", async () => {
    await renderApp();

    expect(webglDeclarationFor("demo.effects.surface.phase6")).toMatchObject({
      key: "demo.effects.surface.phase6",
      source: { kind: "snapshot", mode: "element" },
      effects: [
        { kind: "demo.surface", opacity: 0.86 },
        { kind: "demo.pointerTilt", strength: 1, maxDegrees: 15 },
      ],
    });
  });

  test("declares extra scroll-event markers through public WebGLTarget props", async () => {
    const host = await renderApp();
    const scrollTargets = targetProps.filter(({ webgl }) =>
      (webgl as { key: string }).key.startsWith("demo.scroll.marker."),
    );
    const targetKeys = targetProps.map(({ webgl }) => (webgl as { key: string }).key);

    expect(host.querySelector('[aria-label="Scroll event effect targets"]')).not.toBeNull();
    expect(scrollTargets).toHaveLength(19);
    expect(new Set(targetKeys).size).toBe(targetKeys.length);
    expect(webglDeclarationFor("demo.scroll.marker.01")).toMatchObject({
      key: "demo.scroll.marker.01",
      source: { kind: "image", src: "/demo/bg.png" },
      effects: [
        { kind: "demo.scrollImageZoom", maxScale: 1.72 },
      ],
    });
    expect(webglDeclarationFor("demo.scroll.marker.01")).not.toHaveProperty(
      "scroll",
    );
    expect(targetProps.find(({ webgl }) =>
      (webgl as { key: string }).key === "demo.scroll.marker.01",
    )?.as).toBe("img");
    expect(host.querySelector(".demo-scroll-zoom-stage")).not.toBeNull();
    expect(host.textContent).toContain("Smooth sticky zoom");
    expect(webglDeclarationFor("demo.scroll.marker.01.content")).toMatchObject({
      key: "demo.scroll.marker.01.content",
      source: { kind: "snapshot", mode: "element" },
    });
    expect(webglDeclarationFor("demo.scroll.marker.01.content")).not.toHaveProperty(
      "scroll",
    );
    expect(webglDeclarationFor("demo.scroll.marker.01.gallery.0")).toMatchObject({
      key: "demo.scroll.marker.01.gallery.0",
      source: { kind: "image", src: "/demo/image.png" },
    });
    expect(webglDeclarationFor("demo.scroll.marker.01.gallery.0.caption")).toMatchObject({
      key: "demo.scroll.marker.01.gallery.0.caption",
      source: { kind: "snapshot", mode: "text" },
    });
    expect(webglDeclarationFor("demo.scroll.marker.02")).toMatchObject({
      key: "demo.scroll.marker.02",
      source: { kind: "snapshot", mode: "element" },
      lifecycle: { hideWhenReady: true, hideMode: "self" },
      effects: [{ kind: "demo.surface", opacity: 0.64 }],
    });
    expect(webglDeclarationFor("demo.scroll.marker.02.copy")).toMatchObject({
      key: "demo.scroll.marker.02.copy",
      source: { kind: "snapshot", mode: "text" },
      effects: [
        {
          kind: "demo.scrambledText",
          intensity: 0.9,
          radius: 84,
          speed: 18,
        },
      ],
    });
    expect(targetProps.find(({ webgl }) =>
      (webgl as { key: string }).key === "demo.scroll.marker.02.copy",
    )?.as).toBe("p");
    expect(webglDeclarationFor("demo.scroll.marker.06")).toMatchObject({
      key: "demo.scroll.marker.06",
      source: { kind: "snapshot", mode: "element" },
      lifecycle: { hideWhenReady: true, hideMode: "self" },
      effects: [{ kind: "demo.surface", opacity: 0.64 }],
    });
    expect(webglDeclarationFor("demo.scroll.marker.06.copy")).toMatchObject({
      key: "demo.scroll.marker.06.copy",
      source: { kind: "snapshot", mode: "text" },
    });
    expect(targetProps.find(({ webgl }) =>
      (webgl as { key: string }).key === "demo.scroll.marker.06.copy",
    )?.as).toBe("p");
    expect(webglDeclarationFor("demo.scroll.marker.08")).toMatchObject({
      key: "demo.scroll.marker.08",
      source: { kind: "snapshot", mode: "element" },
      effects: [
        { kind: "demo.surface", opacity: 0.7 },
        { kind: "demo.pointerTilt", strength: 0.35, maxDegrees: 5 },
      ],
    });
  });

  test("renders bilingual demo copy for scroll effect testing", async () => {
    const host = await renderApp();

    expect(host.textContent).toContain("Scroll event harness");
    expect(host.textContent).toContain("滚动事件测试区");
    expect(host.textContent).toContain("One runtime");
    expect(host.textContent).toContain("一个 runtime");
    expect(host.textContent).toContain("Bottom threshold");
    expect(host.textContent).toContain("底部阈值");
  });

  test("uses mapped-target default self fallback hiding on container targets", async () => {
    await renderApp();

    expect(webglDeclarationFor("demo.section")).not.toHaveProperty("lifecycle");
    expect(webglDeclarationFor("demo.layout.surface")).not.toHaveProperty(
      "lifecycle",
    );
  });

  test("uses mapped-target default self fallback hiding on leaf demo targets", async () => {
    const host = await renderApp();
    const surface = host.querySelector<HTMLElement>(".demo-card-surface");
    const child = surface?.querySelector<HTMLElement>("strong");

    expect(webglDeclarationFor("demo.surface")).not.toHaveProperty("lifecycle");
    expect(surface?.dataset.fallbackHidden).toBe("self");
    expect(surface?.style.visibility).toBe("hidden");
    expect(child?.style.visibility).toBe("visible");
  });

  test("keeps child DOM visible when the parent fallback paint is hidden", async () => {
    const host = await renderApp();
    const surface = host.querySelector<HTMLElement>(".demo-layout-card-surface");
    const child = surface?.querySelector<HTMLElement>("strong");

    expect(surface?.dataset.fallbackHidden).toBe("self");
    expect(surface?.style.visibility).toBe("hidden");
    expect(child?.style.visibility).toBe("visible");
  });

  test("labels the extra demo section as layout/content rather than fidelity", async () => {
    const host = await renderApp();

    expect(host.querySelector('[aria-label="DOM layout and content targets"]')).not.toBeNull();
    expect(host.querySelector('[aria-label="DOM fidelity targets"]')).toBeNull();
    expect(host.textContent).not.toContain("Fidelity");
  });

  test("keeps the scroll demo on smooth page scrolling without scene gates", async () => {
    await renderApp();

    const gatedTargets = targetProps.filter(({ webgl }) => {
      const scroll = (webgl as { scroll?: Record<string, unknown> }).scroll;

      return scroll?.type === "gate";
    });

    expect(gatedTargets).toHaveLength(0);
  });
});

async function renderApp(): Promise<HTMLElement> {
  const { default: App } = await import("./App");
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  roots.push(root);

  await act(async () => {
    root.render(createElement(App));
  });
  await flushSmoothScrollPublishFrame();

  return host;
}

async function flushSmoothScrollPublishFrame(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => window.requestAnimationFrame(resolve));
  });
}

function webglDeclarationFor(key: string): Record<string, unknown> | undefined {
  return targetProps.find(
    ({ webgl }) => (webgl as { key?: string }).key === key,
  )?.webgl as Record<string, unknown> | undefined;
}

function createEmptyDebugState() {
  return {
    targetCount: 0,
    renderableCount: 0,
    currentScrollMode: "page" as const,
    pointer: {
      x: 0,
      y: 0,
      normalizedX: 0,
      normalizedY: 0,
      isInside: false,
      isDown: false,
      downTime: 0,
      pressDuration: 0,
      isDragging: false,
      dragStartX: 0,
      dragStartY: 0,
      dragDeltaX: 0,
      dragDeltaY: 0,
      clickCount: 0,
    },
    targets: [],
  };
}

function cloneChildrenWithVisibleFallback(children: ReactNode): ReactNode {
  return Children.map(children, cloneChildWithVisibleFallback);
}

function cloneChildWithVisibleFallback(child: ReactNode): ReactNode {
  if (!isValidElement<{ style?: Record<string, unknown> }>(child)) {
    return child;
  }

  return cloneElement(child, {
    style: {
      ...child.props.style,
      visibility: "visible",
    },
  });
}
