import { Mesh, MeshStandardMaterial, TetrahedronGeometry } from "three";
import { describe, expect, test, vi } from "vitest";

import {
  applyHeroFrame,
  createHeroEffectState,
  createHeroMotionState,
  advanceHeroHoldTransition,
  stepHeroMotionState,
} from "../src/tetrahedron/effect";
import { resolveHeroChapterGeometryFrame } from "../src/chapters/geometry";
import { resolveHeroChapterScrollState } from "../src/chapters/scrollState";
import {
  createHeroHoldTransitionState,
  type HeroHoldTransitionState,
} from "../src/transition/holdTransition";
import { heroTransitionConfig } from "../src/transition/transitionConfig";
import { getHeroChapterDefinition } from "../src/chapters/definitions";
import type { HeroTransitionSignalWriter } from "../src/transition/signals";
import {
  createHeroTetrahedronMaterial,
  createHeroTetrahedronRadialUniforms,
} from "../src/tetrahedron/shader";
import { updateHeroUniforms } from "../src/shared/shaderUniforms";

const desktop = { width: 1200, height: 835 } as const;
const mobile = { width: 390, height: 844 } as const;

function createThemeStore(scheme: "initial" | "inverted" = "initial") {
  return {
    getSnapshot: () => scheme,
    getServerSnapshot: () => "initial" as const,
    subscribe: () => () => undefined,
    commit: vi.fn(),
  };
}

function createLocaleStore(locale: "zh" | "en" = "zh") {
  return {
    getSnapshot: () => locale,
    getServerSnapshot: () => "zh" as const,
    subscribe: () => () => undefined,
    commit: vi.fn(),
  };
}

function createTarget() {
  const target = new Mesh(
    new TetrahedronGeometry(0.52),
    new MeshStandardMaterial({
      metalness: 0.62,
      roughness: 0.28,
      opacity: 0.92,
      transparent: true,
    }),
  );
  vi.spyOn(target.position, "set");
  vi.spyOn(target.rotation, "set");
  vi.spyOn(target.scale, "setScalar");
  vi.spyOn(target.material.color, "set");
  vi.spyOn(target.material.emissive, "set");
  return target;
}

const pressInput = {
  interactionEnabled: true,
  meshPressed: true,
  primaryPointerDown: true,
  hitConfirmed: true,
  pointer: { x: 0.7, y: 0.4 },
  viewport: desktop,
  deltaMs: 16,
};

function transition(
  values: Partial<HeroHoldTransitionState>,
): HeroHoldTransitionState {
  return { ...createHeroHoldTransitionState(), ...values };
}

