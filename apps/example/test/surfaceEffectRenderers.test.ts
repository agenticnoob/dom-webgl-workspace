import { describe, expect, test } from "vitest";

import {
  calculateGhostCursorBaseRadius,
  drawGhostCursorSurface,
  type GhostSurfaceContext,
} from "../src/surfaceEffectRenderers";

describe("surface effect renderers", () => {
  test("keeps ghost cursor smoke smaller than a single large target-scaled blob", () => {
    expect(calculateGhostCursorBaseRadius(320, 180)).toBeLessThan(28);
    expect(calculateGhostCursorBaseRadius(320, 180)).toBeGreaterThanOrEqual(18);
  });

  test("draws ghost cursor as a dark animated smoke stage outside target", () => {
    const context = createRecordingContext();
    const otherPointerContext = createRecordingContext();

    drawGhostCursorSurface(context, 320, 180, {
      color: "#b497cf",
      opacity: 0.9,
      pointerActive: false,
      pointerIntensity: 0,
      pointerX: 160,
      pointerY: 90,
      time: 1200,
      trailLength: 32,
    });
    drawGhostCursorSurface(otherPointerContext, 320, 180, {
      color: "#b497cf",
      opacity: 0.9,
      pointerActive: false,
      pointerIntensity: 0,
      pointerX: 24,
      pointerY: 36,
      time: 1200,
      trailLength: 32,
    });

    expect(context.calls).toContain("fillRect:0:0:320:180");
    expect(context.gradientCalls.length).toBeGreaterThan(12);
    expect(context.gradientCalls).toEqual(otherPointerContext.gradientCalls);
    expect(context.gradientCalls).not.toContain(
      "gradient:160:90:0:160:90:86.4",
    );
  });

  test("adds local ghost cursor glow and noisy smoke when pointer is active", () => {
    const context = createRecordingContext();

    drawGhostCursorSurface(context, 320, 180, {
      color: "#b497cf",
      opacity: 0.9,
      pointerActive: true,
      pointerIntensity: 1,
      pointerX: 172,
      pointerY: 96,
      time: 1200,
      trailLength: 32,
    });

    expect(context.calls).toContain("fillRect:0:0:320:180");
    expect(context.gradientCalls.length).toBeGreaterThan(12);
    expect(
      context.gradientCalls.some((call) =>
        call.startsWith("gradient:172:96:0:172:96:"),
      ),
    ).toBe(true);
    expect(context.gradientCalls).not.toContain("gradient:172:96:0:172:96:86.4");
    expect(context.calls.some((call) => call.startsWith("fillText:Boo!:160:"))).toBe(
      true,
    );
  });
});

type RecordingCanvasContext = GhostSurfaceContext & {
  readonly calls: string[];
  readonly gradientCalls: string[];
};

function createRecordingContext(): RecordingCanvasContext {
  const calls: string[] = [];
  const gradientCalls: string[] = [];
  const context: RecordingCanvasContext = {
    calls,
    gradientCalls,
    fillStyle: "",
    font: "",
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    lineWidth: 1,
    strokeStyle: "",
    textAlign: "left",
    textBaseline: "alphabetic",
    beginPath() {
      calls.push("beginPath");
    },
    arc(x: number, y: number, radius: number) {
      calls.push(`arc:${x}:${y}:${radius}`);
    },
    clearRect(x: number, y: number, width: number, height: number) {
      calls.push(`clearRect:${x}:${y}:${width}:${height}`);
    },
    createRadialGradient(
      x0: number,
      y0: number,
      r0: number,
      x1: number,
      y1: number,
      r1: number,
    ) {
      gradientCalls.push(`gradient:${x0}:${y0}:${r0}:${x1}:${y1}:${r1}`);
      const gradient = {
        addColorStop(offset: number, color: string) {
          calls.push(`colorStop:${offset}:${color}`);
        },
      };

      return gradient;
    },
    fill() {
      calls.push("fill");
    },
    fillRect(x: number, y: number, width: number, height: number) {
      calls.push(`fillRect:${x}:${y}:${width}:${height}`);
    },
    fillText(text: string, x: number, y: number) {
      calls.push(`fillText:${text}:${x}:${y}`);
    },
    restore() {
      calls.push("restore");
    },
    save() {
      calls.push("save");
    },
    strokeRect(x: number, y: number, width: number, height: number) {
      calls.push(`strokeRect:${x}:${y}:${width}:${height}`);
    },
  };

  return context;
}
