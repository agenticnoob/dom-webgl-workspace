import { describe, expect, test, vi } from "vitest";

import {
  createScrollTriggerBridge,
  createScrollTriggerSection,
  type ScrollTriggerSectionVars,
} from "./scrollTrigger";
import { createScrollEffectProgressStore } from "./scrollEffectProgress";

describe("createScrollTriggerBridge", () => {
  test("wraps ScrollTrigger update refresh and scroller proxy without creating triggers", () => {
    const scroller = document.createElement("main");
    const proxy = {
      scrollTop: vi.fn(() => 120),
      getBoundingClientRect: vi.fn(() => ({
        top: 0,
        left: 0,
        width: 800,
        height: 600,
      })),
    };
    const ScrollTrigger = {
      update: vi.fn(),
      refresh: vi.fn(),
      scrollerProxy: vi.fn(),
    };

    const bridge = createScrollTriggerBridge({
      ScrollTrigger,
      scroller,
      proxy,
    });

    bridge.update();
    bridge.refresh(true);

    expect(ScrollTrigger.scrollerProxy).toHaveBeenCalledWith(scroller, proxy);
    expect(ScrollTrigger.update).toHaveBeenCalledTimes(1);
    expect(ScrollTrigger.refresh).toHaveBeenCalledWith(true);
  });
});

describe("createScrollTriggerSection", () => {
  test("creates a bounded trigger with typed section options", () => {
    const trigger = document.createElement("section");
    const onUpdate = vi.fn((state: { progress: number }) => {
      expect(state.progress).toBe(0.5);
    });
    const instance = {
      kill: vi.fn(),
    };
    const ScrollTrigger = {
      update: vi.fn(),
      refresh: vi.fn(),
      create: vi.fn((vars: ScrollTriggerSectionVars) => {
        vars.onUpdate?.({ progress: 0.5 });

        return instance;
      }),
    };

    const section = createScrollTriggerSection({
      ScrollTrigger,
      trigger,
      start: "top top",
      end: "+=100%",
      pin: true,
      scrub: 0.5,
      onUpdate,
    });

    expect(ScrollTrigger.create).toHaveBeenCalledWith({
      trigger,
      start: "top top",
      end: "+=100%",
      pin: true,
      scrub: 0.5,
      onUpdate,
    });
    expect(section).toBe(instance);
    expect(onUpdate).toHaveBeenCalledWith({ progress: 0.5 });
  });

  test("keeps section progress independent and kills only its own trigger", () => {
    const firstTrigger = document.createElement("section");
    const secondTrigger = document.createElement("section");
    const store = createScrollEffectProgressStore();
    const createdInstances: FakeSectionInstance[] = [];
    const ScrollTrigger = {
      update: vi.fn(),
      refresh: vi.fn(),
      killAll: vi.fn(),
      create: vi.fn((vars: ScrollTriggerSectionVars) => {
        const instance = createFakeSectionInstance(vars);
        createdInstances.push(instance);

        return instance;
      }),
    };

    const first = createScrollTriggerSection({
      ScrollTrigger,
      trigger: firstTrigger,
      start: "top top",
      end: "bottom top",
      pin: true,
      scrub: true,
      onUpdate(state) {
        store.set("first", state.progress);
      },
    });
    createScrollTriggerSection({
      ScrollTrigger,
      trigger: secondTrigger,
      start: "top top",
      end: "bottom top",
      pin: true,
      scrub: true,
      onUpdate(state) {
        store.set("second", state.progress);
      },
    });

    const firstInstance = readFakeSectionInstance(createdInstances, 0);
    const secondInstance = readFakeSectionInstance(createdInstances, 1);
    firstInstance.emit(0.6);
    first.kill();

    expect(firstInstance.kill).toHaveBeenCalledTimes(1);
    expect(secondInstance.kill).not.toHaveBeenCalled();
    expect(store.source.get("first")).toBe(0.6);
    expect(store.source.get("second")).toBe(0);
    expect(ScrollTrigger.killAll).not.toHaveBeenCalled();
  });
});

type FakeSectionInstance = {
  kill: ReturnType<typeof vi.fn>;
  emit(progress: number): void;
};

function createFakeSectionInstance(
  vars: ScrollTriggerSectionVars,
): FakeSectionInstance {
  return {
    kill: vi.fn(),
    emit(progress) {
      vars.onUpdate?.({ progress });
    },
  };
}

function readFakeSectionInstance(
  instances: readonly FakeSectionInstance[],
  index: number,
): FakeSectionInstance {
  const instance = instances[index];

  if (!instance) {
    throw new Error("Missing fake ScrollTrigger instance");
  }

  return instance;
}
