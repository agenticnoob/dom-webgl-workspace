import { createElement } from "react";
import { create } from "@react-three/test-renderer";
import { extend } from "@react-three/fiber";
import * as THREE from "three";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ProjectRoomSurface } from "../../src/recipes/project-room/ProjectRoomSurface";
import { createProjectRoomStore } from "../../src/recipes/project-room/room";
import { defaultProjectRoomPalette } from "../../src/recipes/project-room/program";
import type { ProjectRoomItems } from "../../src/recipes/project-room/types";
import { installCanvasContext } from "../canvasContext";

const items = [
  { id: "one", label: "A", title: "One", description: "First", href: "/one" },
  { id: "two", label: "B", title: "Two", description: "Second", href: "/two" },
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

beforeEach(() => {
  extend({
    Mesh: THREE.Mesh,
    PlaneGeometry: THREE.PlaneGeometry,
    MeshBasicMaterial: THREE.MeshBasicMaterial,
  });
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  installCanvasContext();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test("native room picking rearms at center, resizes with its DOM View and releases its atlas", async () => {
  const removeListener = vi.fn();
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    matches: query.includes("pointer: fine"),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: removeListener,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: () => true,
  }));
  const room = createProjectRoomStore();
  const props = { items, palette: defaultProjectRoomPalette, room };
  const renderer = await create(
    createElement(ProjectRoomSurface, {
      ...props,
      viewport: { width: 900, height: 640 },
    }),
    { width: 1440, height: 900 },
  );
  const node = renderer.scene.findByType("Mesh");
  const mesh = node.instance as THREE.Mesh<
    THREE.PlaneGeometry,
    THREE.ShaderMaterial
  >;
  const material = mesh.material;
  const atlas = material.uniforms.inkAtlas.value as THREE.Texture;
  const disposeMaterial = vi.spyOn(material, "dispose");
  const disposeAtlas = vi.spyOn(atlas, "dispose");
  await renderer.advanceFrames(1, 1 / 60);
  expect(room.getSnapshot().ready).toBe(true);
  expect(material.uniforms.viewport.value).toEqual([900, 640]);
  await renderer.fireEvent(node, "pointerMove", { uv: { x: 0.5, y: 0.5 } });
  await renderer.advanceFrames(1, 1 / 60);
  await renderer.fireEvent(node, "pointerMove", { uv: { x: 0.99, y: 0.5 } });
  await renderer.advanceFrames(3, 1 / 60);
  expect(room.getSnapshot().selected).toBe(1);
  expect(material.uniforms.view.value[0]).toBeGreaterThan(0);
  await renderer.fireEvent(node, "pointerMove", { uv: { x: 0.5, y: 0.5 } });
  await renderer.advanceFrames(1, 1 / 60);
  await renderer.fireEvent(node, "pointerMove", { uv: { x: 0.01, y: 0.5 } });
  await renderer.advanceFrames(1, 1 / 60);
  expect(room.getSnapshot().selected).toBe(0);
  await renderer.update(
    createElement(ProjectRoomSurface, {
      ...props,
      viewport: { width: 390, height: 640 },
    }),
  );
  await renderer.advanceFrames(1, 1 / 60);
  expect(mesh.visible).toBe(false);
  expect(room.getSnapshot().ready).toBe(false);
  expect(disposeAtlas).not.toHaveBeenCalled();
  await renderer.update(
    createElement(ProjectRoomSurface, {
      ...props,
      viewport: { width: 800, height: 680 },
    }),
  );
  await renderer.advanceFrames(1, 1 / 60);
  expect(material.uniforms.viewport.value).toEqual([800, 680]);
  expect(room.getSnapshot().ready).toBe(true);
  await renderer.unmount();
  expect(disposeMaterial).toHaveBeenCalledTimes(1);
  expect(disposeAtlas).toHaveBeenCalledTimes(1);
  expect(removeListener).toHaveBeenCalledTimes(2);
  expect(room.getSnapshot().ready).toBe(false);
});
