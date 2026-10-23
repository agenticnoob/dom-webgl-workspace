import { Object3D, OrthographicCamera, PerspectiveCamera } from "three";

import { sphereShape, textShape } from "../src/showcase/ParticleForm";
import {
  initialShowcaseLayout,
  measureShowcaseLayout,
  showcaseChapterAt,
  showcaseChapters,
} from "../src/showcase/showcaseLayout";
import { clamp01, coverRect, damp } from "../src/showcase/screenSpace";

describe("showcase screen space", () => {
  const viewport = { width: 1000, height: 500 };
  const camera = () => {
    const created = new PerspectiveCamera(90, 2, 0.1, 100);
    created.updateMatrixWorld();
    return created;
  };

  it("covers the whole viewport one unit in front of the camera", () => {
    const plane = new Object3D();
    expect(coverRect(plane, camera(), { left: 0, top: 0, width: 1000, height: 500 }, viewport)).toBe(true);
    expect(plane.position.x).toBeCloseTo(0);
    expect(plane.position.y).toBeCloseTo(0);
    expect(plane.position.z).toBeCloseTo(-1);
    expect(plane.scale.x).toBeCloseTo(4);
    expect(plane.scale.y).toBeCloseTo(2);
  });

  it("maps a CSS rect to the matching part of the view", () => {
    const plane = new Object3D();
    coverRect(plane, camera(), { left: 0, top: 0, width: 500, height: 250 }, viewport);
    expect(plane.position.x).toBeCloseTo(-1);
    expect(plane.position.y).toBeCloseTo(0.5);
    expect(plane.scale.x).toBeCloseTo(2);
    expect(plane.scale.y).toBeCloseTo(1);
  });

  it("follows a moved and turned camera", () => {
    const moved = camera();
    moved.position.set(0, 0, 10);
    moved.rotation.y = Math.PI / 2;
    moved.updateMatrixWorld();
    const plane = new Object3D();
    coverRect(plane, moved, { left: 0, top: 0, width: 1000, height: 500 }, viewport);
    expect(plane.position.x).toBeCloseTo(-1);
    expect(plane.position.z).toBeCloseTo(10);
    expect(plane.quaternion.equals(moved.quaternion)).toBe(true);
  });

  it("rejects non-perspective cameras", () => {
    expect(coverRect(new Object3D(), new OrthographicCamera(), { left: 0, top: 0, width: 1, height: 1 }, viewport)).toBe(false);
  });

  it("damps toward a goal independent of frame rate", () => {
    expect(damp(0, 1, 0, 0.016)).toBe(1);
    const once = damp(0, 1, 0.2, 0.032);
    const twice = damp(damp(0, 1, 0.2, 0.016), 1, 0.2, 0.016);
    expect(once).toBeCloseTo(twice);
    expect(clamp01(1.4)).toBe(1);
    expect(clamp01(-1)).toBe(0);
  });
});

describe("showcase layout", () => {
  it("starts chapters when a block's top reaches the middle of the viewport", () => {
    const layout = measureShowcaseLayout(
      { intro: 0, form: 1000, gallery: 3000, product: 5000, outro: 8000 },
      8000,
      9000,
      1000,
    );
    expect(layout.starts).toEqual([0, 0.0625, 0.3125, 0.5625, 0.9375]);
    expect(layout.form).toEqual({ key: "showcase", from: 0, to: 0.3125 });
    expect(layout.product).toEqual({ key: "showcase", from: 0.5625, to: 0.875 });
    expect(layout.boundaries).toEqual([0.3125, 0.5625]);
  });

  it("names the chapter for any progress", () => {
    expect(initialShowcaseLayout.starts).toHaveLength(showcaseChapters.length);
    expect(showcaseChapterAt(initialShowcaseLayout, 0)).toBe(0);
    expect(showcaseChapterAt(initialShowcaseLayout, 0.5)).toBe(2);
    expect(showcaseChapterAt(initialShowcaseLayout, 1)).toBe(4);
  });
});

describe("particle shapes", () => {
  const random = () => 0.5;
  const runtime = { getTarget: () => undefined };

  it("samples sphere points on the requested radius", () => {
    const points = sphereShape(2)(10, random, runtime);
    expect(points).toHaveLength(30);
    const radius = Math.hypot(points[0], points[1], points[2]);
    expect(radius).toBeGreaterThan(1.8);
    expect(radius).toBeLessThanOrEqual(2);
  });

  it("falls back to a sphere when the text target is missing", () => {
    const points = textShape("missing")(12, random, runtime);
    expect(points).toHaveLength(36);
    expect(Math.hypot(points[0], points[1], points[2])).toBeGreaterThan(2);
  });
});
