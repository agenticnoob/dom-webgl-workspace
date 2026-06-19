import { CanvasTexture } from "three/src/textures/CanvasTexture.js";

import type { WebGLSurfaceMaterialTargetState } from "../../../effects/effectTarget";

export type SurfaceTextureInput = {
  material: WebGLSurfaceMaterialTargetState;
  layout: {
    width: number;
    height: number;
    devicePixelRatio: number;
  };
};

export type SurfaceTextureController = {
  readonly texture: CanvasTexture;
  update(input: SurfaceTextureInput): CanvasTexture;
  dispose(): void;
};

export function createSurfaceTextureController(
  canvas: HTMLCanvasElement,
): SurfaceTextureController {
  const texture = new CanvasTexture(canvas);
  let lastSignature = "";

  return {
    texture,
    update(input): CanvasTexture {
      const signature = JSON.stringify(input);

      if (signature === lastSignature) {
        return texture;
      }

      lastSignature = signature;
      resizeCanvas(canvas, input.layout);
      drawSurface(canvas, input.material, input.layout);
      texture.needsUpdate = true;
      return texture;
    },
    dispose(): void {
      texture.dispose();
    },
  };
}

function resizeCanvas(
  canvas: HTMLCanvasElement,
  layout: SurfaceTextureInput["layout"],
): void {
  const dpr = Math.min(Math.max(1, layout.devicePixelRatio), 1.5);

  canvas.width = Math.max(1, Math.ceil(layout.width * dpr));
  canvas.height = Math.max(1, Math.ceil(layout.height * dpr));
}

function drawSurface(
  canvas: HTMLCanvasElement,
  material: WebGLSurfaceMaterialTargetState,
  layout: SurfaceTextureInput["layout"],
): void {
  const context = read2DContext(canvas);

  if (!context) {
    return;
  }

  const scale = canvas.width / Math.max(1, layout.width);
  const radius = Math.min(
    material.radius * scale,
    canvas.width / 2,
    canvas.height / 2,
  );

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.globalAlpha = material.opacity;
  context.fillStyle = `#${material.color.toString(16).padStart(6, "0")}`;
  context.beginPath();
  context.moveTo(radius, 0);
  context.lineTo(canvas.width - radius, 0);
  context.quadraticCurveTo(canvas.width, 0, canvas.width, radius);
  context.lineTo(canvas.width, canvas.height - radius);
  context.quadraticCurveTo(
    canvas.width,
    canvas.height,
    canvas.width - radius,
    canvas.height,
  );
  context.lineTo(radius, canvas.height);
  context.quadraticCurveTo(0, canvas.height, 0, canvas.height - radius);
  context.lineTo(0, radius);
  context.quadraticCurveTo(0, 0, radius, 0);
  context.closePath();
  context.fill();
}

function read2DContext(
  canvas: HTMLCanvasElement,
): CanvasRenderingContext2D | null {
  try {
    return canvas.getContext("2d");
  } catch {
    return null;
  }
}
