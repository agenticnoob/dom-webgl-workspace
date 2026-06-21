import {
  act,
  createElement,
  type ReactNode,
} from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { ScrollZoomImage } from "./ScrollZoomImage";

const targetProps: Array<Record<string, unknown>> = [];
const roots: Root[] = [];

type TargetMockProps = {
  as?: keyof HTMLElementTagNameMap;
  children?: ReactNode;
  webgl: Record<string, unknown>;
} & Record<string, unknown>;

vi.mock("@project/dom-webgl-runtime/react", () => ({
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

describe("ScrollZoomImage", () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    targetProps.length = 0;
    for (const root of roots.splice(0)) {
      act(() => {
        root.unmount();
      });
    }
    document.body.replaceChildren();
  });

  test("wraps a scroll-linked image target with a native sticky stage and overlay slot", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    roots.push(root);

    await act(async () => {
      root.render(
        createElement(
          ScrollZoomImage,
          {
            alt: "Background image",
            galleryItems: [
              {
                alt: "Gallery one",
                label: "Gallery label",
                src: "/demo/image.png",
              },
            ],
            maxScale: 1.6,
            src: "/demo/bg.png",
            webglKey: "demo.scroll.marker.01",
          },
          createElement("strong", null, "Overlay copy"),
        ),
      );
    });

    expect(host.querySelector(".demo-scroll-zoom-stage")).not.toBeNull();
    expect(host.querySelector(".demo-scroll-zoom-content")?.textContent).toBe(
      "Overlay copy",
    );
    expect(host.querySelector(".demo-scroll-zoom-gallery")?.textContent).toBe(
      "Gallery label",
    );
    expect(targetProps).toHaveLength(4);
    expect(targetProps[0]).toMatchObject({
      as: "img",
      alt: "Background image",
      className: "demo-scroll-card demo-scroll-card--zoom-image",
      src: "/demo/bg.png",
      webgl: {
        key: "demo.scroll.marker.01",
        source: { kind: "image", src: "/demo/bg.png" },
        effects: [{ kind: "demo.scrollImageZoom", maxScale: 1.6 }],
      },
    });
    expect(targetProps[0]?.webgl).not.toHaveProperty("scroll");
    expect(targetProps[1]).toMatchObject({
      as: "div",
      className: "demo-scroll-zoom-content",
      webgl: {
        key: "demo.scroll.marker.01.content",
        source: { kind: "snapshot", mode: "element" },
      },
    });
    expect(targetProps[2]).toMatchObject({
      as: "img",
      alt: "Gallery one",
      className: "demo-scroll-zoom-gallery-image",
      src: "/demo/image.png",
      webgl: {
        key: "demo.scroll.marker.01.gallery.0",
        source: { kind: "image", src: "/demo/image.png" },
      },
    });
    expect(targetProps[3]).toMatchObject({
      as: "figcaption",
      className: "demo-scroll-zoom-gallery-caption",
      webgl: {
        key: "demo.scroll.marker.01.gallery.0.caption",
        source: { kind: "snapshot", mode: "text" },
      },
    });
    expect(targetProps[1]?.webgl).not.toHaveProperty("scroll");
  });
});
