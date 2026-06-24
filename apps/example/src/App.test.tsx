import { act, createElement, useState, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { WebGLDebugState } from "@project/dom-webgl-runtime";

const runtimeProps: RuntimeMockProps[] = [];
const targetProps: TargetMockProps[] = [];
const roots: Root[] = [];

type RuntimeMockProps = {
  children?: ReactNode;
  effects?: readonly unknown[];
  scrollAdapter?: unknown;
  onDebugStateChange?: (state: WebGLDebugState) => void;
};

type TargetMockProps = {
  as?: keyof HTMLElementTagNameMap;
  children?: ReactNode;
  webgl: {
    key: string;
    source?: Record<string, unknown>;
    effects?: readonly Record<string, unknown>[];
    lifecycle?: Record<string, unknown>;
  };
};

vi.mock("@project/dom-webgl-runtime/react", () => ({
  WebGLRuntime: (props: RuntimeMockProps) => {
    runtimeProps.push(props);
    return createElement("div", { "data-testid": "example-runtime" }, props.children);
  },
  WebGLTarget: ({ as = "div", children, webgl, ...props }: TargetMockProps) => {
    targetProps.push({ as, children, webgl });
    return createElement(as, props, children);
  },
  WebGLDebugPanel: () => null,
  useWebGLDebugState: () => {
    const [state, setState] = useState<WebGLDebugState>({
      targetCount: 0,
      renderableCount: 0,
      currentScrollMode: "page",
      pointer: {
        x: 0, y: 0, normalizedX: 0, normalizedY: 0,
        isInside: false, isDown: false, downTime: 0,
        pressDuration: 0, isDragging: false,
        dragStartX: 0, dragStartY: 0,
        dragDeltaX: 0, dragDeltaY: 0, clickCount: 0,
      },
      targets: [],
    });
    return [state, setState];
  },
}));

describe("effect authoring example app", () => {
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

  test("registers a stable React runtime effect array and the vertical effect catalog", async () => {
    const { default: App } = await import("./App");
    const { exampleEffects } = await import("./exampleEffects");
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    roots.push(root);

    await act(async () => {
      root.render(createElement(App));
    });

    expect(runtimeProps.length).toBeGreaterThanOrEqual(1);
    expect(runtimeProps.every(({ effects }) => effects === exampleEffects)).toBe(true);
    expect(runtimeProps.at(-1)?.scrollAdapter).toBeDefined();
    expect(runtimeProps.at(-1)?.onDebugStateChange).toBeTypeOf("function");
    expect(host.querySelector('[data-testid="example-runtime"]')).not.toBeNull();

    const finalTargetProps = targetProps.slice(-10);

    expect(finalTargetProps.map(({ webgl }) => webgl.key)).toEqual([
      "example.surface.fill",
      "example.surface.pulse",
      "example.text.wave",
      "example.text.reveal",
      "example.image.pan",
      "example.image.zoom",
      "example.video.playback",
      "example.video.drift",
      "example.model.spin",
      "example.model.float",
    ]);
    expect(finalTargetProps.map(({ as }) => as ?? "div")).toEqual([
      "section",
      "section",
      "p",
      "p",
      "img",
      "img",
      "video",
      "video",
      "section",
      "section",
    ]);
    expect(finalTargetProps.map(({ webgl }) => webgl.source)).toEqual([
      { kind: "snapshot", mode: "element" },
      { kind: "snapshot", mode: "element" },
      { kind: "snapshot", mode: "text" },
      { kind: "snapshot", mode: "text" },
      { kind: "image", src: "/example/image.png" },
      { kind: "image", src: "/example/image.png" },
      { kind: "video", src: "/example/video.mp4" },
      { kind: "video", src: "/example/video.mp4" },
      { kind: "model", format: "glb", src: "/models/hero.glb" },
      { kind: "model", format: "glb", src: "/models/hero.glb" },
    ]);
    expect(finalTargetProps.map(({ webgl }) => webgl.effects?.[0]?.kind)).toEqual([
      "example.surfaceFill",
      "example.surfacePulse",
      "example.textWave",
      "example.textReveal",
      "example.imagePan",
      "example.imageZoom",
      "example.videoPlayback",
      "example.videoPlayback",
      "example.modelSpin",
      "example.modelFloat",
    ]);
    expect(finalTargetProps[7]?.webgl.effects?.[1]?.kind).toBe("example.videoDrift");
  });
});
