// @vitest-environment node
import React from "react";
import { renderToString } from "react-dom/server";
import { expect, it } from "vitest";
import { WebGLScrollRuntime } from "@viselora/scroll-adapters/react";
import {
  FacePortal,
  InteractiveSculpture,
  spatialEffects,
  type FourFaces,
  type PortalChapter,
} from "../../src/recipes/spatial";

const chapters = [
  { id: "a", entry: { label: "First", title: "A", description: "Entry A" } },
  { id: "b", entry: { label: "Second", title: "B", description: "Entry B" } },
  { id: "c", entry: { label: "Third", title: "C", description: "Entry C" } },
  {
    id: "d",
    entry: { label: "Fourth", title: "D", description: "Entry D" },
    link: { href: "/more", label: "Read more" },
  },
] satisfies FourFaces<PortalChapter>;

it("renders every chapter and its native link before any browser or GPU exists", () => {
  const html = renderToString(
    <WebGLScrollRuntime effects={spatialEffects}>
      <FacePortal id="ssr.portal" chapters={chapters} />
    </WebGLScrollRuntime>,
  );
  for (const chapter of chapters)
    expect(html).toContain(chapter.entry.description);
  expect(html).toContain('href="/more"');
  expect(html).toContain('data-ready="false"');
  expect(html).not.toContain("<canvas");
});

it("keeps sculpture copy and a native button available without WebGL", () => {
  const html = renderToString(
    <WebGLScrollRuntime effects={spatialEffects}>
      <InteractiveSculpture
        id="ssr.sculpture"
        title="Explore this form"
        holdMs={900}
      />
    </WebGLScrollRuntime>,
  );
  expect(html).toContain("Explore this form");
  expect(html).toContain('type="button"');
  expect(html).not.toContain("<canvas");
});

it("rejects invalid configuration before registering any managed objects", () => {
  expect(() =>
    renderToString(
      <WebGLScrollRuntime effects={spatialEffects}>
        <InteractiveSculpture id="bad" title="Bad" holdMs={0} />
      </WebGLScrollRuntime>,
    ),
  ).toThrow("holdMs");
  expect(() =>
    renderToString(
      <WebGLScrollRuntime effects={spatialEffects}>
        <FacePortal
          id="bad"
          chapters={[chapters[0], chapters[0], chapters[2], chapters[3]]}
        />
      </WebGLScrollRuntime>,
    ),
  ).toThrow("unique ids");
});
