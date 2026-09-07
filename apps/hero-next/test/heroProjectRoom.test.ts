import { describe, expect, test, vi } from "vitest";
import {
  createProjectRoomStore,
  projectRoomPoint,
  resolveRoomTurn,
  roomInteractionWeight,
  stepRoomAngle,
  wrapRoomAngle,
} from "../src/projects/room";

describe("project room navigation", () => {
  test("requires a rearmed edge gesture and protects the utility area", () => {
    expect(resolveRoomTurn(0.95, 0, true)).toBe(1);
    expect(resolveRoomTurn(-0.95, 0, true)).toBe(-1);
    expect(resolveRoomTurn(0.95, 0, false)).toBe(0);
    expect(resolveRoomTurn(0.4, 0, true)).toBe(0);
    expect(resolveRoomTurn(0.95, 0.9, true)).toBe(0);
    expect(resolveRoomTurn(-0.95, -0.9, true)).toBe(0);
  });
  test("wraps through all four walls and turns along the shortest arc", () => {
    const room = createProjectRoomStore();
    for (const index of [1, 2, 3, 4, -1]) {
      room.select(index);
      expect(room.getSnapshot().selected).toBe(((index % 4) + 4) % 4);
    }
    const start = -Math.PI / 2;
    const next = stepRoomAngle(start, 0, 16, false);
    expect(next).toBeGreaterThan(start);
    expect(next).toBeLessThan(0);
    expect(stepRoomAngle(0, (3 * Math.PI) / 2, 16, false)).toBeLessThan(0);
    let yaw = 0;
    for (let i = 0; i < 120; i++) yaw = stepRoomAngle(yaw, Math.PI, 16, false);
    expect(Math.abs(wrapRoomAngle(Math.PI - yaw))).toBeLessThan(0.0001);
  });
  test("removes interpolation under reduced motion and bounds suspended-frame delta", () => {
    expect(stepRoomAngle(0, Math.PI, 16, true)).toBe(Math.PI);
    expect(stepRoomAngle(0, Math.PI, 0, false)).toBe(0);
    expect(stepRoomAngle(0, Math.PI, 6000, false)).toBe(
      stepRoomAngle(0, Math.PI, 64, false),
    );
  });
  test("returns to the same atlas view at both scroll endpoints in either direction", () => {
    expect(roomInteractionWeight(0)).toBe(0);
    expect(roomInteractionWeight(1)).toBe(0);
    expect(roomInteractionWeight(0.5)).toBe(1);
    const forward = [0, 0.06, 0.2, 0.5, 0.8, 0.94, 1].map(
      roomInteractionWeight,
    );
    const backward = [1, 0.94, 0.8, 0.5, 0.2, 0.06, 0]
      .map(roomInteractionWeight)
      .reverse();
    expect(backward).toEqual(forward);
  });
  test("publishes only semantic changes and independently protects hover and keyboard focus", () => {
    const room = createProjectRoomStore();
    const listener = vi.fn();
    const unsubscribe = room.subscribe(listener);
    room.publishFrame({ ready: true, active: true, settled: true });
    for (let i = 0; i < 50; i++)
      room.publishFrame({ ready: true, active: true, settled: true });
    expect(listener).toHaveBeenCalledTimes(1);
    room.setHovered(true);
    room.setFocused(true);
    room.setHovered(false);
    expect(room.pointerLocked()).toBe(true);
    room.setFocused(false);
    expect(room.pointerLocked()).toBe(false);
    unsubscribe();
    room.select(1);
    expect(listener).toHaveBeenCalledTimes(1);
  });
  test("projects the front wall symmetrically within the desktop viewport", () => {
    const viewport = { width: 1440, height: 900 };
    expect(projectRoomPoint(viewport, 0, 0, -3)).toEqual([720, 450]);
    expect(projectRoomPoint(viewport, -3, 1.8, -3)).toEqual([220, 150]);
    expect(projectRoomPoint(viewport, 3, -1.8, -3)).toEqual([1220, 750]);
  });
});
