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

  if (isImageElement(element)) {
    return {
      kind: "image",
      element,
      src: declaredSource?.kind === "image" && declaredSource.src
        ? declaredSource.src
        : readElementSrc(element),
    };
  }

  if (isVideoElement(element)) {
    return {
      kind: "video",
      element,
      src: declaredSource?.kind === "video" && declaredSource.src
        ? declaredSource.src
        : readElementSrc(element),
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
