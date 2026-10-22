import { useFrame } from "@react-three/fiber";
import { create } from "@react-three/test-renderer";
import { act, createElement, useEffect, type ReactNode } from "react";
import { Group, Mesh, Object3D, type Intersection } from "three";
import { afterEach, describe, expect, it } from "vitest";

import { withDrawnHits, isDrawnInScene } from "../src/lib/drawnHits";
import { RuntimeContext } from "../src/lib/Runtime";
import { createRuntimeManager } from "../src/lib/runtimeManager";
import { WebGLSection, useSectionState, type WebGLSectionProps } from "../src/lib/Section";
import {
  nextSectionPhase,
  progressSectionMargins,
  rangeDistance,
  targetSectionMargins,
  viewportDistance,
} from "../src/lib/sectionPhase";

describe("section phase", () => {
  const rect = (top: number, height = 100) => ({
    left: 0,
    right: 100,
    top,
    bottom: top + height,
    width: 100,
    height,
  });
  const viewport = { width: 1000, height: 1000 };

  it("measures rect distance from the viewport in viewport sizes", () => {
    expect(viewportDistance(rect(200), viewport)).toBe(0);
    expect(viewportDistance(rect(1500), viewport)).toBe(0.5);
    expect(viewportDistance(rect(-2100), viewport)).toBe(2);
    expect(
      viewportDistance({ left: 3000, right: 3100, top: 0, bottom: 100, width: 100, height: 100 }, viewport),
    ).toBe(2);
    expect(viewportDistance({ left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 }, viewport)).toBeUndefined();
  });

  it("measures progress distance from a range in either direction", () => {
    expect(rangeDistance(0.5, 0.4, 0.6)).toBe(0);
    expect(rangeDistance(0.3, 0.4, 0.6)).toBeCloseTo(0.1);
    expect(rangeDistance(0.9, 0.6, 0.4)).toBeCloseTo(0.3);
  });

  it("chooses active, warm and sleep by margin", () => {
    expect(nextSectionPhase("sleep", 0.4, targetSectionMargins)).toBe("active");
    expect(nextSectionPhase("sleep", 1, targetSectionMargins)).toBe("warm");
    expect(nextSectionPhase("sleep", 2, targetSectionMargins)).toBe("sleep");
    expect(nextSectionPhase("active", undefined, targetSectionMargins)).toBe("sleep");
    expect(nextSectionPhase("active", Number.NaN, progressSectionMargins)).toBe("sleep");
  });

  it("keeps a phase within its hysteresis band", () => {
    expect(nextSectionPhase("active", 0.55, targetSectionMargins)).toBe("active");
    expect(nextSectionPhase("warm", 0.55, targetSectionMargins)).toBe("warm");
    expect(nextSectionPhase("warm", 1.55, targetSectionMargins)).toBe("warm");
    expect(nextSectionPhase("sleep", 1.55, targetSectionMargins)).toBe("sleep");
    expect(nextSectionPhase("active", 0.7, targetSectionMargins)).toBe("warm");
  });
});

describe("drawn hits", () => {
  it("drops intersections on objects with a hidden ancestor", () => {
    const parent = new Group();
    const shown = new Mesh();
    const hidden = new Mesh();
    const nested = new Group();
    nested.add(hidden);
    parent.add(shown, nested);
    nested.visible = false;
    expect(isDrawnInScene(shown)).toBe(true);
    expect(isDrawnInScene(hidden)).toBe(false);

    const hit = (object: Object3D) => ({ object, distance: 1 }) as Intersection;
    const manager = withDrawnHits({
      priority: 1,
      enabled: true,
      filter: (items) => items.slice(1),
    });
    const kept = manager.filter?.([hit(new Mesh()), hit(shown), hit(hidden)], undefined as never);
    expect(kept?.map((item) => item.object)).toEqual([shown]);
  });
});

type Probe = { frames: number; mounts: number; cleanups: number; phase?: string; warmed?: boolean };

function createHarness() {
  let progress = 0;
  const controller = createRuntimeManager();
  controller.configure({
    progressSignals: { get: (key) => (key === "story" ? progress : 0) },
  });
  const probe: Probe = { frames: 0, mounts: 0, cleanups: 0 };
  function Content() {
    const state = useSectionState();
    probe.phase = state.phase;
    probe.warmed = state.warmed;
    useFrame(() => {
      probe.frames += 1;
    });
    useEffect(() => {
      probe.mounts += 1;
      return () => {
        probe.cleanups += 1;
      };
    }, []);
    return createElement("mesh", { name: "probe" });
  }
  return {
    controller,
    probe,
    setProgress(value: number) {
      progress = value;
    },
    element(props: Omit<WebGLSectionProps, "children">, children: ReactNode = createElement(Content)) {
      return createElement(
        RuntimeContext.Provider,
        { value: controller },
        createElement(WebGLSection, { ...props, children } as WebGLSectionProps),
      );
    },
  };
}

