import { useFrame } from "@react-three/fiber";
import { create } from "@react-three/test-renderer";
import { act, createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";

import {
  createDiagnostics,
  defaultCostBudgets,
  diagnosticThresholds,
  type FrameInput,
  type RuntimeDiagnostic,
} from "../src/lib/diagnostics";
import type { DOMTargetSnapshot } from "../src/lib/domRuntime";
import {
  createReadyPixelCheck,
  readyPixelInterval,
  readyPixelSamples,
  type PixelProbe,
} from "../src/lib/readyPixels";
import { RuntimeContext } from "../src/lib/Runtime";
import { createRuntimeManager } from "../src/lib/runtimeManager";
import { WebGLSection } from "../src/lib/Section";

const frame = (overrides: Partial<FrameInput> = {}): FrameInput => ({
  deltaMs: 16,
  calls: 10,
  triangles: 1000,
  programs: 3,
  textures: 2,
  geometries: 4,
  tier: "high",
  dpr: 1.5,
  ...overrides,
});

function collect() {
  const reported: RuntimeDiagnostic[] = [];
  const diagnostics = createDiagnostics((item) => reported.push(item));
  return { diagnostics, reported };
}

describe("runtime diagnostics", () => {
  it("reports frame statistics whether or not warnings are enabled", () => {
    const { diagnostics } = collect();
    expect(diagnostics.frameStats()).toBeUndefined();
    for (let index = 0; index < 10; index += 1) diagnostics.recordFrame(frame({ deltaMs: index < 9 ? 16 : 40 }));
    expect(diagnostics.frameStats()).toEqual({
      fps: 54,
      p90Ms: 16,
      calls: 10,
      triangles: 1000,
      programs: 3,
      textures: 2,
      geometries: 4,
      tier: "high",
      dpr: 1.5,
    });
  });

  it("warns once about sustained over-budget frames", () => {
    const { diagnostics, reported } = collect();
    diagnostics.setEnabled(true);
    const heavy = frame({ tier: "medium", calls: defaultCostBudgets.medium.calls + 1 });
    for (let index = 1; index < diagnosticThresholds.overBudgetFrames; index += 1) diagnostics.recordFrame(heavy);
    diagnostics.recordFrame(frame({ tier: "medium" }));
    for (let index = 1; index < diagnosticThresholds.overBudgetFrames; index += 1) diagnostics.recordFrame(heavy);
    expect(reported).toEqual([]);
    for (let index = 0; index < diagnosticThresholds.overBudgetFrames * 3; index += 1) diagnostics.recordFrame(heavy);
    expect(reported.map((item) => item.code)).toEqual(["over-budget"]);
    expect(reported[0].message).toContain("medium budget of 150 calls");
  });

  it("warns when frames stay below 30 fps at the lowest tier only", () => {
    const { diagnostics, reported } = collect();
    diagnostics.setEnabled(true);
    for (let index = 0; index < diagnosticThresholds.floorFrames * 2; index += 1)
      diagnostics.recordFrame(frame({ tier: "medium", deltaMs: 50 }));
    expect(reported).toEqual([]);
    for (let index = 0; index < diagnosticThresholds.floorFrames; index += 1)
      diagnostics.recordFrame(frame({ tier: "low", deltaMs: 50 }));
    expect(reported.map((item) => item.code)).toEqual(["below-floor"]);
  });

  it("stays silent while disabled and de-duplicates by subject", () => {
    const { diagnostics, reported } = collect();
    diagnostics.warn("section-contains-lights", "a", "first");
    diagnostics.setEnabled(true);
    diagnostics.warn("section-contains-lights", "a", "first");
    diagnostics.warn("section-contains-lights", "a", "again");
    diagnostics.warn("section-contains-lights", "b", "other");
    expect(reported.map((item) => item.message)).toEqual(["first", "other"]);
    expect(diagnostics.warnings()).toHaveLength(2);
  });
});

const hiddenTarget = (id: string, rect = { left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100 }): DOMTargetSnapshot => ({
  id,
  rect,
  visible: true,
  ready: true,
  offscreen: "restore-dom",
  revision: 0,
  hidden: true,
});

describe("ready pixel check", () => {
  const empty = { width: 800, height: 600, alpha: () => 0 };
  const drawn = { width: 800, height: 600, alpha: () => 255 };
  const warnAfter = readyPixelInterval * readyPixelSamples;
  const feed = (check: ReturnType<typeof createReadyPixelCheck>, frames: number, probe: PixelProbe | undefined, target = hiddenTarget("title")) => {
    for (let index = 0; index < frames; index += 1) check.check([target], probe);
  };

  it("does not warn while pixels are drawn inside the hidden target", () => {
    const warned: string[] = [];
    const check = createReadyPixelCheck((id) => warned.push(id));
    const samples: Array<[number, number]> = [];
    feed(check, warnAfter * 3, {
      width: 800,
      height: 600,
      alpha: (x, y) => {
        samples.push([x, y]);
        return 255;
      },
    });
    expect(warned).toEqual([]);
    expect(samples.length).toBe(warnAfter * 3 / readyPixelInterval);
    expect(samples.every(([x, y]) => x >= 0 && x < 100 && y >= 0 && y < 100)).toBe(true);
  });

  it("warns once after consecutive empty samples", () => {
    const warned: string[] = [];
    const check = createReadyPixelCheck((id) => warned.push(id));
    feed(check, warnAfter - 1, empty);
    expect(warned).toEqual([]);
    feed(check, warnAfter * 3, empty);
    expect(warned).toEqual(["title"]);
  });

  it("keeps checking after other content passes a sample", () => {
    const warned: string[] = [];
    const check = createReadyPixelCheck((id) => warned.push(id));
    feed(check, warnAfter, drawn);
    feed(check, warnAfter, empty);
    expect(warned).toEqual(["title"]);
  });

  it("starts over after the fallback is shown again", () => {
    const warned: string[] = [];
    const check = createReadyPixelCheck((id) => warned.push(id));
    feed(check, warnAfter, empty);
    check.check([{ ...hiddenTarget("title"), hidden: false }], empty);
    feed(check, warnAfter, empty);
    expect(warned).toEqual(["title", "title"]);
  });

  it("skips opaque canvases, shown fallbacks and offscreen rectangles", () => {
    const warned: string[] = [];
    const check = createReadyPixelCheck((id) => warned.push(id));
    const offscreen = hiddenTarget("below", { left: 0, top: 900, right: 100, bottom: 1000, width: 100, height: 100 });
    feed(check, warnAfter * 2, undefined, hiddenTarget("opaque"));
    feed(check, warnAfter * 2, empty, offscreen);
    feed(check, warnAfter * 2, empty, { ...hiddenTarget("shown"), hidden: false });
    expect(warned).toEqual([]);
  });
});

let renderer: Awaited<ReturnType<typeof create>> | undefined;
afterEach(async () => {
  await renderer?.unmount();
  renderer = undefined;
});

describe("section diagnostics", () => {
  it("lists sections in debug state and warns about lights inside them", async () => {
    let progress = 0.5;
    const controller = createRuntimeManager();
    controller.configure({ progressSignals: { get: () => progress } });
    const reported: string[] = [];
    controller.diagnostics.setEnabled(true);
    const original = console.warn;
    console.warn = (message: unknown) => {
      if (typeof message === "string" && message.startsWith("[viselora]")) reported.push(message);
    };
    function Lit() {
      useFrame(() => {});
      return createElement("pointLight");
    }
    try {
      renderer = await create(
        createElement(
          RuntimeContext.Provider,
          { value: controller },
          createElement(WebGLSection, {
            progress: { key: "story", from: 0.4, to: 0.6 },
            name: "chapter-2",
            children: createElement(Lit),
          }),
        ),
      );
      await act(async () => {
        await renderer?.advanceFrames(3, 1 / 60);
      });
      progress = 0.45;
      await act(async () => {
        await renderer?.advanceFrames(3, 1 / 60);
      });
    } finally {
      console.warn = original;
    }
    const state = controller.manager.getDebugState();
    expect(state.sections).toEqual([{ label: "chapter-2", phase: "active", warmed: expect.any(Boolean) }]);
    expect(state.warnings.map((item) => item.code)).toEqual(["section-contains-lights"]);
    expect(reported).toHaveLength(1);
    expect(reported[0]).toContain('Section "chapter-2" contains 1 light(s)');
  });
});
