import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ProjectRoomControls } from "../../src/recipes/project-room/ProjectRoomControls";
import { createProjectRoomStore } from "../../src/recipes/project-room/room";
import type { ProjectRoomItems } from "../../src/recipes/project-room";

const items = [
  {
    id: "a",
    label: "A",
    title: "Archive",
    description: "Archive detail",
    href: "/archive",
  },
  {
    id: "b",
    label: "B",
    title: "Library",
    description: "Library detail",
    href: "/library",
  },
  {
    id: "c",
    label: "C",
    title: "Studio",
    description: "Studio detail",
    href: "/studio",
  },
  {
    id: "d",
    label: "D",
    title: "Garden",
    description: "Garden detail",
    href: "/garden",
  },
] satisfies ProjectRoomItems;
const labels = {
  hint: "Read the walls",
  navigation: "Projects",
  previous: "Previous",
  next: "Next",
  visit: "Visit",
};

beforeEach(() => vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true));
afterEach(() => vi.unstubAllGlobals());

test("keeps semantic fallback, supports keyboard selection and guards links while turning", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const room = createProjectRoomStore();
  try {
    await act(() =>
      root.render(
        createElement(ProjectRoomControls, {
          id: "test.room",
          items,
          title: "Room",
          labels,
          room,
        }),
      ),
    );
    const fallback = host.querySelector<HTMLElement>(".recipe-room__fallback");
    expect(fallback?.hidden).toBe(false);
    expect(fallback?.querySelectorAll("a")).toHaveLength(4);
    await act(() => room.publishFrame({ ready: true, settled: true }));
    expect(fallback?.hidden).toBe(true);
    const nav = host.querySelector("nav");
    expect(nav).not.toBeNull();
    await act(() =>
      nav?.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "End",
          bubbles: true,
          cancelable: true,
        }),
      ),
    );
    expect(room.getSnapshot().selected).toBe(3);
    expect(document.activeElement?.getAttribute("data-room-wall")).toBe("3");
    const link = host.querySelector<HTMLAnchorElement>(".recipe-room__visit");
    expect(link?.getAttribute("href")).toBe("/garden");
    expect(link?.tabIndex).toBe(-1);
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    await act(() => link?.dispatchEvent(click));
    expect(click.defaultPrevented).toBe(true);
    await act(() => room.publishFrame({ ready: true, settled: true }));
    expect(link?.tabIndex).toBe(0);
    expect(host.querySelector("[aria-live]")?.textContent).toContain(
      "Garden detail",
    );
    await act(() =>
      nav?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
      ),
    );
    expect(room.getSnapshot().selected).toBe(0);
    expect(document.activeElement?.getAttribute("data-room-wall")).toBe("0");
    await act(() =>
      room.publishFrame({
        ready: false,
        settled: true,
        error: "Text capacity exceeded",
      }),
    );
    expect(fallback?.hidden).toBe(false);
    expect(host.querySelector('[role="status"]')?.textContent).toBe(
      "Text capacity exceeded",
    );
  } finally {
    await act(() => root.unmount());
    host.remove();
  }
});
