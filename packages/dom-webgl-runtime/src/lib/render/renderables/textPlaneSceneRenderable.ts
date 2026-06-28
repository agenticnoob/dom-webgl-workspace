import { PlaneGeometry } from "three/src/geometries/PlaneGeometry.js";
import { MeshBasicMaterial } from "three/src/materials/MeshBasicMaterial.js";
import { Group } from "three/src/objects/Group.js";
import { Mesh } from "three/src/objects/Mesh.js";
import { CanvasTexture } from "three/src/textures/CanvasTexture.js";

import { readDOMStyleSnapshot } from "../../dom/styleSnapshot";
import type {
  WebGLTextGlyph,
  WebGLTextGlyphRenderCommand,
  WebGLTextLayerStyle,
} from "../../effects/effectAuthoring";
import type { ElementLayoutSnapshot } from "../../renderer/layoutPass";
import {
  createTextLayerCapabilityHandle,
  drawTextGlyphCommands,
  type TextLayerCapabilityOptions,
} from "./sourceCapabilityHandles";
import {
  computeTextGlyphLayout,
  createTextCanvasRenderSignature,
  drawTextSnapshotToCanvas,
  readTextCanvasRenderState,
  type TextCanvasRenderState,
} from "./textCanvasLayout";
import {
  applyDOMActivityVisibility,
  createSceneRenderableController,
  readCanvasContext,
  readSurfaceSize,
  type SceneRenderableController,
  type SceneRenderableControllerOptions,
} from "./sceneRenderableController";

export function createTextPlaneSceneRenderableController(
  options: Omit<SceneRenderableControllerOptions, "object3D" | "disposeResources">,
): SceneRenderableController {
  const canvas = options.element.ownerDocument.createElement("canvas");
  const context = readCanvasContext(canvas);
  const texture = new CanvasTexture(canvas);
  const geometry = new PlaneGeometry(1, 1);
  const material = new MeshBasicMaterial({
    map: texture,
    transparent: true,
  });
  const mesh = new Mesh(geometry, material);
  const group = new Group();
  let textContent = options.textContent ?? "";
  const initialStyle = readDOMStyleSnapshot(options.element);
  let lastMeasurement: ElementLayoutSnapshot | undefined;
  let lastRenderSignature = "";
  let lastRasterGeometrySignature = "";
  let glyphs: readonly WebGLTextGlyph[] = [];
  let glyphCommandTransform:
    | ((
        glyphs: readonly WebGLTextGlyph[],
      ) => readonly WebGLTextGlyphRenderCommand[])
    | undefined;
  let textLayerStyle = readTextLayerStyle(
    readTextCanvasRenderState(options.element, textContent, {
      width: 1,
      height: 1,
      devicePixelRatio: 1,
      style: initialStyle,
    }),
  );
  group.add(mesh);
  const controller = createSceneRenderableController({
    ...options,
    object3D: group,
    textureSource: canvas,
    disposeResources() {
      texture.dispose();
      geometry.dispose();
      material.dispose();
    },
  });
  const renderTextSnapshot = (measurement = lastMeasurement, force = false) => {
    if (!measurement) {
      return;
    }

    const rasterGeometrySignature = createRasterGeometrySignature(measurement);

    if (
      !force &&
      lastRenderSignature &&
      rasterGeometrySignature === lastRasterGeometrySignature
    ) {
      return;
    }

    const state = readTextCanvasRenderState(
      options.element,
      textContent,
      {
        width: measurement.width,
        height: measurement.height,
        devicePixelRatio: measurement.devicePixelRatio ?? 1,
        style: initialStyle,
      },
    );
    const signature = createTextCanvasRenderSignature(textContent, state);

    if (!force && signature === lastRenderSignature) {
      return;
    }

    lastRenderSignature = signature;
    lastRasterGeometrySignature = rasterGeometrySignature;
    updateTextCanvas(canvas, texture, textContent, state);
    glyphs = context ? computeTextGlyphLayout(context, textContent, state) : [];
    textLayerStyle = readTextLayerStyle(state);
    applyGlyphCommandTransform();
    applyDOMActivityVisibility(group, initialStyle);
  };

  controller.object.updateTextContent = (nextTextContent) => {
    textContent = nextTextContent;
    lastRenderSignature = "";
    updateTextCanvas(
      canvas,
      texture,
      textContent,
      readTextCanvasRenderState(options.element, textContent, {
        width: lastMeasurement?.width ?? 1,
        height: lastMeasurement?.height ?? 1,
        devicePixelRatio: lastMeasurement?.devicePixelRatio ?? 1,
        style: initialStyle,
      }),
    );
  };
  controller.object.updateTextLayout = (measurement) => {
    lastMeasurement = measurement as ElementLayoutSnapshot;
    renderTextSnapshot(lastMeasurement);
  };
  controller.object.invalidateContent = () => {
    lastRenderSignature = "";
    renderTextSnapshot(lastMeasurement, true);
  };
  const textLayerOptions: TextLayerCapabilityOptions = {
    object3D: group,
    mesh,
    material,
    canvas,
    context,
    texture,
    getSize() {
      return readSurfaceSize(lastMeasurement);
    },
    getText() {
      return textContent;
    },
    getStyle() {
      return textLayerStyle;
    },
    getGlyphs() {
      return glyphs;
    },
    setText(nextText) {
      controller.updateTextContent(nextText);
    },
    setGlyphs(transform) {
      glyphCommandTransform = transform;
      applyGlyphCommandTransform();
    },
    invalidate() {
      texture.needsUpdate = true;
    },
  };
  const applyGlyphCommandTransform = () => {
    if (!glyphCommandTransform) {
      return;
    }

    drawTextGlyphCommands(textLayerOptions, glyphCommandTransform(glyphs));
  };
  controller.object.textLayerCapability =
    createTextLayerCapabilityHandle(textLayerOptions);

  if (options.textContent) {
    controller.updateTextContent(options.textContent);
  }

  return controller;
}

function createRasterGeometrySignature(layout: ElementLayoutSnapshot): string {
  return JSON.stringify([
    layout.width,
    layout.height,
    layout.devicePixelRatio ?? 1,
  ]);
}

function readTextLayerStyle(state: TextCanvasRenderState): WebGLTextLayerStyle {
  return {
    font: state.font,
    lineHeight: state.lineHeight,
    letterSpacing: state.letterSpacing,
    wordSpacing: state.wordSpacing,
    textAlign: state.textAlign,
    color: "#000000",
  };
}

function updateTextCanvas(
  canvas: HTMLCanvasElement,
  texture: CanvasTexture,
  textContent: string,
  state: TextCanvasRenderState,
): void {
  const dpr = Math.min(Math.max(1, state.devicePixelRatio), 1.5);

  canvas.width = Math.max(1, Math.ceil(state.width * dpr));
  canvas.height = Math.max(1, Math.ceil(state.height * dpr));

  if (!canvas.ownerDocument.defaultView?.CanvasRenderingContext2D) {
    texture.needsUpdate = true;
    return;
  }

  try {
    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    context.setTransform?.(1, 0, 0, 1, 0, 0);
    context.scale?.(dpr, dpr);
    drawTextSnapshotToCanvas(canvas, context, textContent, state);
    texture.needsUpdate = true;
  } catch {
    texture.needsUpdate = true;
  }
}
