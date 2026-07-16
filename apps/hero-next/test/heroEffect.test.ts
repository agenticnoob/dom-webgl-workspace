import type { WebGLSceneObjectEffectContext } from "@viselora/dom-webgl";
import { describe, expect, test, vi } from "vitest";

import {
  applyHeroFrame,
  createHeroEffectState,
  createHeroMotionState,
  heroTetrahedronEffect,
  stepHeroMotionState,
} from "../src/heroEffect";
import {
  createHeroHoldTransitionState,
  type HeroHoldTransitionState,
} from "../src/heroHoldTransition";
import { heroTransitionConfig } from "../src/heroTransitionConfig";
import type { HeroTransitionSignalWriter } from "../src/heroTransitionSignals";

const desktop = { width: 1200, height: 835 } as const;
const mobile = { width: 390, height: 844 } as const;

function createTarget() {
  const layer = {
    setProgram: vi.fn(),
    setUniforms: vi.fn(),
    clear: vi.fn(),
    dispose: vi.fn(),
  };
  return {
    sourceKind: "mesh" as const,
    position: { x: 0, y: 0, z: 0, set: vi.fn() },
    rotation: { x: 0, y: 0, z: 0, set: vi.fn() },
    scale: { x: 1, y: 1, z: 1, set: vi.fn(), setScalar: vi.fn() },
    visible: true,
    opacity: 1,
    material: {
      color: { value: "#5F5F5F", set: vi.fn() },
      emissive: {
        value: "#5F5F5F",
        intensity: 0.06,
        set: vi.fn(),
      },
      opacity: 0.92,
      metalness: 0.9,
      roughness: 0.12,
      createLayer: vi.fn(() => layer),
      restore: vi.fn(),
    },
  };
}

function createContext(
  target: ReturnType<typeof createTarget>,
  overrides: {
    readonly pointer?: Partial<WebGLSceneObjectEffectContext["pointer"]>;
    readonly objectPointer?: Partial<
      WebGLSceneObjectEffectContext["objectPointer"]
    >;
    readonly time?: number;
    readonly delta?: number;
  } = {},
): WebGLSceneObjectEffectContext {
  const pointer = {
    x: 840,
    y: 334,
    normalizedX: 0.4,
    normalizedY: -0.2,
    isInside: true,
    isDown: true,
    downTime: 0,
    pressDuration: 16,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    dragDeltaX: 0,
    dragDeltaY: 0,
    clickCount: 0,
    button: "primary",
    buttons: ["primary"],
    modifiers: { shift: false, alt: false, ctrl: false, meta: false },
    ...overrides.pointer,
  } satisfies WebGLSceneObjectEffectContext["pointer"];
  const objectPointer = {
    isHovered: true,
    isPressed: true,
    isDragging: false,
    wasClicked: false,
    pointerId: 1,
    dragStartX: 0,
    dragStartY: 0,
    dragDeltaX: 0,
    dragDeltaY: 0,
    hit: { point: [0, 0, 0], distance: 2 },
    ...overrides.objectPointer,
  } satisfies WebGLSceneObjectEffectContext["objectPointer"];
  const time = overrides.time ?? 16;
  const delta = overrides.delta ?? 16;

  return {
    objectId: "hero.tetrahedron.mesh",
    sourceKind: "mesh",
    input: {
      time,
      delta,
      scroll: { mode: "page", pageProgress: 0, direction: 0, velocity: 0 },
      pointer,
    },
    pointer,
    objectPointer,
    progress: { get: () => 0 },
    runtime: {
      progress: { get: () => 0 },
      postprocess: {
        request: () => ({ update() {}, dispose() {} }),
      },
    },
    scene: { id: "hero.tetrahedron.scene", projection: "perspective-stage" },
    time,
    delta,
    object: target,
    resources: {
      addDisposable() {},
      createObject3D(factory) {
        return factory();
      },
      dispose() {},
    },
  } satisfies WebGLSceneObjectEffectContext;
}

function transition(
  values: Partial<HeroHoldTransitionState>,
): HeroHoldTransitionState {
  return { ...createHeroHoldTransitionState(), ...values };
}

