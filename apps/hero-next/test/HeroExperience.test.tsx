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
  WebGLMesh: ({
    id,
    geometry,
    material,
    effects,
  }: {
    id: string;
    geometry: { kind: string; radius?: number };
    material?: {
      kind?: string;
      color?: string;
      emissive?: string;
      emissiveIntensity?: number;
      metalness?: number;
      roughness?: number;
    };
    effects?: readonly { kind: string; baseScale?: number }[];
  }) =>
    createElement("div", {
      "data-mesh": id,
      "data-geometry": geometry.kind,
      "data-radius": geometry.radius,
      "data-material": material?.kind,
      "data-color": material?.color,
      "data-emissive": material?.emissive,
      "data-emissive-intensity": material?.emissiveIntensity,
      "data-metalness": material?.metalness,
      "data-roughness": material?.roughness,
      "data-mesh-effect": effects?.[0]?.kind,
      "data-base-scale": effects?.[0]?.baseScale,
    }),
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
      effects?: readonly {
        kind: string;
        depth?: number;
        fov?: number;
        overscan?: number;
      }[];
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
      "data-effect-depth": webgl.effects?.[0]?.depth,
      "data-effect-fov": webgl.effects?.[0]?.fov,
      "data-effect-overscan": webgl.effects?.[0]?.overscan,
    }),
}));

import { HeroExperience } from "../src/HeroExperience";

describe("HeroExperience", () => {
  test("declares one managed scene with background Ghost Cursor only", () => {
    const html = renderToStaticMarkup(createElement(HeroExperience));

    expect(html.match(/data-scene=/g)).toHaveLength(1);
    expect(html).toContain('data-scene="hero.tetrahedron.scene"');
    expect(html).toContain('data-target="hero.ghost.background"');
    expect(html).toContain('data-effect="hero.ghost.background"');
    expect(html).toContain('data-depth="5"');
    expect(html).toContain('data-effect-depth="5"');
    expect(html).toContain('data-effect-fov="38"');
    expect(html).toContain('data-effect-overscan="1.06"');
    expect(html).toContain('data-mesh="hero.tetrahedron.mesh"');
    expect(html).toContain('data-geometry="tetrahedron"');
    expect(html).toContain('data-radius="0.52"');
    expect(html).toContain('data-material="standard"');
    expect(html).toContain('data-color="#30343b"');
    expect(html).toContain('data-emissive="#0d0a12"');
    expect(html).toContain('data-emissive-intensity="0.06"');
    expect(html).toContain('data-metalness="0.9"');
    expect(html).toContain('data-roughness="0.12"');
    expect(html).toContain('data-mesh-effect="hero.tetrahedron.motion"');
    expect(html).toContain('data-base-scale="1.12"');
    expect(html).not.toContain('data-target="hero.ghost.foreground"');
    expect(html).not.toContain('data-effect="hero.ghost.foreground"');
    expect(html.match(/data-placement="screen-depth"/g)).toHaveLength(1);
    expect(html.match(/data-render-role="model"/g)).toHaveLength(1);
    expect(html.match(/data-light=/g)).toHaveLength(3);
    expect(html).not.toContain("Boo!");
    expect(html).not.toMatch(/<h[1-6]|<p|<button|<nav|<a /);
  });
});
