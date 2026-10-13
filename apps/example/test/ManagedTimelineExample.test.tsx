import { PerspectiveCamera, Vector3 } from "three";
import { describe, expect, test } from "vitest";
import { applyTimelineCamera } from "../src/ManagedTimelineExample";

describe("native timeline camera", () => {
  test("preserves both poses, field of view and bounded timeline range", () => {
    const camera = new PerspectiveCamera();
    applyTimelineCamera(camera, 0);
    expect(camera.position.toArray()).toEqual([0, 136, 560]);
    expect(camera.fov).toBe(42);
    expect(
      camera
        .getWorldDirection(new Vector3())
        .distanceTo(new Vector3(0, -224, -600).normalize()),
    ).toBeLessThan(0.0001);
    applyTimelineCamera(camera, 1);
    expect(camera.position.toArray()).toEqual([0, 96, 520]);
    expect(camera.fov).toBe(34);
    expect(
      camera
        .getWorldDirection(new Vector3())
        .distanceTo(new Vector3(0, -60, -520).normalize()),
    ).toBeLessThan(0.0001);
  });
  test("smoothly traverses and reverses the same camera path", () => {
    const camera = new PerspectiveCamera();
    applyTimelineCamera(camera, 0.5);
    const middle = camera.position.clone();
    const projection = camera.projectionMatrix.clone();
    expect(middle.toArray()).toEqual([0, 116, 540]);
    expect(camera.fov).toBe(38);
    applyTimelineCamera(camera, 0.7);
    applyTimelineCamera(camera, 0.5);
    expect(camera.position.equals(middle)).toBe(true);
    expect(camera.projectionMatrix.equals(projection)).toBe(true);
  });
});
