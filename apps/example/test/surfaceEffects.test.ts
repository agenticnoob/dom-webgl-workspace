import { describe, expect, test, vi } from "vitest";
import { Texture, ShaderMaterial } from "three";
import {
  createSurfaceGhostCursorState,
  updateSurfaceGhostCursorState,
} from "../src/ghostCursorState";
import {
  createSurfaceWavesMaterialProgram,
  createSurfaceWavesUniforms,
} from "../src/wavesMaterial";
import {
  drawCoverImage,
  drawPulseSurface,
} from "../src/surfaceEffectRenderers";
import { createCanvasContext } from "./canvasContext";

describe("native surface animation", () => {
  test("fill uses cover sizing and preserves the centered crop", () => {
    const context = createCanvasContext();
    const image = document.createElement("img");
    Object.defineProperties(image, {
      naturalWidth: { value: 800 },
      naturalHeight: { value: 400 },
    });
    drawCoverImage(
      context as unknown as CanvasRenderingContext2D,
      image,
      300,
      300,
    );
    expect(context.drawImage).toHaveBeenCalledWith(
      image,
      200,
      0,
      400,
      400,
      0,
      0,
      300,
      300,
    );
  });
  test("pulse changes surface opacity without modifying source text", () => {
    const context = createCanvasContext();
    drawPulseSurface(
      context as unknown as CanvasRenderingContext2D,
      320,
      180,
      0,
      0.92,
      0.36,
    );
    expect(context.fillRect).toHaveBeenCalled();
    expect(context.fillText).not.toHaveBeenCalled();
    const first = context.strokeRect.mock.calls[0];
    drawPulseSurface(
      context as unknown as CanvasRenderingContext2D,
      320,
      180,
      1,
      0.92,
      0.36,
    );
    expect(context.strokeRect.mock.calls[1]).not.toEqual(first);
  });
  test("ghost trails stay target-local, bounded and stop updates after decay", () => {
    const state = createSurfaceGhostCursorState({
      layout: { width: 320, height: 180 },
    });
    expect(state.pointerX).toBe(160);
    expect(state.trail).toHaveLength(50);
    expect(
      updateSurfaceGhostCursorState(state, { active: true, x: 300, y: 100 }),
    ).toBe(true);
    expect(state.pointerX).toBeGreaterThan(160);
    expect(state.pointerX).toBeLessThan(300);
    expect(state.intensity).toBeGreaterThan(0);
    for (let i = 0; i < 80; i++)
      updateSurfaceGhostCursorState(state, { active: false, x: 0, y: 0 });
    expect(state.intensity).toBe(0);
    expect(
      updateSurfaceGhostCursorState(state, { active: false, x: 0, y: 0 }),
    ).toBe(false);
    expect(state.trail).toHaveLength(50);
  });
  test("waves remain animated outside the target through native uniforms", () => {
    const options = {
      lineColor: "#172124",
      opacity: 0.82,
      pointerActive: false,
      pointerX: 160,
      pointerY: 90,
      time: 1000,
      width: 320,
      height: 180,
    };
    const source = new Texture();
    const dispose = vi.spyOn(source, "dispose");
    const material = createSurfaceWavesMaterialProgram(options, source);
    expect(material).toBeInstanceOf(ShaderMaterial);
    expect(material.uniforms.uSource.value).toBe(source);
    expect(material.uniforms.uPointerActive.value).toBe(false);
    expect(createSurfaceWavesUniforms({ ...options, time: 2000 }).uTime).toBe(
      2000,
    );
    expect(material.fragmentShader).toContain("uTime");
    material.dispose();
    expect(dispose).not.toHaveBeenCalled();
    source.dispose();
  });
});
