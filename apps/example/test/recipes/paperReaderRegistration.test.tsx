import { act, createElement, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { WebGLScrollRuntime } from "@viselora/scroll-adapters/react";
import { PaperReader } from "../../src/recipes/paper-reader";

const articles = [
  {
    id: "first",
    label: "01",
    title: "An observation",
    body: "Keep the whole note.",
  },
];
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe("paper reader native View composition", () => {
  test("two readers share one host and release their DOM Views in StrictMode", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(() =>
      root.render(
        createElement(
          StrictMode,
          null,
          createElement(
            WebGLScrollRuntime,
            null,
            createElement(PaperReader, { id: "one", articles }),
            createElement(PaperReader, { id: "two", articles }),
          ),
        ),
      ),
    );
    expect(host.querySelectorAll("canvas")).toHaveLength(1);
    expect(host.querySelectorAll(".paper-reader__viewport")).toHaveLength(2);
    expect(host.querySelectorAll("article")).toHaveLength(2);
    expect(
      Array.from(host.querySelectorAll(".paper-reader__viewport"), (e) => e.id),
    ).toEqual(["one.paper-reader.viewport", "two.paper-reader.viewport"]);
    await act(() => root.unmount());
    expect(host.childElementCount).toBe(0);
  });
  test("content remounts together and reduced motion restores ordinary text", async () => {
    const events = new EventTarget();
    let reduced = false;
    vi.spyOn(window, "matchMedia").mockReturnValue({
      get matches() {
        return reduced;
      },
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: events.addEventListener.bind(events),
      removeEventListener: events.removeEventListener.bind(events),
      dispatchEvent: events.dispatchEvent.bind(events),
    });
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const render = (next: typeof articles) =>
      createElement(
        WebGLScrollRuntime,
        null,
        createElement(PaperReader, {
          id: "notes",
          articles: next,
          height: 640,
        }),
      );
    await act(() => root.render(render(articles)));
    const first = host.querySelector(".paper-reader__viewport");
    await act(() =>
      root.render(
        render([
          { ...articles[0], body: "The revised note." },
          {
            id: "second",
            label: "02",
            title: "An experiment",
            body: "Try it.",
          },
        ]),
      ),
    );
    expect(host.querySelector(".paper-reader__viewport")).not.toBe(first);
    expect(host.querySelectorAll("article")).toHaveLength(2);
    expect(host.textContent).toContain("The revised note.");
    expect(
      host
        .querySelector<HTMLElement>(".paper-reader")
        ?.style.getPropertyValue("--paper-reader-stage-height"),
    ).toBe("640px");
    await act(() => {
      reduced = true;
      events.dispatchEvent(new Event("change"));
    });
    expect(host.querySelector(".paper-reader__stage")).toBeNull();
    expect(
      host.querySelector(".paper-reader__fallback")?.hasAttribute("hidden"),
    ).toBe(false);
    expect(host.textContent).toContain("The revised note.");
    await act(() => root.unmount());
  });
});
