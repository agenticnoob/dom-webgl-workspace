import {
  act,
  createElement,
  type HTMLAttributes,
  type PropsWithChildren,
} from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { HeroAxiomsChapterBody } from "../src/axioms/HeroAxiomsReader";
import { getAxiomsContent } from "../src/axioms/content";
import { resolveAxiomsScrollHeight } from "../src/axioms/config";
import { heroChapterDefinitions } from "../src/chapters/definitions";

vi.mock("@viselora/scroll-adapters/react", () => ({
  WebGLScrollTimeline: ({
    children,
    className,
    style,
  }: PropsWithChildren<HTMLAttributes<HTMLElement>>) =>
    createElement("section", { className, style }, children),
}));

describe("axioms semantic React composition", () => {
  beforeEach(() => vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true));
  afterEach(() => vi.unstubAllGlobals());
  test("derives runway height from props and preserves article nodes across reordering and translation", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const zh = getAxiomsContent("zh");
    const en = getAxiomsContent("en");
    const render = (content: typeof zh) =>
      act(() =>
        root.render(
          createElement(HeroAxiomsChapterBody, {
            definition: heroChapterDefinitions.axioms,
            content,
          }),
        ),
      );
    try {
      await render(zh);
      const selector = `[data-axioms-article="${zh.body.sections[0].id}"]`;
      const original = host.querySelector(selector);
      expect(original).not.toBeNull();
      expect(
        host
          .querySelector<HTMLElement>(".hero-axioms")
          ?.style.getPropertyValue("--axioms-scroll-height"),
      ).toBe(`${resolveAxiomsScrollHeight(zh.body.sections.length)}svh`);
      await render({
        ...en,
        body: { ...en.body, sections: [...en.body.sections].reverse() },
      });
      expect(host.querySelector(selector)).toBe(original);
      expect(original?.textContent).toContain(en.body.sections[0].title);
      await render({
        ...en,
        body: { ...en.body, sections: [en.body.sections[0]] },
      });
      expect(host.querySelectorAll("article")).toHaveLength(1);
      expect(
        host
          .querySelector<HTMLElement>(".hero-axioms")
          ?.style.getPropertyValue("--axioms-scroll-height"),
      ).toBe("190svh");
      await render({ ...en, body: { ...en.body, sections: [] } });
      expect(host.querySelectorAll("article")).toHaveLength(0);
      expect(host.querySelector("h2")?.textContent).toBe(en.body.title);
    } finally {
      await act(() => root.unmount());
      host.remove();
    }
  });
});