describe("hero tetrahedron effect", () => {
  test("starts only from a confirmed primary mesh hit and publishes signals", () => {
    const set = vi.fn();
    const signals = { set } satisfies HeroTransitionSignalWriter;
    const target = createTarget();
    const state = createHeroEffectState(false);

    heroTetrahedronEffect.update(createContext(target), state, {
      kind: "hero.tetrahedron.motion",
      signals,
    });

    expect(state.transition).toMatchObject({
      phase: "expanding",
      origin: { x: 0.7, y: 0.4 },
      targetScheme: "inverted",
    });
    expect(set).toHaveBeenCalledTimes(6);
    expect(set).toHaveBeenCalledWith(
      heroTransitionConfig.signalKeys.coverage,
      0.016,
    );

    for (const context of [
      createContext(createTarget(), {
        pointer: { button: "secondary", buttons: ["secondary"] },
      }),
      createContext(createTarget(), { objectPointer: { hit: undefined } }),
      createContext(createTarget(), { objectPointer: { isPressed: false } }),
    ]) {
      const idle = createHeroEffectState(false);
      heroTetrahedronEffect.update(context, idle, {
        kind: "hero.tetrahedron.motion",
        signals,
      });
      expect(idle.transition.phase).toBe("idle");
    }
  });

  test("uses target foreground through expansion and retraction then restores on cancel", () => {
    const target = createTarget();
    const motion = createHeroMotionState(false);
    const idleInitial = createHeroHoldTransitionState("initial");
    const idleInverted = createHeroHoldTransitionState("inverted");
    const expanding = transition({
      targetScheme: "inverted",
      coverage: 0.5,
      phase: "expanding",
      shakeActive: true,
    });
    const retracting = transition({
      targetScheme: "inverted",
      coverage: 0.25,
      phase: "retracting",
      shakeActive: false,
    });

    applyHeroFrame(target, motion, 0, idleInitial, desktop, false);
    expect(target.material.color.set).toHaveBeenLastCalledWith("#5F5F5F");
    applyHeroFrame(target, motion, 0, idleInverted, desktop, false);
    expect(target.material.color.set).toHaveBeenLastCalledWith("#B8B8B8");
    applyHeroFrame(target, motion, 0, expanding, desktop, false);
    expect(target.material.color.set).toHaveBeenLastCalledWith("#B8B8B8");
    expect(target.material.emissive.set).toHaveBeenLastCalledWith(
      "#B8B8B8",
      0.06,
    );
    applyHeroFrame(target, motion, 0, retracting, desktop, false);
    expect(target.material.color.set).toHaveBeenLastCalledWith("#B8B8B8");
    applyHeroFrame(target, motion, 0, idleInitial, desktop, false);
    expect(target.material.color.set).toHaveBeenLastCalledWith("#5F5F5F");
  });

  test("fades ambient motion with coverage and restores it immediately at commit", () => {
    const target = createTarget();
    const motion = createHeroMotionState(false);
    const idle = createHeroHoldTransitionState();
    const expanding = transition({
      targetScheme: "inverted",
      coverage: 0.5,
      phase: "expanding",
      shakeActive: true,
    });
    const committed = transition({
      committedScheme: "inverted",
      targetScheme: "inverted",
      coverage: 1,
      phase: "awaiting-release",
      shakeActive: false,
    });

    applyHeroFrame(target, motion, 1_500, idle, desktop, false);
    applyHeroFrame(target, motion, 1_500, expanding, desktop, false);
    applyHeroFrame(target, motion, 1_500, committed, desktop, false);

    expect(target.scale.setScalar).toHaveBeenNthCalledWith(
      1,
      expect.closeTo(heroTransitionConfig.motion.baseScale * 1.012, 6),
    );
    expect(target.scale.setScalar).toHaveBeenNthCalledWith(
      2,
      expect.closeTo(heroTransitionConfig.motion.baseScale * 1.006, 6),
    );
    expect(target.scale.setScalar).toHaveBeenNthCalledWith(
      3,
      expect.closeTo(heroTransitionConfig.motion.baseScale * 1.012, 6),
    );
  });

  test("composes deterministic hold shake only during non-reduced expansion", () => {
    const expanding = transition({
      targetScheme: "inverted",
      coverage: 0.5,
      phase: "expanding",
      shakeActive: true,
    });
    const first = createTarget();
    const second = createTarget();

    applyHeroFrame(
      first,
      createHeroMotionState(false),
      137,
      expanding,
      desktop,
      false,
    );
    applyHeroFrame(
      second,
      createHeroMotionState(false),
      137,
      expanding,
      desktop,
      false,
    );

    expect(first.position.set.mock.calls).toEqual(second.position.set.mock.calls);
    expect(first.rotation.set.mock.calls).toEqual(second.rotation.set.mock.calls);
    expect(first.position.set.mock.calls[0]?.[0]).not.toBe(0);

    const reduced = createTarget();
    applyHeroFrame(
      reduced,
      createHeroMotionState(true),
      137,
      expanding,
      desktop,
      true,
    );
    expect(reduced.position.set).toHaveBeenCalledWith(0, 0.365, 0);
    expect(reduced.rotation.set).toHaveBeenCalledWith(-0.6, 0.85, 0.08);
  });

  test("preserves breathing, float, pointer tilt, responsive pose, opacity, and PBR", () => {
    const desktopTarget = createTarget();
    const motion = createHeroMotionState(false);
    motion.tiltX = 0.02;
    motion.tiltY = -0.03;
    const idle = createHeroHoldTransitionState();

    applyHeroFrame(desktopTarget, motion, 1_500, idle, desktop, false);
    applyHeroFrame(desktopTarget, motion, 4_500, idle, desktop, false);

    expect(desktopTarget.position.set).toHaveBeenNthCalledWith(
      1,
      0,
      expect.closeTo(
        0.365 + Math.sin((1_500 / 8_000) * Math.PI * 2) * 0.018,
        6,
      ),
      0,
    );
    expect(desktopTarget.rotation.set).toHaveBeenNthCalledWith(
      1,
      expect.closeTo(-0.58, 6),
      expect.closeTo(0.79, 6),
      0.08,
    );
    expect(desktopTarget.rotation.set).toHaveBeenNthCalledWith(
      2,
      expect.closeTo(-0.58, 6),
      expect.closeTo(0.79, 6),
      0.08,
    );
    expect(desktopTarget.visible).toBe(true);
    expect(desktopTarget.opacity).toBe(0.92);
    expect(desktopTarget.material.opacity).toBe(0.92);
    expect(desktopTarget.material.metalness).toBe(0.9);
    expect(desktopTarget.material.roughness).toBe(0.12);

    const mobileTarget = createTarget();
    applyHeroFrame(
      mobileTarget,
      createHeroMotionState(false),
      0,
      idle,
      mobile,
      false,
    );
    expect(mobileTarget.scale.setScalar).toHaveBeenCalledWith(
      heroTransitionConfig.motion.baseScale *
        heroTransitionConfig.motion.mobileScaleFactor,
    );
    expect(mobileTarget.position.set).toHaveBeenCalledWith(0, 0.555, 0);
  });

  test("adds proximity tilt while moving and returns after 120ms idle", () => {
    const state = createHeroMotionState(false);

    stepHeroMotionState(state, {
      time: 16,
      delta: 16,
      pointerInside: true,
      pointerX: 0.4,
      pointerY: -0.2,
    });
    expect(state.targetTiltX).toBeCloseTo(0.016, 6);
    expect(state.targetTiltY).toBeCloseTo(0.04, 6);

    stepHeroMotionState(state, {
      time: 160,
      delta: 16,
      pointerInside: true,
      pointerX: 0.4,
      pointerY: -0.2,
    });
    expect(state.targetTiltX).toBe(0);
    expect(state.targetTiltY).toBe(0);
  });

  test("declares managed mesh frame scheduling", () => {
    expect(heroTetrahedronEffect).toMatchObject({
      kind: "hero.tetrahedron.motion",
      source: "mesh",
      schedule: "frame",
    });
  });
});
