import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const runtimeProps: Array<Record<string, unknown>> = [];
const targetProps: Array<Record<string, unknown>> = [];
const roots: Root[] = [];

type RuntimeMockProps = {
  children?: ReactNode;
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
    targetProps.push({ ...props, as, webgl, children });
    return createElement(as, props, children);
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

  test("renders the Phase 1 demo scene through the public React runtime API", async () => {
    const { default: App } = await import("./App");
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    roots.push(root);

    await act(async () => {
      root.render(createElement(App));
    });

    expect(runtimeProps).toHaveLength(1);
    expect(host.querySelector('[data-testid="webgl-runtime"]')).not.toBeNull();

    expect(targetProps.map(({ webgl }) => (webgl as { key: string }).key)).toEqual([
      "demo.surface",
      "demo.text",
      "demo.image",
      "demo.video",
      "demo.model",
    ]);
    expect(
      targetProps.map(({ webgl }) => ({
        key: (webgl as { key: string }).key,
        source: (webgl as { source?: { kind: string; mode?: string; format?: string; src?: string } })
          .source,
      })),
    ).toEqual([
      { key: "demo.surface", source: { kind: "snapshot", mode: "element" } },
      { key: "demo.text", source: { kind: "snapshot", mode: "text" } },
      { key: "demo.image", source: { kind: "image", src: "/demo/image.png" } },
      { key: "demo.video", source: { kind: "video", src: "/demo/video.mp4" } },
      {
        key: "demo.model",
        source: { kind: "model", format: "glb", src: "/models/hero.glb" },
      },
    ]);
    expect(
      targetProps.map(({ as }) => as),
    ).toEqual(["div", "h2", "img", "video", "div"]);
  });

  test("declares a scene gate target through the public WebGLTarget API", async () => {
    const { default: App } = await import("./App");
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    roots.push(root);

    await act(async () => {
      root.render(createElement(App));
    });

    expect(
      targetProps.some(({ webgl }) => {
        const scroll = (webgl as { scroll?: Record<string, unknown> }).scroll;

        return (
          scroll?.type === "gate" &&
          scroll.start === "top top" &&
          typeof scroll.duration === "number" &&
          scroll.duration > 0 &&
          typeof scroll.release === "string"
        );
      }),
    ).toBe(true);
  });
});
