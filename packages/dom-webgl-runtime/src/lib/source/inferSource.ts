import type { TargetDescriptor } from "../dom/targetDescriptor";

import type { WebGLSourceDescriptor } from "./sourceDescriptor";

export function inferSourceDescriptor(
  targetDescriptor: TargetDescriptor,
): WebGLSourceDescriptor {
  const { declaration, element } = targetDescriptor;
  const declaredSource = declaration.source;

  if (declaredSource?.kind === "snapshot") {
    return {
      kind: "snapshot",
      mode: declaredSource.mode ?? "element",
      element,
    };
  }

  if (declaredSource?.kind === "model") {
    const modelFormat = declaredSource.format as string;

    if (modelFormat !== "glb") {
      throw new Error(
        `Unsupported model source format "${modelFormat}". Only "glb" is supported.`,
      );
    }

    return {
      kind: "model",
      format: "glb",
      anchor: element,
      src: declaredSource.src,
    };
  }

  if (declaredSource?.kind === "image-sequence") {
    if (!Number.isInteger(declaredSource.frameCount) || declaredSource.frameCount < 1) {
      throw new Error(
        `WebGL target "${targetDescriptor.key}" declares an image sequence with frameCount ${declaredSource.frameCount}.`,
      );
    }
    if (declaredSource.frames.length !== declaredSource.frameCount) {
      throw new Error(
        `WebGL target "${targetDescriptor.key}" declares an image sequence with ${declaredSource.frames.length} frames for frameCount ${declaredSource.frameCount}.`,
      );
    }

    return {
      kind: "image-sequence",
      anchor: element,
      frameCount: declaredSource.frameCount,
      frames: declaredSource.frames,
      progressKey: declaredSource.progressKey,
      startFrame: declaredSource.startFrame ?? 1,
    };
  }

  if (declaredSource?.kind === "image") {
    if (!isImageElement(element)) {
      throw new Error(
        `WebGL target "${targetDescriptor.key}" declares an image source but is not an IMG element.`,
      );
    }

    return {
      kind: "image",
      element,
      src: declaredSource.src ?? readElementSrc(element),
    };
  }

  if (declaredSource?.kind === "video") {
    if (!isVideoElement(element)) {
      throw new Error(
        `WebGL target "${targetDescriptor.key}" declares a video source but is not a VIDEO element.`,
      );
    }

    return {
      kind: "video",
      element,
      src: declaredSource.src ?? readElementSrc(element),
    };
  }

  if (isImageElement(element)) {
    return {
      kind: "image",
      element,
      src: readElementSrc(element),
    };
  }

  if (isVideoElement(element)) {
    return {
      kind: "video",
      element,
      src: readElementSrc(element),
    };
  }

  return {
    kind: "snapshot",
    mode: "element",
    element,
  };
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
