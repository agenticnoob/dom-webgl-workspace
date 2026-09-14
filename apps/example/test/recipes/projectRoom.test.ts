import { describe, expect, test, vi } from "vitest";
import { wrapRoomText } from "../../src/recipes/project-room/artwork";
import { fitProjectRoomSurface } from "../../src/recipes/project-room/effect";
import { createProjectRoomDeclaration } from "../../src/recipes/project-room/ProjectRoom";
import {
  defaultProjectRoomPalette,
  projectRoomColors,
} from "../../src/recipes/project-room/program";
import {
  createProjectRoomStore,
  resolveRoomTurn,
  stepRoomAngle,
  validateProjectRoomItems,
  wrapRoomAngle,
} from "../../src/recipes/project-room/room";
import type { ProjectRoomItems } from "../../src/recipes/project-room";

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

describe("project room recipe", () => {
  test("fills the screen-camera frustum before the pass maps it into an inset component", () => {
    const position = { x: 0, y: 0, z: 0, set: vi.fn() };
    const scale = { x: 1, y: 1, z: 1, set: vi.fn(), setScalar: vi.fn() };
    // Even a 700×520 DOM component uses the runtime's 1440×900 camera frame.
    fitProjectRoomSurface({ position, scale }, { width: 1440, height: 900 });
    expect(position.set).toHaveBeenCalledWith(720, 450, 0);
    expect(scale.set).toHaveBeenCalledWith(1440, 900, 1);
    fitProjectRoomSurface({ position, scale }, { width: 800, height: 600 });
    expect(position.set).toHaveBeenLastCalledWith(400, 300, 0);
    expect(scale.set).toHaveBeenLastCalledWith(800, 600, 1);
  });
  test("wraps exactly four walls and notifies only semantic changes", () => {
    const room = createProjectRoomStore();
    const listener = vi.fn();
    const unsubscribe = room.subscribe(listener);
    room.select(-1);
    expect(room.getSnapshot().selected).toBe(3);
    room.select(7);
    room.select(Number.NaN);
    room.select(0.5);
    expect(listener).toHaveBeenCalledTimes(1);
    room.publishFrame({ ready: true, settled: true });
    room.publishFrame({ ready: true, settled: true });
    expect(listener).toHaveBeenCalledTimes(2);
    room.setFocused(true);
    room.setHovered(true);
    room.setHovered(false);
    expect(room.pointerLocked()).toBe(true);
    room.setFocused(false);
    expect(room.pointerLocked()).toBe(false);
    unsubscribe();
    room.select(0);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  test("keeps instances independent and releases stale input locks on fallback/disposal", () => {
    const first = createProjectRoomStore();
    const second = createProjectRoomStore(2);
    first.select(3);
    first.setHovered(true);
    first.setFocused(true);
    expect(second.getSnapshot().selected).toBe(2);
    expect(second.pointerLocked()).toBe(false);
    first.publishFrame({ ready: false, settled: true });
    expect(first.pointerLocked()).toBe(false);
    first.publishFrame({ ready: true, settled: true });
    expect(first.getSnapshot().selected).toBe(3);
    expect(first.pointerLocked()).toBe(false);
  });

  test("requires a rearmed edge gesture and protects header/footer controls", () => {
    expect(resolveRoomTurn(0.95, 0, true)).toBe(1);
    expect(resolveRoomTurn(-0.95, 0, true)).toBe(-1);
    expect(resolveRoomTurn(0.95, 0, false)).toBe(0);
    expect(resolveRoomTurn(0.95, 0.9, true)).toBe(0);
    expect(resolveRoomTurn(-0.95, -0.9, true)).toBe(0);
    expect(resolveRoomTurn(0.4, 0, true)).toBe(0);
  });

  test("takes the shortest rotation and removes interpolation with reduced motion", () => {
    expect(stepRoomAngle(0, (3 * Math.PI) / 2, 16, false)).toBeLessThan(0);
    expect(stepRoomAngle(0, Math.PI, 16, true)).toBe(Math.PI);
    expect(stepRoomAngle(0, Math.PI, 0, false)).toBe(0);
    expect(stepRoomAngle(0, Math.PI, 10_000, false)).toBe(
      stepRoomAngle(0, Math.PI, 64, false),
    );
    let yaw = 0;
    for (let index = 0; index < 120; index++)
      yaw = stepRoomAngle(yaw, Math.PI, 16, false);
    expect(Math.abs(wrapRoomAngle(Math.PI - yaw))).toBeLessThan(0.0001);
  });

  test("validates author data and strict color values before creating declarations", () => {
    expect(() => validateProjectRoomItems(items)).not.toThrow();
    expect(() =>
      validateProjectRoomItems([items[0], items[0], items[2], items[3]]),
    ).toThrow("unique");
    expect(() =>
      validateProjectRoomItems([
        { ...items[0], href: " " },
        items[1],
        items[2],
        items[3],
      ]),
    ).toThrow("href");
    expect(
      projectRoomColors({ background: "#000000", foreground: "#FFFFFF" }),
    ).toEqual({ backgroundColor: [0, 0, 0], foregroundColor: [1, 1, 1] });
    expect(() =>
      projectRoomColors({ background: "red", foreground: "#ffffff" }),
    ).toThrow("#RRGGBB");
    const room = createProjectRoomStore();
    const declaration = createProjectRoomDeclaration("one.room", {
      items,
      room,
      palette: defaultProjectRoomPalette,
    });
    expect(declaration.key).toBe("one.room.surface");
    expect(declaration.pointer).toEqual({ hover: true });
    expect(declaration.effects?.[0]).toMatchObject({
      kind: "recipe.project-room",
      items,
      room,
    });
  });

  test("wraps long tokens, CJK and explicit paragraphs without dropping text", () => {
    const measure = {
      measureText: (text: string) => ({ width: Array.from(text).length * 10 }),
    };
    expect(wrapRoomText(measure, "alpha beta", 60)).toEqual(["alpha", "beta"]);
    expect(wrapRoomText(measure, "abcdefghij", 40)).toEqual([
      "abcd",
      "efgh",
      "ij",
    ]);
    expect(wrapRoomText(measure, "中文目录\n第二行", 30)).toEqual([
      "中文目",
      "录",
      "第二行",
    ]);
  });
});
