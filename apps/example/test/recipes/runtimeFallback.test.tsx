import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { WebGLScrollRuntime } from "@viselora/scroll-adapters/react";
import { PaperReader } from "../../src/recipes/paper-reader/PaperReader";
import { ProjectRoom } from "../../src/recipes/project-room/ProjectRoom";
import type { ProjectRoomItems } from "../../src/recipes/project-room/types";

const renderer = vi.hoisted(() => ({
  ready: false,
  listeners: new Set<() => void>(),
  paperMounts: 0,
  roomMounts: 0,
}));

vi.mock("@viselora/dom-webgl/react", async () => {
  const React = await import("react");
  const runtime = {
    subscribe(listener: () => void) {
      renderer.listeners.add(listener);
      return () => renderer.listeners.delete(listener);
    },
    getDebugState: () => ({ ready: renderer.ready }),
  };
  return {
    useWebGLRuntime: () => runtime,
    WebGLRuntime: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});
vi.mock("@react-three/drei", async () => {
  const React = await import("react");
  return {
    View: ({ children, ...props }: React.ComponentProps<"div">) =>
      React.createElement("div", props, children),
    OrthographicCamera: () => null,
  };
});

// GPU allocation, resize and disposal are covered by the native scene tests.
// These two substitutes keep a prepared scene mounted during renderer failure.
vi.mock("../../src/recipes/paper-reader/PaperReaderSurface", async () => {
  const React = await import("react");
  return {
    PaperReaderSurface: ({
      onReady,
    }: {
      onReady: (value: boolean) => void;
    }) => {
      React.useEffect(() => {
        renderer.paperMounts++;
        onReady(true);
        return () => onReady(false);
      }, [onReady]);
      return null;
    },
  };
});
vi.mock("../../src/recipes/project-room/ProjectRoomSurface", async () => {
  const React = await import("react");
  return {
    ProjectRoomSurface: ({
      room,
    }: {
      room: {
        publishFrame: (frame: { ready: boolean; settled: boolean }) => void;
      };
    }) => {
      React.useEffect(() => {
        renderer.roomMounts++;
        room.publishFrame({ ready: true, settled: true });
        return () => room.publishFrame({ ready: false, settled: true });
      }, [room]);
      return null;
    },
  };
});

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  renderer.ready = false;
  renderer.paperMounts = 0;
  renderer.roomMounts = 0;
  renderer.listeners.clear();
});
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

test("prepared recipes restore complete DOM content on renderer loss and recover without remounting scenes", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const items = [
    { id: "one", label: "A", title: "One", description: "First", href: "/one" },
    {
      id: "two",
      label: "B",
      title: "Two",
      description: "Second",
      href: "/two",
    },
    {
      id: "three",
      label: "C",
      title: "Three",
      description: "Third",
      href: "/three",
    },
    {
      id: "four",
      label: "D",
      title: "Four",
      description: "Fourth",
      href: "/four",
    },
  ] satisfies ProjectRoomItems;
  await act(() =>
    root.render(
      createElement(
        WebGLScrollRuntime,
        null,
        createElement(PaperReader, {
          id: "paper",
          articles: [
            {
              id: "first",
              label: "01",
              title: "A note",
              body: "Complete article.",
            },
          ],
        }),
        createElement(ProjectRoom, { id: "room", items }),
      ),
    ),
  );
  const paper = host.querySelector<HTMLElement>(".paper-reader__fallback")!;
  const room = host.querySelector<HTMLElement>(".recipe-room__fallback")!;
  expect(paper.hidden).toBe(false);
  expect(room.hidden).toBe(false);
  const available = async (value: boolean) =>
    act(() => {
      renderer.ready = value;
      for (const listener of renderer.listeners) listener();
    });
  await available(true);
  expect(paper.hidden).toBe(true);
  expect(room.hidden).toBe(true);
  await available(false);
  expect(paper.hidden).toBe(false);
  expect(paper.textContent).toContain("Complete article.");
  expect(room.hidden).toBe(false);
  expect(room.querySelectorAll("a")).toHaveLength(4);
  await available(true);
  expect(paper.hidden).toBe(true);
  expect(room.hidden).toBe(true);
  expect(renderer.paperMounts).toBe(1);
  expect(renderer.roomMounts).toBe(1);
  await act(() => root.unmount());
  expect(renderer.listeners.size).toBe(0);
});
