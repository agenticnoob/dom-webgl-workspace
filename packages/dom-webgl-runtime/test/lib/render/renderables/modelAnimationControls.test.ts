import { afterEach, describe, expect, test, vi } from "vitest";

describe("createModelAnimationController", () => {
  afterEach(() => {
    vi.doUnmock("three/src/animation/AnimationMixer.js");
    vi.resetModules();
  });

  test("records controlled diagnostics for missing clips without throwing", async () => {
    const { controller, actionsByName } = await createControllerHarness([
      "Idle",
      "Walk",
    ]);

    expect(() => {
      controller.play("Missing");
      controller.scrub("Missing", { timeSeconds: 0.2 });
      controller.blend("Idle", "Missing", { weight: 0.5 });
      controller.crossFade("Missing", "Walk", { fadeMs: 160 });
    }).not.toThrow();

    expect(controller.inspect().diagnostics).toEqual([
      { kind: "missing-clip", name: "Missing" },
      { kind: "missing-clip", name: "Missing" },
      { kind: "missing-clip", name: "Missing" },
      { kind: "missing-clip", name: "Missing" },
    ]);
    expect(actionsByName.has("Missing")).toBe(false);
  });

  test("scrubs clips by time or normalized progress with clamped values", async () => {
    const { controller, actionsByName } = await createControllerHarness(["Walk"]);

    controller.scrub("Walk", { timeSeconds: -1 });

    const walk = readAction(actionsByName, "Walk");
    expect(walk.time).toBe(0);
    expect(walk.play).toHaveBeenCalledTimes(1);

    controller.scrub("Walk", { progress: 1.5, durationSeconds: 2 });
    expect(walk.time).toBe(2);

    controller.scrub("Walk", { progress: -0.25, durationSeconds: 2 });
    expect(walk.time).toBe(0);
  });

  test("applies controlled clip playback options", async () => {
    const { controller, actionsByName } = await createControllerHarness(["Idle"]);

    controller.play("Idle", {
      loop: "once",
      fadeInMs: 120,
      fadeOutMs: 80,
      clampWhenFinished: true,
      timeScale: 0.75,
    });

    const idle = readAction(actionsByName, "Idle");

    expect(idle.reset).toHaveBeenCalledTimes(1);
    expect(idle.play).toHaveBeenCalledTimes(1);
    expect(idle.fadeIn).toHaveBeenCalledWith(0.12);
    expect(idle.fadeOut).toHaveBeenCalledWith(0.08);
    expect(idle.clampWhenFinished).toBe(true);
    expect(idle.timeScale).toBe(0.75);
    expect(idle.setLoop).toHaveBeenCalledWith(expect.any(Number), 1);
  });

  test("blends two clips with clamped weights without exposing actions", async () => {
    const { controller, actionsByName } = await createControllerHarness([
      "Idle",
      "Walk",
    ]);

    controller.blend("Idle", "Walk", {
      weight: 1.4,
      loop: "repeat",
      timeScale: 0.5,
    });

    const idle = readAction(actionsByName, "Idle");
    const walk = readAction(actionsByName, "Walk");

    expect(idle.weight).toBe(0);
    expect(walk.weight).toBe(1);
    expect(idle.play).toHaveBeenCalledTimes(1);
    expect(walk.play).toHaveBeenCalledTimes(1);
    expect(idle.timeScale).toBe(0.5);
    expect(walk.timeScale).toBe(0.5);
    expect(controller.inspect().activeClips).toEqual(["Idle", "Walk"]);

    controller.blend("Idle", "Walk", { weight: -0.4 });

    expect(idle.weight).toBe(1);
    expect(walk.weight).toBe(0);
  });

  test("crossfades with action support and falls back to managed weights", async () => {
    const supported = await createControllerHarness(["Idle", "Walk"]);

    supported.controller.crossFade("Idle", "Walk", {
      fadeMs: 250,
      loop: "repeat",
    });

    const supportedIdle = readAction(supported.actionsByName, "Idle");
    const supportedWalk = readAction(supported.actionsByName, "Walk");

    expect(supportedIdle.crossFadeTo).toHaveBeenCalledWith(
      supportedWalk,
      0.25,
      false,
    );
    expect(supportedWalk.play).toHaveBeenCalled();

    const fallback = await createControllerHarness(["Idle", "Walk"], {
      supportsCrossFade: false,
    });

    fallback.controller.crossFade("Idle", "Walk", { fadeMs: 250 });

    const fallbackIdle = readAction(fallback.actionsByName, "Idle");
    const fallbackWalk = readAction(fallback.actionsByName, "Walk");

    expect(fallbackIdle.weight).toBe(0);
    expect(fallbackWalk.weight).toBe(1);
  });

  test("disposes active actions and uncaches the root once", async () => {
    const { controller, actionsByName, uncacheRoot, scene } =
      await createControllerHarness(["Idle"]);

    controller.play("Idle");
    controller.dispose();
    controller.dispose();

    const idle = readAction(actionsByName, "Idle");

    expect(idle.stop).toHaveBeenCalledTimes(1);
    expect(uncacheRoot).toHaveBeenCalledTimes(1);
    expect(uncacheRoot).toHaveBeenCalledWith(scene);
    expect(controller.inspect().activeClips).toEqual([]);
  });
});

