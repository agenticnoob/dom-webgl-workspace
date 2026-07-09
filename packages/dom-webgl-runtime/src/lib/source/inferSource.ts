import type { TargetDescriptor } from "../dom/targetDescriptor";
import type { WebGLSourceDeclaration } from "../types";
import type { WebGLSourceDescriptor } from "./sourceDescriptor";

export function inferSourceDescriptor(
  targetDescriptor: TargetDescriptor,
): WebGLSourceDescriptor {
  const { declaration, element } = targetDescriptor;
  const declaredSource = declaration.source;

  if (!declaredSource) {
    if (isImageElement(element)) {
      return {
        kind: "media",
        type: "image",
        anchor: element,
        element,
        src: readElementSrc(element),
      };
    }

    if (isVideoElement(element)) {
      return {
        kind: "media",
        type: "video",
        anchor: element,
        element,
        src: readElementSrc(element),
        playback: undefined,
      };
    }

    return {
      kind: "dom",
      type: "element",
      element,
    };
  }

  switch (declaredSource.kind) {
    case "dom":
      return {
        kind: "dom",
        type: declaredSource.type ?? "element",
        element,
      };
    case "media":
      return inferMediaSource(targetDescriptor, declaredSource);
    case "model": {
      const modelType = readDeclarationType(declaredSource);
      if (modelType !== "glb") {
        throw new Error(
          `Unsupported model source type "${modelType}". Only "glb" is supported.`,
        );
      }

      return {
        kind: "model",
        type: "glb",
        anchor: element,
        src: declaredSource.src,
        loader: declaredSource.loader,
      };
    }
  }

  throw new Error(
    `Unsupported WebGL source declaration kind "${readDeclarationKind(
      declaredSource,
    )}" on target "${targetDescriptor.key}".`,
  );
}

function inferMediaSource(
  targetDescriptor: TargetDescriptor,
  declaredSource: Extract<WebGLSourceDeclaration, { kind: "media" }>,
): WebGLSourceDescriptor {
  const element = targetDescriptor.element;

  switch (declaredSource.type) {
    case "image": {
      if (isImageElement(element)) {
        return {
          kind: "media",
          type: "image",
          anchor: element,
          element,
          src: declaredSource.src ?? readElementSrc(element),
        };
      }

      if (!declaredSource.src) {
        throw new Error(
          `WebGL target "${targetDescriptor.key}" declares media/image on a non-IMG element without src.`,
        );
      }

      return {
        kind: "media",
        type: "image",
        anchor: element,
        src: declaredSource.src,
      };
    }
    case "video": {
      if (isVideoElement(element)) {
        return {
          kind: "media",
          type: "video",
          anchor: element,
          element,
          src: declaredSource.src ?? readElementSrc(element),
          playback: declaredSource.playback,
        };
      }

      if (!declaredSource.src) {
        throw new Error(
          `WebGL target "${targetDescriptor.key}" declares media/video on a non-VIDEO element without src.`,
        );
      }

      return {
        kind: "media",
        type: "video",
        anchor: element,
        src: declaredSource.src,
        playback: declaredSource.playback,
      };
    }
    case "image-sequence": {
      if (
        !Number.isInteger(declaredSource.frameCount) ||
        declaredSource.frameCount < 1
      ) {
        throw new Error(
          `WebGL target "${targetDescriptor.key}" declares media/image-sequence with frameCount ${declaredSource.frameCount}.`,
        );
      }
      if (declaredSource.frames.length !== declaredSource.frameCount) {
        throw new Error(
          `WebGL target "${targetDescriptor.key}" declares media/image-sequence with ${declaredSource.frames.length} frames for frameCount ${declaredSource.frameCount}.`,
        );
      }

      return {
        kind: "media",
        type: "image-sequence",
        anchor: element,
        frameCount: declaredSource.frameCount,
        frames: declaredSource.frames,
        progressKey: declaredSource.progressKey,
        startFrame: declaredSource.startFrame ?? 1,
      };
    }
  }
}

function isImageElement(element: HTMLElement): element is HTMLImageElement {
  return element.tagName.toLowerCase() === "img";
}

function isVideoElement(element: HTMLElement): element is HTMLVideoElement {
  return element.tagName.toLowerCase() === "video";
}

function readElementSrc(element: HTMLImageElement | HTMLVideoElement): string {
  return element.getAttribute("src") ?? element.src;
}

function readDeclarationKind(source: unknown): string {
  if (source && typeof source === "object" && "kind" in source) {
    return String(source.kind);
  }

  return String(source);
}

function readDeclarationType(source: unknown): string {
  if (source && typeof source === "object" && "type" in source) {
    return String(source.type);
  }

  return String(source);
}
