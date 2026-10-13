import * as THREE from "three";
import { createElement } from "react";
import { create } from "@react-three/test-renderer";
import { describe, expect, test, vi } from "vitest";
import {
  readWalkCycleTime,
  WalkingModel,
} from "../src/ManagedModelAnimationExample";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
  configurable: true,
  value: true,
});
const progress = vi.hoisted(() => ({ value: 0 }));
vi.mock("@viselora/scroll-adapters/react", () => ({
  WebGLScrollTimeline: () => null,
  useScrollEffectProgressStore: () => ({
    source: { get: () => progress.value },
  }),
}));
vi.mock("../src/useClonedModel", () => {
  const scene = new THREE.Group();
  const hip = new THREE.Object3D();
  hip.name = "hip";
  scene.add(hip);
  const animations = [
    new THREE.AnimationClip("WalkCycle", 2.4, [
      new THREE.NumberKeyframeTrack("hip.position[x]", [0, 2.4], [0, 10]),
    ]),
  ];
  return { useClonedModel: () => ({ scene, animations }) };
});

describe("native WalkCycle scroll scrub", () => {
  test("holds the clip before and after its active pinned interval", () => {
    expect(readWalkCycleTime(0)).toBe(0);
    expect(readWalkCycleTime(0.08)).toBe(0);
    expect(readWalkCycleTime(0.92)).toBeCloseTo(2.4);
    expect(readWalkCycleTime(1)).toBe(2.4);
  });
  test("scrubs reversibly without accumulating mixer time", () => {
    const forward = [0.08, 0.29, 0.5, 0.71, 0.92].map((value) =>
      readWalkCycleTime(value),
    );
    expect(forward).toEqual([
      0,
      expect.closeTo(0.6),
      expect.closeTo(1.2),
      expect.closeTo(1.8),
      expect.closeTo(2.4),
    ]);
    expect(
      [0.92, 0.71, 0.5, 0.29, 0.08]
        .map((value) => readWalkCycleTime(value))
        .reverse(),
    ).toEqual(forward);
  });
  test("samples a real Three.js AnimationMixer at the scroll pose, then reverses it", async () => {
    progress.value = 0.5;
    const renderer = await create(createElement(WalkingModel));
    const model = renderer.scene.findByProps({
      name: "example.managedModel.human",
    }).instance;
    const hip = model.getObjectByName("hip");
    if (!hip) throw new Error("Missing clip target");
    await renderer.advanceFrames(1, 1 / 60);
    expect(hip.position.x).toBeCloseTo(5);
    await renderer.advanceFrames(60, 1 / 60);
    expect(hip.position.x).toBeCloseTo(5);
    progress.value = 0.29;
    await renderer.advanceFrames(1, 1 / 60);
    expect(hip.position.x).toBeCloseTo(2.5);
    progress.value = 0.08;
    await renderer.advanceFrames(1, 1 / 60);
    expect(hip.position.x).toBe(0);
    await renderer.unmount();
  });
});