type FakeAction = {
  name: string;
  time: number;
  timeScale: number;
  weight: number;
  reset: ReturnType<typeof vi.fn>;
  play: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  fadeIn: ReturnType<typeof vi.fn>;
  fadeOut: ReturnType<typeof vi.fn>;
  setLoop: ReturnType<typeof vi.fn>;
  setEffectiveWeight: ReturnType<typeof vi.fn>;
  crossFadeTo?: ReturnType<typeof vi.fn>;
  clampWhenFinished?: boolean;
};

type ControllerHarness = {
  controller: NonNullable<
    Awaited<
      ReturnType<typeof importController>
    >["createModelAnimationController"] extends (...args: never[]) => infer TResult
      ? TResult
      : never
  >;
  actionsByName: Map<string, FakeAction>;
  scene: object;
  uncacheRoot: ReturnType<typeof vi.fn>;
};

async function createControllerHarness(
  clipNames: readonly string[],
  options: { supportsCrossFade?: boolean } = {},
): Promise<ControllerHarness> {
  vi.resetModules();

  const scene = {};
  const actionsByName = new Map<string, FakeAction>();
  const update = vi.fn();
  const uncacheRoot = vi.fn();
  const setTime = vi.fn();
  const clipAction = vi.fn((clip: { name?: string }) => {
    const name = clip.name ?? "";
    const existing = actionsByName.get(name);
    if (existing) {
      return existing;
    }

    const action = createFakeAction(name, options.supportsCrossFade !== false);
    actionsByName.set(name, action);
    return action;
  });
  const AnimationMixer = vi.fn(() => ({
    clipAction,
    setTime,
    uncacheRoot,
    update,
  }));

  vi.doMock("three/src/animation/AnimationMixer.js", () => ({
    AnimationMixer,
  }));

  const { createModelAnimationController } = await importController();
  const controller = createModelAnimationController({
    scene,
    animations: clipNames.map((name) => ({ name })),
  });

  if (!controller) {
    throw new Error("Expected a controller.");
  }

  return { controller, actionsByName, scene, uncacheRoot };
}

function createFakeAction(
  name: string,
  supportsCrossFade: boolean,
): FakeAction {
  const action: FakeAction = {
    name,
    time: 0,
    timeScale: 1,
    weight: 1,
    reset: vi.fn(() => action),
    play: vi.fn(() => action),
    stop: vi.fn(() => action),
    fadeIn: vi.fn(() => action),
    fadeOut: vi.fn(() => action),
    setLoop: vi.fn(() => action),
    setEffectiveWeight: vi.fn((weight: number) => {
      action.weight = weight;
      return action;
    }),
  };

  if (supportsCrossFade) {
    action.crossFadeTo = vi.fn(() => action);
  }

  return action;
}

function readAction(
  actionsByName: Map<string, FakeAction>,
  name: string,
): FakeAction {
  const action = actionsByName.get(name);
  if (!action) {
    throw new Error(`Expected action ${name}.`);
  }
  return action;
}

function importController() {
  return import(
    "../../../../src/lib/render/renderables/modelAnimationControls"
  );
}