describe("hero tetrahedron effect", () => {
  test("installs the radial shader on a native Standard material", () => {
    const canvas = document.createElement("canvas");
    const resources = createHeroTetrahedronMaterial(canvas);
    expect(resources.material).toBeInstanceOf(MeshStandardMaterial);
    expect(resources.texture.image).toBe(canvas);
    expect(resources.uniforms.heroChapterAtlas.value).toBe(resources.texture);
    expect(resources.material.customProgramCacheKey()).toBe(
      "hero.tetrahedron.radial",
    );
    resources.texture.dispose();
    resources.material.dispose();
  });

  test("switches packed tail tiles without replacing or re-uploading the atlas", () => {
    const resources = createHeroTetrahedronMaterial(
      document.createElement("canvas"),
    );
    const version = resources.texture.version;
    const transition = createHeroHoldTransitionState();
    const chapter = resolveHeroChapterScrollState(1, 0.001, "axioms");
    updateHeroUniforms(
      resources.uniforms,
      createHeroTetrahedronRadialUniforms(transition, desktop, chapter, [
        "self",
        "axioms",
      ]),
    );
    expect(resources.uniforms.heroTailFaces.value).toEqual([1, 1, 0, 0]);
    updateHeroUniforms(
      resources.uniforms,
      createHeroTetrahedronRadialUniforms(transition, desktop, chapter, [
        "self",
      ]),
    );
    expect(resources.uniforms.heroTailFaces.value).toEqual([1, 0, 0, 0]);
    expect(resources.uniforms.heroChapterAtlas.value).toBe(resources.texture);
    expect(resources.texture.version).toBe(version);
    resources.texture.dispose();
    resources.material.dispose();
  });

  test("starts only from a confirmed primary mesh hit and publishes signals", () => {
    const signals = { set: vi.fn() } satisfies HeroTransitionSignalWriter;
    const state = createHeroEffectState(false);
    advanceHeroHoldTransition(state, pressInput, signals, createThemeStore());
    expect(state.transition).toMatchObject({
      phase: "expanding",
      origin: { x: 0.7, y: 0.4 },
      targetScheme: "inverted",
    });
    expect(signals.set).toHaveBeenCalledTimes(6);
    expect(signals.set).toHaveBeenCalledWith(
      heroTransitionConfig.signalKeys.coverage,
      0.016,
    );
    for (const override of [
      { primaryPointerDown: false },
      { hitConfirmed: false },
      { meshPressed: false },
    ]) {
      const idle = createHeroEffectState(false);
      advanceHeroHoldTransition(
        idle,
        { ...pressInput, ...override },
        signals,
        createThemeStore(),
      );
      expect(idle.transition.phase).toBe("idle");
    }
  });

  test("gates theme commits to a complete Hub and persists exactly once", () => {
    const theme = createThemeStore();
    const signals = { set: vi.fn() };
    const dom = createHeroEffectState(false);
    advanceHeroHoldTransition(
      dom,
      { ...pressInput, interactionEnabled: false },
      signals,
      theme,
    );
    expect(dom.transition.phase).toBe("idle");
    expect(theme.commit).not.toHaveBeenCalled();
    const hub = createHeroEffectState(false);
    for (let frame = 0; frame < 63; frame++)
      advanceHeroHoldTransition(hub, pressInput, signals, theme);
    expect(hub.transition).toMatchObject({
      phase: "awaiting-release",
      committedScheme: "inverted",
    });
    expect(theme.commit).toHaveBeenCalledOnce();
    expect(theme.commit).toHaveBeenCalledWith("inverted");
  });

  test("keeps native material color committed while the radial uniform changes", () => {
    const target = createTarget();
    const motion = createHeroMotionState(false);
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
    });
    applyHeroFrame(target, motion, 0, expanding, desktop, false);
    expect(target.material.color.getHexString()).toBe("5f5f5f");
    expect(target.material.emissive.getHexString()).toBe("5f5f5f");
    expect(target.material.emissiveIntensity).toBe(0.035);
    const expandingUniforms = createHeroTetrahedronRadialUniforms(
      expanding,
      desktop,
    );
    expect(expandingUniforms).toMatchObject({
      heroCommittedColor: "#5F5F5F",
      heroTargetColor: "#B8B8B8",
      heroRadialOrigin: [0.5, 0.5],
      heroRadialEdgePx: 1.5,
    });
    const expandedRadius = expandingUniforms.heroRadialRadiusPx;
    expect(typeof expandedRadius).toBe("number");
    if (typeof expandedRadius !== "number")
      throw new Error("Radial radius must be numeric");
    expect(
      createHeroTetrahedronRadialUniforms(retracting, desktop)
        .heroRadialRadiusPx,
    ).toBeLessThan(expandedRadius);
    applyHeroFrame(
      target,
      motion,
      0,
      createHeroHoldTransitionState("inverted"),
      desktop,
      false,
    );
    expect(target.material.color.getHexString()).toBe("b8b8b8");
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
      expect.closeTo(
        heroTransitionConfig.motion.baseScale *
          (1 + heroTransitionConfig.motion.breathingScaleAmplitude),
        6,
      ),
    );
    expect(target.scale.setScalar).toHaveBeenNthCalledWith(
      2,
      expect.closeTo(
        heroTransitionConfig.motion.baseScale *
          (1 + heroTransitionConfig.motion.breathingScaleAmplitude * 0.5),
        6,
      ),
    );
    expect(target.scale.setScalar).toHaveBeenNthCalledWith(
      3,
      expect.closeTo(
        heroTransitionConfig.motion.baseScale *
          (1 + heroTransitionConfig.motion.breathingScaleAmplitude),
        6,
      ),
    );
  });

  test("composes curved flight and keeps rotating through the centered reveal", () => {
    const { orientEnd, lockEnd } = heroTransitionConfig.chapterScroll.entry;
    const chapters = [
      firstChapterFlightEntry(0.1),
      firstChapterFlightEntry(orientEnd),
      firstChapterFlightEntry(0.44),
      firstChapterFlightEntry(lockEnd),
      firstChapterFlightEntry(0.8),
      firstChapterFlightEntry(1),
    ].map((entry) => resolveHeroChapterScrollState(entry, 0));
    const frames = chapters.map((chapter) =>
      resolveHeroChapterGeometryFrame(
        desktop,
        chapter,
        heroTransitionConfig.motion.baseRotation,
      ),
    );
    const targets = chapters.map(() => createTarget());

    for (const [index, chapter] of chapters.entries()) {
      applyHeroFrame(
        targets[index]!,
        createHeroMotionState(false),
        0,
        createHeroHoldTransitionState(),
        desktop,
        false,
        chapter,
      );
    }

    expect(chapters[0]).toMatchObject({
      phase: "orient-approach",
      screenLock: 0,
    });
    expect(chapters[0]!.orientation).toBeGreaterThan(0);
    expect(chapters[0]!.approach).toBeGreaterThan(0);
    expect(chapters[1]).toMatchObject({
      phase: "face-approach",
    });
    expect(chapters[1]!.orientation).toBeGreaterThan(chapters[0]!.orientation);
    expect(chapters[1]!.orientation).toBeLessThan(1);
    expect(chapters[2]!.orientation).toBeGreaterThan(chapters[1]!.orientation);
    expect(chapters[2]!.orientation).toBeLessThan(1);
    expect(chapters[2]!.approach).toBeGreaterThan(chapters[1]!.approach);
    expect(chapters[3]).toMatchObject({
      approach: 1,
      screenLock: 0,
      triangleReveal: 0,
    });
    expect(chapters[3]!.orientation).toBeLessThan(1);
    expect(chapters[4]!.triangleReveal).toBeGreaterThan(0);
    expect(chapters[4]!.screenLock).toBe(chapters[4]!.triangleReveal);
    expect(chapters[4]!.orientation).toBeGreaterThan(chapters[3]!.orientation);
    expect(chapters[4]!.orientation).toBeLessThan(1);
    expect(chapters[5]).toMatchObject({
      orientation: 1,
      approach: 1,
      screenLock: 1,
      triangleReveal: 1,
      domContentActive: true,
    });
    expect(frames[0]!.position[2]).toBeLessThan(0);
    expect(frames[0]!.rotation).not.toEqual(
      heroTransitionConfig.motion.baseRotation,
    );
    expect(frames[1]!.rotation).not.toEqual(
      getHeroChapterDefinition("self").face.targetRotation,
    );
    expect(frames[2]!.rotation).not.toEqual(frames[1]!.rotation);
    expect(frames[3]!.rotation).not.toEqual(
      getHeroChapterDefinition("self").face.targetRotation,
    );
    expect(frames[4]!.rotation).not.toEqual(frames[3]!.rotation);
    expect(frames[5]!.rotation).toEqual(
      getHeroChapterDefinition("self").face.targetRotation,
    );
    expect(frames[1]!.position[2]).toBeLessThan(frames[2]!.position[2]);
    expect(frames[2]!.position[2]).toBeLessThan(frames[3]!.position[2]);
    expect(frames[3]!.position[2]).toBeLessThan(frames[4]!.position[2]);
    expect(frames[4]!.position[2]).toBeLessThan(frames[5]!.position[2]);

    for (const [index, target] of targets.entries()) {
      expect(target.position.set).toHaveBeenCalledWith(
        ...frames[index]!.position,
      );
      expect(target.rotation.set).toHaveBeenCalledWith(
        ...frames[index]!.rotation,
      );
      expect(target.scale.setScalar).toHaveBeenCalledWith(
        heroTransitionConfig.motion.baseScale,
      );
    }
  });

  test("keeps a restrained breathing layer through entry and return flight", () => {
    const idle = createHeroHoldTransitionState();
    const entry = resolveHeroChapterScrollState(
      firstChapterFlightEntry(0.44),
      0,
    );
    const exit = resolveHeroChapterScrollState(
      1,
      (heroTransitionConfig.chapterScroll.exit.contractEnd +
        heroTransitionConfig.chapterScroll.exit.retreatEnd) /
        2,
    );
    const entryTarget = createTarget();
    const exitTarget = createTarget();
    const expectedScale =
      heroTransitionConfig.motion.baseScale *
      (1 +
        heroTransitionConfig.motion.breathingScaleAmplitude *
          heroTransitionConfig.motion.transitionAmbientFactor);

    applyHeroFrame(
      entryTarget,
      createHeroMotionState(false),
      1_500,
      idle,
      desktop,
      false,
      entry,
    );
    applyHeroFrame(
      exitTarget,
      createHeroMotionState(false),
      1_500,
      idle,
      desktop,
      false,
      exit,
    );

    expect(entryTarget.scale.setScalar).toHaveBeenCalledWith(
      expect.closeTo(expectedScale, 6),
    );
    expect(exitTarget.scale.setScalar).toHaveBeenCalledWith(
      expect.closeTo(expectedScale, 6),
    );
  });

  test("keeps damped pointer parallax through entry and return flight", () => {
    const motion = createHeroMotionState(false);
    motion.tiltX = 0.03;
    motion.tiltY = -0.04;
    const entry = resolveHeroChapterScrollState(
      firstChapterFlightEntry(0.44),
      0,
    );
    const exit = resolveHeroChapterScrollState(
      1,
      (heroTransitionConfig.chapterScroll.exit.contractEnd +
        heroTransitionConfig.chapterScroll.exit.retreatEnd) /
        2,
    );
    const locked = resolveHeroChapterScrollState(
      firstChapterFlightEntry(0.8),
      0,
    );

    for (const chapter of [entry, exit, locked]) {
      const target = createTarget();
      const frame = resolveHeroChapterGeometryFrame(
        desktop,
        chapter,
        heroTransitionConfig.motion.baseRotation,
      );
      applyHeroFrame(
        target,
        motion,
        0,
        createHeroHoldTransitionState(),
        desktop,
        false,
        chapter,
      );

      const pointerWeight =
        heroTransitionConfig.motion.transitionPointerFactor *
        (1 - chapter.screenLock);
      expect(target.rotation.set).toHaveBeenCalledWith(
        expect.closeTo(frame.rotation[0] + motion.tiltX * pointerWeight, 6),
        expect.closeTo(frame.rotation[1] + motion.tiltY * pointerWeight, 6),
        expect.closeTo(frame.rotation[2], 6),
      );
    }
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

    expect(vi.mocked(first.position.set).mock.calls).toEqual(
      vi.mocked(second.position.set).mock.calls,
    );
    expect(vi.mocked(first.rotation.set).mock.calls).toEqual(
      vi.mocked(second.rotation.set).mock.calls,
    );
    expect(vi.mocked(first.position.set).mock.calls[0]?.[0]).not.toBe(0);

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
    expect(
      createHeroTetrahedronRadialUniforms(expanding, desktop),
    ).toMatchObject({
      heroCommittedColor: "#5F5F5F",
      heroTargetColor: "#B8B8B8",
      heroRadialRadiusPx: expect.any(Number),
      heroRadialEdgePx: 1.5,
    });
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
        0.365 +
          Math.sin((1_500 / 8_000) * Math.PI * 2) *
            heroTransitionConfig.motion.floatingAmplitude,
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
    expect(desktopTarget.material.opacity).toBe(0.92);
    expect(desktopTarget.material.metalness).toBe(0.62);
    expect(desktopTarget.material.roughness).toBe(0.28);

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
    expect(state.targetTiltX).toBeCloseTo(
      heroTransitionConfig.motion.pointerPitch * 0.2,
      6,
    );
    expect(state.targetTiltY).toBeCloseTo(
      heroTransitionConfig.motion.pointerYaw * 0.4,
      6,
    );

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

  test("hides the native mesh only at the complete semantic DOM handoff", () => {
    const target = createTarget();
    for (const [entry, exit, visible] of [
      [0.999, 0, true],
      [1, 0, false],
      [1, 0.001, true],
    ] as const) {
      applyHeroFrame(
        target,
        createHeroMotionState(false),
        0,
        createHeroHoldTransitionState(),
        desktop,
        false,
        resolveHeroChapterScrollState(entry, exit),
      );
      expect(target.visible).toBe(visible);
    }
  });
});

function firstChapterFlightEntry(flightProgress: number): number {
  const { introHandoffEnd } = heroTransitionConfig.chapterScroll.entry;
  return introHandoffEnd + (1 - introHandoffEnd) * flightProgress;
}
