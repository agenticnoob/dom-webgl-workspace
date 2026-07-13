import { createElement, type PropsWithChildren } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("@viselora/scroll-adapters/react", () => ({
  WebGLScrollRuntime: ({ children }: PropsWithChildren) =>
    createElement("div", null, children),
}));

vi.mock("../src/heroScroll", () => ({
  heroSmoothScroll: false,
}));

vi.mock("@viselora/dom-webgl/react", () => ({
  WebGLScene: ({ id, children }: PropsWithChildren<{ id: string }>) =>
    createElement("div", { "data-scene": id }, children),
  WebGLCamera: ({ id }: { id: string }) =>
    createElement("div", { "data-camera": id }),
  WebGLModel: ({ id, src }: { id: string; src: string }) =>
    createElement("div", { "data-model": id, "data-src": src }),
  WebGLLight: ({ id }: { id: string }) =>
    createElement("div", { "data-light": id }),
  WebGLTarget: ({
    webgl,
    className,
  }: {
    webgl: {
      key: string;
      placement?: { mode?: string; depth?: number };
      renderRole?: string;
      effects?: readonly { kind: string }[];
    };
    className?: string;
  }) =>
    createElement("div", {
      className,
      "data-target": webgl.key,
      "data-placement": webgl.placement?.mode,
      "data-depth": webgl.placement?.depth,
      "data-render-role": webgl.renderRole,
      "data-effect": webgl.effects?.[0]?.kind,
    }),
}));

import { HeroExperience } from "../src/HeroExperience";

describe("HeroExperience", () => {
  test("declares one managed scene with ordered Ghost Cursor depths", () => {
    const html = renderToStaticMarkup(createElement(HeroExperience));

    expect(html.match(/data-scene=/g)).toHaveLength(1);
    expect(html).toContain('data-scene="hero.tetrahedron.scene"');
    expect(html).toContain('data-target="hero.ghost.background"');
    expect(html).toContain('data-effect="hero.ghost.background"');
    expect(html).toContain('data-depth="5"');
    expect(html).toContain('data-model="hero.tetrahedron.model"');
    expect(html).toContain('data-src="/models/4.glb"');
    expect(html).toContain('data-target="hero.ghost.foreground"');
    expect(html).toContain('data-effect="hero.ghost.foreground"');
    expect(html).toContain('data-depth="2"');
    expect(html.match(/data-placement="screen-depth"/g)).toHaveLength(2);
    expect(html.match(/data-render-role="model"/g)).toHaveLength(2);
    expect(html.match(/data-light=/g)).toHaveLength(3);
    expect(html).not.toContain("Boo!");
    expect(html).not.toMatch(/<h[1-6]|<p|<button|<nav|<a /);
  });
});
