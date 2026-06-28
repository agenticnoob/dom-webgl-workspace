import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const scrollSectionProps: ScrollEffectSectionMockProps[] = [];
const targetProps: TargetMockProps[] = [];
const roots: Root[] = [];

type ScrollEffectSectionMockProps = {
  readonly as?: keyof HTMLElementTagNameMap;
  readonly children?: ReactNode;
  readonly className?: string;
  readonly end?: string;
  readonly pin?: boolean | string | Element;
  readonly progressKey: string;
  readonly scrub?: boolean | number;
  readonly start?: string;
};

type TargetMockProps = {
  readonly as?: keyof HTMLElementTagNameMap;
  readonly children?: ReactNode;
  readonly webgl: {
    readonly key: string;
    readonly source?: Record<string, unknown>;
    readonly effects?: readonly Record<string, unknown>[];
    readonly lifecycle?: Record<string, unknown>;
    readonly scroll?: { readonly type?: unknown };
  };
};

vi.mock("@project/dom-webgl-scroll-adapters/react", () => ({
  ScrollEffectSection: ({
    as = "section",
    children,
    className,
    progressKey,
    ...props
  }: ScrollEffectSectionMockProps) => {
    scrollSectionProps.push({ as, children, className, progressKey, ...props });
    return createElement(as, { className, "data-progress-key": progressKey }, children);
  },
}));

vi.mock("@project/dom-webgl-runtime/react", () => ({
  WebGLTarget: ({ as = "div", children, webgl, ...props }: TargetMockProps) => {
    targetProps.push({ as, children, webgl });
    return createElement(as, props, children);
  },
}));

describe("pinned scroll example section", () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    scrollSectionProps.length = 0;
    targetProps.length = 0;
    for (const root of roots.splice(0)) {
      act(() => {
        root.unmount();
      });
    }
    document.body.replaceChildren();
  });

  test("uses adapter progress without a scene gate or dynamic effect mutation", async () => {
    const { PinnedScrollExample } = await import("./PinnedScrollExample");
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    roots.push(root);

    await act(async () => {
      root.render(createElement(PinnedScrollExample));
    });

    expect(scrollSectionProps).toHaveLength(1);
    expect(scrollSectionProps[0]).toMatchObject({
      className: "example-row example-pinned-row",
      end: "+=140%",
      pin: true,
      progressKey: "example.pinned.reveal",
      scrub: true,
      start: "top top",
    });
    expect(targetProps).toHaveLength(1);
    expect(targetProps[0]?.webgl).toMatchObject({
      key: "example.pinned.reveal",
      source: { kind: "dom", type: "text" },
      effects: [
        {
          kind: "example.pinnedReveal",
          progressKey: "example.pinned.reveal",
        },
      ],
    });
    expect(targetProps[0]?.webgl.scroll?.type).not.toBe("gate");
    expect(host.querySelector(".example-pinned-text")?.textContent).toContain(
      "滚动控制文字",
    );
    expect(host.querySelector(".example-pinned-row")?.nextElementSibling).toBe(
      host.querySelector('[data-scroll-runway="post-pinned"]'),
    );

    const firstEffects = targetProps[0]?.webgl.effects;
    await act(async () => {
      root.render(createElement(PinnedScrollExample));
    });

    expect(targetProps.at(-1)?.webgl.effects).toBe(firstEffects);
  });

  test("keeps pinned WebGL rows transparent so runtime-rendered content is visible", () => {
    const css = readFileSync("apps/example/src/example.css", "utf8");

    expect(css).toContain(".example-pinned-row");
    expect(css).toMatch(
      /\.example-pinned-row \{\n  min-height: 100vh;\n  background: transparent;\n\}/,
    );
    expect(css).toMatch(
      /\.example-video-scrub-row \{\n  z-index: 30;\n  min-height: 100vh;\n  background: transparent;\n\}/,
    );
    expect(css).toMatch(
      /\.example-media-sequence \{\n  display: block;\n  position: relative;\n  overflow: hidden;\n  background: transparent;\n\}/,
    );
    expect(css).toMatch(/\.example-sequence-card \{/);
    expect(css).toMatch(/\.example-stack \{\n  display: block;\n\}/);
    expect(css).not.toContain(".example-pinned-row {\n  min-height: 100vh;\n  background: var(--color-surface-primary);");
    expect(css).not.toContain(".example-video-scrub-row {\n  z-index: 30;\n  min-height: 100vh;\n  background: var(--color-surface-video-bg);");
    expect(css).not.toContain(".example-stack {\n  display: flex;");
  });
});
