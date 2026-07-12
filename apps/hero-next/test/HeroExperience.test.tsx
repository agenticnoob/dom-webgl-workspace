import { createElement, type PropsWithChildren } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("@viselora/scroll-adapters/react", () => ({
  WebGLScrollRuntime: ({ children }: PropsWithChildren) =>
    createElement("div", null, children),
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
}));

import { HeroExperience } from "../src/HeroExperience";

describe("HeroExperience", () => {
  test("declares one explicit managed tetrahedron scene without visible copy", () => {
    const html = renderToStaticMarkup(createElement(HeroExperience));

    expect(html).toContain('data-scene="hero.tetrahedron.scene"');
    expect(html.match(/data-scene=/g)).toHaveLength(1);
    expect(html).toContain('data-camera="hero.tetrahedron.camera"');
    expect(html).toContain('data-model="hero.tetrahedron.model"');
    expect(html).toContain('data-src="/models/4.glb"');
    expect(html.match(/data-light=/g)).toHaveLength(3);
    expect(html).not.toMatch(/<h[1-6]|<p|<button|<nav|<a /);
  });
});
