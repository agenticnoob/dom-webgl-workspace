import { vi } from "vitest";

import type { WebGLEffectContext } from "@viselora/dom-webgl";

import { createEffectSource, type TestEffectSource } from "./effectSourceHandles";

type TestEffectSourceHandle = ReturnType<typeof createEffectSource>;

type TestEffectTargetHandle = {
  setVisible(visible: boolean): void;
  setPosition(x: number, y: number, z?: number): void;
  setRotation(x: number, y: number, z?: number): void;
  setScale(x: number, y?: number, z?: number): void;
  setOpacity(opacity: number): void;
};

type TestEffectVisualContext = {
  requestPostprocess: WebGLEffectContext["runtime"]["postprocess"]["request"];
};

type TestEffectContextOverrides = Omit<
  Partial<WebGLEffectContext>,
  | "input"
  | "layout"
  | "pointer"
  | "resources"
  | "scroll"
  | "source"
  | "target"
  | "visual"
> & {
  layout?: Partial<WebGLEffectContext["layout"]>;
  pointer?: Partial<WebGLEffectContext["pointer"]>;
  resources?: Partial<WebGLEffectContext["resources"]>;
  scroll?: WebGLEffectContext["scroll"];
  source?: TestEffectSource;
  target?: Partial<TestEffectTargetHandle>;
  visual?: TestEffectVisualContext;
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
  const sourceKind = overrides.sourceKind ?? readEffectSourceKind(source);
  const progress = overrides.progress ?? { get: () => 0 };
  const visual = overrides.visual ?? {
    requestPostprocess: vi.fn(() => ({
      update: vi.fn(),
      dispose: vi.fn(),
    })),
  };
  const target =
    overrides.target === undefined
      ? undefined
      : { ...createTargetHandle(), ...overrides.target };
  const resources = {
    ...createResourceScope(),
    ...overrides.resources,
  };

  return {
    key: overrides.key ?? "example.test",
    sourceKind,
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
    progress,
    runtime: overrides.runtime ?? {
      progress,
      postprocess: {
        request(request) {
          return visual.requestPostprocess(request);
        },
      },
    },
    ...(overrides.scene !== undefined ? { scene: overrides.scene } : {}),
    time,
    delta,
    object:
      overrides.object ??
      createTestEffectObject({
        sourceKind,
        source,
        target,
      }),
    resources,
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

function readEffectSourceKind(source: TestEffectSourceHandle): WebGLEffectContext["sourceKind"] {
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
      return assertNeverSource(source);
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
    buttons: [],
    modifiers: { shift: false, alt: false, ctrl: false, meta: false },
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

function createTargetHandle(): TestEffectTargetHandle {
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

function createTestEffectObject(options: {
  sourceKind: WebGLEffectContext["sourceKind"];
  source: TestEffectSourceHandle;
  target: TestEffectTargetHandle | undefined;
}): WebGLEffectContext["object"] {
  const transform = createTestTransform(options.target);

  return {
    sourceKind: options.sourceKind,
    position: transform.position,
    rotation: transform.rotation,
    scale: transform.scale,
    get visible() {
      return transform.visible;
    },
    set visible(value) {
      transform.visible = value;
    },
    get opacity() {
      return transform.opacity;
    },
    set opacity(value) {
      transform.opacity = value;
    },
    ...createTestObjectCapabilities(options.source),
  };
}

function createTestTransform(target: TestEffectTargetHandle | undefined) {
  let visible = true;
  let opacity = 1;

  return {
    position: createTestVector((x, y, z) => target?.setPosition(x, y, z)),
    rotation: createTestVector((x, y, z) => target?.setRotation(x, y, z)),
    scale: createTestScale((x, y, z) => target?.setScale(x, y, z)),
    get visible() {
      return visible;
    },
    set visible(value: boolean) {
      visible = value;
      target?.setVisible(value);
    },
    get opacity() {
      return opacity;
    },
    set opacity(value: number) {
      opacity = value;
      target?.setOpacity(value);
    },
  };
}

function createTestVector(
  commit: (x: number, y: number, z: number) => void,
): WebGLEffectContext["object"]["position"] {
  let x = 0;
  let y = 0;
  let z = 0;

  return {
    get x() {
      return x;
    },
    set x(value) {
      x = value;
      commit(x, y, z);
    },
    get y() {
      return y;
    },
    set y(value) {
      y = value;
      commit(x, y, z);
    },
    get z() {
      return z;
    },
    set z(value) {
      z = value;
      commit(x, y, z);
    },
    set(nextX, nextY, nextZ = 0) {
      x = nextX;
      y = nextY;
      z = nextZ;
      commit(x, y, z);
    },
  };
}

function createTestScale(
  commit: (x: number, y: number, z: number) => void,
): WebGLEffectContext["object"]["scale"] {
  let x = 1;
  let y = 1;
  let z = 1;

  return {
    get x() {
      return x;
    },
    set x(value) {
      x = value;
      commit(x, y, z);
    },
    get y() {
      return y;
    },
    set y(value) {
      y = value;
      commit(x, y, z);
    },
    get z() {
      return z;
    },
    set z(value) {
      z = value;
      commit(x, y, z);
    },
    set(nextX, nextY, nextZ = 1) {
      x = nextX;
      y = nextY;
      z = nextZ;
      commit(x, y, z);
    },
    setScalar(value) {
      x = value;
      y = value;
      z = value;
      commit(x, y, z);
    },
  };
}

function createTestObjectCapabilities(
  source: TestEffectSourceHandle,
): Partial<WebGLEffectContext["object"]> {
  switch (source.kind) {
    case "dom":
      if (source.type === "text") {
        const textLayer = source.textLayer;
        return textLayer
          ? {
              text: {
                get text() {
                  return textLayer.text;
                },
                get style() {
                  return textLayer.style;
                },
                get shaderInputs() {
                  return textLayer.shaderInputs;
                },
                getGlyphs() {
                  return textLayer.getGlyphs();
                },
                setText(text) {
                  textLayer.setText(text);
                },
                setGlyphs(transform) {
                  textLayer.setGlyphs(transform);
                },
                material: textLayer,
              },
            }
          : {};
      }

      return { surface: source.surface };
    case "media":
      switch (source.type) {
        case "image":
          return source.image
            ? { texture: createTestTextureFacade(source.image, { src: source.src }) }
            : {};
        case "video":
          return source.video
            ? {
                texture: createTestTextureFacade(source.video, { src: source.src }),
                video: createTestVideoFacade(source.video),
              }
            : {};
        case "image-sequence":
          return source.image
            ? {
                texture: createTestTextureFacade(source.image, {
                  src: source.src,
                  frame: source.frame,
                }),
              }
            : {};
      }
      return assertNeverSource(source);
    case "model":
      return {
        model: {
          src: source.src,
          meshes: {
            all() {
              return source.model.getMeshes();
            },
            forEach(visitor) {
              source.model.forEachMesh(visitor);
            },
          },
          sampling: {
            vertices(options) {
              return source.model.sampleVertices(options);
            },
          },
          points: {
            create(options) {
              return source.model.createPointLayer(options);
            },
          },
        },
      };
  }
}

function assertNeverSource(source: never): never {
  return source;
}

function createTestTextureFacade(
  layer:
    | NonNullable<
        Extract<TestEffectSourceHandle, { kind: "media"; type: "image" }>["image"]
      >
    | NonNullable<
        Extract<TestEffectSourceHandle, { kind: "media"; type: "video" }>["video"]
      >
    | NonNullable<
        Extract<
          TestEffectSourceHandle,
          { kind: "media"; type: "image-sequence" }
        >["image"]
      >,
  metadata: { src?: string; frame?: number },
): NonNullable<WebGLEffectContext["object"]["texture"]> {
  return {
    src: metadata.src,
    frame: metadata.frame,
    get shaderInputs() {
      return layer.shaderInputs;
    },
    setTransform(transform) {
      layer.setTextureTransform(transform);
    },
    invalidate() {
      layer.invalidate();
    },
    material: layer,
  };
}

function createTestVideoFacade(
  video: NonNullable<
    Extract<TestEffectSourceHandle, { kind: "media"; type: "video" }>["video"]
  >,
): NonNullable<WebGLEffectContext["object"]["video"]> {
  return {
    play() {
      return video.play();
    },
    pause() {
      video.pause();
    },
    setMuted(muted) {
      video.setMuted(muted);
    },
    setPlaybackRate(rate) {
      video.setPlaybackRate(rate);
    },
  };
}
