import React, {
  act,
  createElement,
  type HTMLAttributes,
  type PropsWithChildren,
} from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { HeroProjectsChapterBody } from "../src/projects/HeroProjectRoom";
import { createProjectRoomStore } from "../src/projects/room";
import { getHeroChapterContent } from "../src/chapters/content";
import { heroChapterDefinitions } from "../src/chapters/definitions";

vi.mock("@viselora/scroll-adapters/react", () => ({
  WebGLScrollTimeline: ({
    children,
    className,
    ...props
  }: PropsWithChildren<HTMLAttributes<HTMLElement>>) =>
    createElement(
      "section",
      { className, "data-room-ready": Reflect.get(props, "data-room-ready") },
      children,
    ),
}));

describe("project room semantic interface", () => {
  beforeEach(() => vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true));
  afterEach(() => vi.unstubAllGlobals());
  test("keeps all four normal project links until the desktop renderer is ready", async () => {
    const host = document.createElement("div");
    const root = createRoot(host);
    const room = createProjectRoomStore();
    const onLayoutChange = vi.fn();
    try {
      await act(() =>
        root.render(
          createElement(HeroProjectsChapterBody, {
            definition: heroChapterDefinitions.builds,
            content: getHeroChapterContent("builds", "zh"),
            locale: "zh",
            room,
            onLayoutChange,
          }),
        ),
      );
      const links = Array.from(
        host.querySelectorAll<HTMLAnchorElement>(".hero-projects__content a"),
      );
      expect(links.map((link) => link.href)).toEqual([
        "https://github.com/AXMORF/axmorf-studio",
        "https://github.com/agenticnoob/dom-webgl-workspace",
        "https://github.com/agenticnoob/syringe-meter",
        "https://github.com/agenticnoob/vibe-journal-pipeline",
      ]);
      expect(links.every((link) => link.tabIndex === 0)).toBe(true);
      expect(
        host.querySelector<HTMLElement>(".hero-projects__controls")?.hidden,
      ).toBe(true);
      await act(() =>
        room.publishFrame({ ready: true, active: true, settled: true }),
      );
      expect(
        host.querySelector<HTMLElement>(".hero-projects__controls")?.hidden,
      ).toBe(false);
      expect(links.every((link) => link.tabIndex === -1)).toBe(true);
      const buttons = host.querySelectorAll<HTMLButtonElement>("nav button");
      await act(() => buttons[2].click());
      expect(room.getSnapshot().selected).toBe(2);
      expect(buttons[2].getAttribute("aria-pressed")).toBe("true");
      const source = host.querySelector<HTMLAnchorElement>(
        ".hero-projects__source",
      );
      expect(source?.href).toBe("https://github.com/agenticnoob/syringe-meter");
      expect(source?.tabIndex).toBe(-1);
      await act(() =>
        room.publishFrame({ ready: true, active: true, settled: true }),
      );
      expect(source?.tabIndex).toBe(0);
      await act(() =>
        room.publishFrame({ ready: false, active: false, settled: true }),
      );
      expect(links.every((link) => link.tabIndex === 0)).toBe(true);
      expect(
        host.querySelector<HTMLElement>(".hero-projects__controls")?.hidden,
      ).toBe(true);
      expect(onLayoutChange).toHaveBeenCalledTimes(3);
    } finally {
      await act(() => root.unmount());
    }
  });
});
