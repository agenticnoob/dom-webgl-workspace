import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WebGLScrollRuntime } from "@viselora/scroll-adapters/react";
import { expect, test } from "vitest";
import {
  PerspectiveTimeline,
  type PerspectiveTimelineProps,
} from "../../src/recipes/perspective-timeline";

const props = {
  id: "first",
  title: "Release history",
  description: "Every milestone",
  entries: Array.from({ length: 25 }, (_, i) => ({
    id: `v${i}`,
    label: `Version ${i}`,
    meta: `All tools ${i}`,
    body: `Complete event ${i}`,
  })),
  labels: { read: "Read all", resume: "Resume motion", empty: "No records" },
} satisfies PerspectiveTimelineProps;
const render = (overrides: Partial<PerspectiveTimelineProps> = {}) =>
  renderToStaticMarkup(
    createElement(WebGLScrollRuntime, {
      children: createElement(PerspectiveTimeline, { ...props, ...overrides }),
    }),
  );

test("SSR renders every complete semantic entry in caller order without a canvas dependency", () => {
  const html = render();
  const template = document.createElement("template");
  template.innerHTML = html;
  const entries = template.content.querySelectorAll("[data-timeline-entry]");
  expect(
    Array.from(entries, (entry) => entry.getAttribute("data-timeline-entry")),
  ).toEqual(props.entries.map((entry) => entry.id));
  for (const entry of props.entries) {
    expect(html).toContain(entry.meta);
    expect(html).toContain(entry.body);
  }
  expect(
    template.content.querySelector('[data-spatial="false"]'),
  ).not.toBeNull();
  expect(
    template.content.querySelectorAll("[data-timeline-panel]"),
  ).toHaveLength(0);
  expect(
    template.content.querySelectorAll("[data-webgl-runtime]"),
  ).toHaveLength(1);
});

test("empty input has a readable status and no scroll runway", () => {
  const html = render({ entries: [] });
  expect(html).toContain('role="status">No records');
  expect(html).toContain('data-spatial="false"');
});

test("rejects ambiguous entry identities before runtime registration", () => {
  expect(() => render({ id: " " })).toThrow("runtime-unique");
  expect(() =>
    render({ entries: [props.entries[0], props.entries[0]] }),
  ).toThrow("unique ids");
  expect(() => render({ entries: [{ ...props.entries[0], id: "" }] })).toThrow(
    "unique ids",
  );
});

test("two instances keep unique DOM IDs under the same runtime", () => {
  const html = renderToStaticMarkup(
    createElement(WebGLScrollRuntime, {
      children: [
        createElement(PerspectiveTimeline, { ...props, key: "first" }),
        createElement(PerspectiveTimeline, {
          ...props,
          id: "second",
          key: "second",
        }),
      ],
    }),
  );
  const template = document.createElement("template");
  template.innerHTML = html;
  const ids = Array.from(
    template.content.querySelectorAll("[id]"),
    (node) => node.id,
  );
  expect(new Set(ids).size).toBe(ids.length);
  expect(
    template.content.querySelectorAll("[data-webgl-runtime]"),
  ).toHaveLength(1);
});