let renderer: Awaited<ReturnType<typeof create>> | undefined;
afterEach(async () => {
  await renderer?.unmount();
  renderer = undefined;
  document.body.replaceChildren();
});

const probeMesh = () => renderer?.scene.instance.getObjectByName("probe");
const sectionGroup = () => renderer?.scene.children[0]?.instance;
// Phase changes set React state from a frame callback; act flushes them.
const step = async (frames = 3) => {
  await act(async () => {
    await renderer?.advanceFrames(frames, 1 / 60);
  });
};

describe("WebGLSection", () => {
  it("mounts on approach, draws only while active and pauses while asleep", async () => {
    const harness = createHarness();
    renderer = await create(harness.element({ progress: { key: "story", from: 0.4, to: 0.6 } }));
    await step();
    expect(probeMesh()).toBeUndefined();
    expect(harness.probe.mounts).toBe(0);

    harness.setProgress(0.3);
    await step();
    expect(probeMesh()).toBeDefined();
    expect(harness.probe.phase).toBe("warm");
    expect(harness.probe.mounts).toBe(1);
    expect(sectionGroup()?.visible).toBe(false);
    const warmFrames = harness.probe.frames;
    await step();
    expect(harness.probe.frames).toBeGreaterThan(warmFrames);

    harness.setProgress(0.5);
    await step();
    expect(harness.probe.phase).toBe("active");
    expect(sectionGroup()?.visible).toBe(true);

    harness.setProgress(0.95);
    await step();
    expect(harness.probe.cleanups).toBe(1);
    expect(probeMesh()?.visible).toBe(false);
    const sleepingFrames = harness.probe.frames;
    await step(5);
    expect(harness.probe.frames).toBe(sleepingFrames);

    harness.setProgress(0.5);
    await step();
    expect(harness.probe.mounts).toBe(2);
    expect(probeMesh()?.visible).toBe(true);
    expect(sectionGroup()?.visible).toBe(true);
    await step();
    expect(harness.probe.frames).toBeGreaterThan(sleepingFrames);
  });

  it("reports warmed once the warm content is compiled", async () => {
    const harness = createHarness();
    harness.setProgress(0.3);
    renderer = await create(harness.element({ progress: { key: "story", from: 0.4, to: 0.6 } }));
    await step();
    expect(harness.probe.phase).toBe("warm");
    for (let attempt = 0; attempt < 10 && !harness.probe.warmed; attempt += 1) await step(15);
    expect(harness.probe.warmed).toBe(true);
    expect(sectionGroup()?.visible).toBe(false);
  });

  it("unmounts asleep content with retain release", async () => {
    const harness = createHarness();
    harness.setProgress(0.5);
    renderer = await create(
      harness.element({ progress: { key: "story", from: 0.4, to: 0.6 }, retain: "release" }),
    );
    await step();
    expect(probeMesh()).toBeDefined();

    harness.setProgress(0);
    await step();
    expect(probeMesh()).toBeUndefined();
    expect(harness.probe.cleanups).toBe(1);
  });

  it("mounts eager content immediately without connecting its effects", async () => {
    const harness = createHarness();
    renderer = await create(
      harness.element({ progress: { key: "story", from: 0.4, to: 0.6 }, mount: "eager" }),
    );
    await step();
    expect(probeMesh()?.visible).toBe(false);
    expect(harness.probe.mounts).toBe(0);
    expect(harness.probe.frames).toBe(0);
  });

  it("follows a registered DOM target", async () => {
    const harness = createHarness();
    const element = document.createElement("section");
    document.body.append(element);
    let top = 3000;
    element.getBoundingClientRect = () =>
      ({ left: 0, right: 100, top, bottom: top + 100, width: 100, height: 100 }) as DOMRect;
    harness.controller.register("chapter", element, {});
    renderer = await create(harness.element({ target: "chapter" }), { width: 1000, height: 1000 });
    const measure = async () => {
      harness.controller.measure({ width: 1000, height: 1000 });
      await step();
    };

    await measure();
    expect(probeMesh()).toBeUndefined();
    top = 1800;
    await measure();
    expect(harness.probe.phase).toBe("warm");
    top = 400;
    await measure();
    expect(harness.probe.phase).toBe("active");
    expect(sectionGroup()?.visible).toBe(true);
  });

  it("never pauses always sections", async () => {
    const harness = createHarness();
    renderer = await create(harness.element({ always: true }));
    await step();
    expect(harness.probe.phase).toBe("active");
    expect(harness.probe.mounts).toBe(1);
    expect(sectionGroup()?.visible).toBe(true);
  });

  it("reports active outside any section", async () => {
    let phase: string | undefined;
    function Outside() {
      phase = useSectionState().phase;
      return null;
    }
    renderer = await create(createElement(Outside));
    expect(phase).toBe("active");
  });
});
