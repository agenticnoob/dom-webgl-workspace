import { vi } from "vitest";

import type {
  WebGLEffectContext,
  WebGLEffectTargetHandle,
} from "@project/dom-webgl-runtime";

import { createEffectSource, type TestEffectSource } from "./effectSourceHandles";

type TestEffectContextOverrides = Omit<
  Partial<WebGLEffectContext>,
  "input" | "layout" | "pointer" | "resources" | "scroll" | "source" | "target"
> & {
  layout?: Partial<WebGLEffectContext["layout"]>;
  pointer?: Partial<WebGLEffectContext["pointer"]>;
  resources?: Partial<WebGLEffectContext["resources"]>;
  scroll?: WebGLEffectContext["scroll"];
  source?: TestEffectSource;
  target?: Partial<WebGLEffectTargetHandle>;
};

export function createGlyph(index: number, char: string) {
  return {
    index,
    char,
    line: 0,
    x: index * 12,
    y: 0,
    width: 10,
    height: 20,
    baseline: 16,
  };
}

export function createEffectContext(
  overrides: TestEffectContextOverrides = {},
): WebGLEffectContext {
  const source = createEffectSource(overrides.source);
  const pointer = createPointerState(overrides.pointer);
  const scroll = overrides.scroll ?? createPageScrollState();
  const time = overrides.time ?? 0;
  const delta = overrides.delta ?? 16;
  const layout = createLayoutSnapshot(overrides.layout);
  const targetPointer =
    overrides.targetPointer ?? createTargetPointerState(pointer, layout, time);

  return {
    key: overrides.key ?? "example.test",
    sourceKind: overrides.sourceKind ?? readEffectSourceKind(source),
    layout,
    input: {
      time,
      delta,
      scroll,
      pointer,
    },
    pointer,
    targetPointer,
    scroll,
    scrollProgress: overrides.scrollProgress ?? 0,
    progress: overrides.progress ?? { get: () => 0 },
    visual: overrides.visual ?? {
      requestPostprocess: vi.fn(() => ({
        update: vi.fn(),
        dispose: vi.fn(),
      })),
    },
    time,
    delta,
    source,
    target:
      overrides.target === undefined
        ? undefined
        : { ...createTargetHandle(), ...overrides.target },
    resources: {
      ...createResourceScope(),
      ...overrides.resources,
    },
  } satisfies WebGLEffectContext;
}

function createTargetPointerState(
  pointer: WebGLEffectContext["pointer"],
  layout: WebGLEffectContext["layout"],
  time: number,
): WebGLEffectContext["targetPointer"] {
  const localX = pointer.x - layout.left;
  const localY = pointer.y - layout.top;
  const dragStartLocalX = pointer.dragStartX - layout.left;
  const dragStartLocalY = pointer.dragStartY - layout.top;
  const pressDuration = pointer.isDown
    ? Math.max(0, time - pointer.downTime)
    : pointer.pressDuration;

  return {
    localX,
    localY,
    normalizedX: normalizeAxis(localX, layout.width),
    normalizedY: -normalizeAxis(localY, layout.height),
    isInside:
      pointer.isInside &&
      localX >= 0 &&
      localX <= layout.width &&
      localY >= 0 &&
      localY <= layout.height,
    isPressed: pointer.isDown,
    pressDuration,
    isDragging: pointer.isDragging,
    dragStartLocalX,
    dragStartLocalY,
    dragDeltaX: pointer.dragDeltaX,
    dragDeltaY: pointer.dragDeltaY,
    ...(pointer.lastClickTime !== undefined
      ? { lastClickTime: pointer.lastClickTime }
      : {}),
    clickCount: pointer.clickCount,
  };
}

function normalizeAxis(value: number, size: number): number {
  if (size <= 0) {
    return 0;
  }

  return (2 * value - size) / size;
}

function readEffectSourceKind(
  source: WebGLEffectContext["source"],
): WebGLEffectContext["sourceKind"] {
  switch (source.kind) {
    case "dom":
      return source.type === "text" ? "dom/text" : "dom/element";
    case "media":
      switch (source.type) {
        case "image":
          return "media/image";
        case "video":
          return "media/video";
        case "image-sequence":
          return "media/image-sequence";
      }
    case "model":
      return "model/glb";
  }
}

function createLayoutSnapshot(
  overrides: Partial<WebGLEffectContext["layout"]> = {},
): WebGLEffectContext["layout"] {
  const left = overrides.left ?? overrides.x ?? 0;
  const top = overrides.top ?? overrides.y ?? 0;
  const width = overrides.width ?? 120;
  const height = overrides.height ?? 60;
  const viewport = overrides.viewport ?? { width: 1024, height: 768 };
  const devicePixelRatio = overrides.devicePixelRatio ?? 1;

  return {
    x: left,
    y: top,
    width,
    height,
    top,
    right: left + width,
    bottom: top + height,
    left,
    viewport,
    devicePixelRatio,
    layoutSignature:
      overrides.layoutSignature ??
      JSON.stringify([left, top, width, height, viewport.width, viewport.height, devicePixelRatio]),
    ...overrides,
  };
}

function createPointerState(
  overrides: Partial<WebGLEffectContext["pointer"]> = {},
): WebGLEffectContext["pointer"] {
  return {
    x: 0,
    y: 0,
    normalizedX: 0,
    normalizedY: 0,
    isInside: false,
    isDown: false,
    downTime: 0,
    pressDuration: 0,
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    dragDeltaX: 0,
    dragDeltaY: 0,
    clickCount: 0,
    ...overrides,
  };
}

function createPageScrollState(): WebGLEffectContext["scroll"] {
  return {
    mode: "page",
    pageProgress: 0,
    direction: 0,
    velocity: 0,
  };
}

function createTargetHandle(): WebGLEffectTargetHandle {
  return {
    setVisible: vi.fn(),
    setPosition: vi.fn(),
    setRotation: vi.fn(),
    setScale: vi.fn(),
    setOpacity: vi.fn(),
  };
}

function createResourceScope(): WebGLEffectContext["resources"] {
  return {
    addDisposable: vi.fn(),
    createObject3D<TObject>(factory: () => TObject): TObject {
      return factory();
    },
    dispose: vi.fn(),
  };
}
