# Source Kind/Type Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current source API with a simpler `source.kind` + `source.type` model, remove legacy source declarations, delete `apps/demo`, keep `apps/example` as the only consumer surface, and unify effect context narrowing around `ctx.source.kind` / `ctx.source.type`.

**Architecture:** Public declarations, internal descriptors, renderable routing, and effect source handles all use the same source taxonomy: `dom`, `media`, and `model`. `dom` covers element/text snapshots, `media` covers image/video/image-sequence textures anchored to any target element, and `model` covers GLB models. The renderables remain focused by media type; the source inference layer owns normalization and validation so renderables do not carry public API compatibility logic.

**Tech Stack:** TypeScript strict mode, React, Three.js, Vitest/jsdom, npm workspaces.

---

## Scope And Non-Compatibility Decision

This is a breaking API migration. Do not preserve explicit old declarations:

```ts
source: { kind: "snapshot", mode: "element" }
source: { kind: "image" }
source: { kind: "video" }
source: { kind: "image-sequence" }
source: { kind: "model", format: "glb", src }
```

Replace them with:

```ts
source: { kind: "dom", type: "element" }
source: { kind: "dom", type: "text" }
source: { kind: "media", type: "image", src }
source: { kind: "media", type: "video", src }
source: { kind: "media", type: "image-sequence", frames, frameCount, progressKey }
source: { kind: "model", type: "glb", src }
```

Keep source inference when no `source` is declared:

- real `<img>` targets infer `media/image`;
- real `<video>` targets infer `media/video`;
- all other elements infer `dom/element`.

This is not legacy compatibility because the old explicit declaration shapes remain removed from the public type and runtime validation path.

## File Structure And Responsibility Map

- `packages/dom-webgl-runtime/src/lib/types.ts`
  Public declaration types only. Defines `WebGLSourceDeclaration` as `dom | media | model`.

- `packages/dom-webgl-runtime/src/lib/source/sourceDescriptor.ts`
  Internal normalized source descriptor types. Stores target anchors and loaded media source elements where needed.

- `packages/dom-webgl-runtime/src/lib/source/inferSource.ts`
  Sole owner of source normalization and source validation. Converts public declarations and inferred DOM element state into internal descriptors.

- `packages/dom-webgl-runtime/src/lib/render/renderRole.ts`
  Maps normalized descriptor `kind/type` to default render role.

- `packages/dom-webgl-runtime/src/lib/render/renderableFactory.ts`
  Routes normalized descriptors to focused renderables. No public declaration compatibility branches.

- `packages/dom-webgl-runtime/src/lib/render/renderables/imageRenderable.ts`
  Renders `media/image` descriptors. Supports real `<img>` elements and anchored image textures created from `src`.

- `packages/dom-webgl-runtime/src/lib/render/renderables/videoRenderable.ts`
  Renders `media/video` descriptors. Supports real `<video>` elements and anchored video textures created from `src`.

- `packages/dom-webgl-runtime/src/lib/render/renderables/imageSequenceRenderable.ts`
  Renders `media/image-sequence` descriptors.

- `packages/dom-webgl-runtime/src/lib/render/renderables/modelRenderable.ts`
  Renders `model/glb` descriptors.

- `packages/dom-webgl-runtime/src/lib/effects/effectAuthoring.ts`
  Public effect context/source handle types. Effect code narrows with `ctx.source.kind` and `ctx.source.type`.

- `packages/dom-webgl-runtime/src/lib/effects/effectController.ts`
  Creates effect contexts, static source handles, and compatibility keys from normalized descriptors.

- `packages/dom-webgl-runtime/src/lib/effects/effectCompatibility.ts`
  Keeps effect definition source filtering as string keys such as `media/image`.

- `apps/example/src/*`
  Only consumer app. All declarations and effect guards move to new API.

- `apps/demo/*`
  Delete this app and its tests.

- `scripts/assert-demo-public-imports.mjs`
  Replace with `scripts/assert-example-public-imports.mjs` focused only on `apps/example`.

- `README.md`, `AGENTS.md`, `docs/agent/*`, `docs/examples/*`, `docs/EXECUTION_STATE.md`
  Update current contract. Historical plans may remain historical, but active onboarding/reference docs must not teach old declarations.

## Risk Register

- **Breaking public API:** Type tests and public export tests must reject old source shapes.
- **Anchored media lifecycle:** `media/image` and `media/video` can now run on a `section`/`div` with `src`; renderables must keep anchor layout separate from media element loading.
- **Effect context churn:** Every custom effect guard in `apps/example` and tests must switch from `"image"` / `"video"` / `"snapshot/text"` to `kind/type`.
- **Import boundary drift after demo deletion:** `check:imports` must keep protecting `apps/example` from runtime source imports.
- **Docs drift:** Active docs currently contain many old examples. Do a targeted sweep after tests pass.
- **Package lock drift:** Deleting `apps/demo/package.json` may require `npm install --package-lock-only` or manual package-lock cleanup through npm.

## Phase A: Runtime Contract Migration

### Task 1: Replace Public Source Declaration Types

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/types.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/types.test.ts`
- Modify: `packages/dom-webgl-runtime/src/publicExports.test.ts`

- [ ] **Step 1: Write type tests for the new declaration shape**

In `packages/dom-webgl-runtime/src/lib/types.test.ts`, replace source declaration samples with this exact shape:

```ts
const declarations = [
  {
    key: "dom.element",
    source: { kind: "dom", type: "element" },
  },
  {
    key: "dom.text",
    source: { kind: "dom", type: "text" },
  },
  {
    key: "media.image",
    source: { kind: "media", type: "image", src: "/image.png" },
  },
  {
    key: "media.video",
    source: { kind: "media", type: "video", src: "/video.mp4" },
  },
  {
    key: "media.sequence",
    source: {
      kind: "media",
      type: "image-sequence",
      frameCount: 1,
      frames: [document.createElement("canvas")],
      progressKey: "scrub",
      startFrame: 1,
    },
  },
  {
    key: "model.glb",
    source: { kind: "model", type: "glb", src: "/model.glb" },
  },
] satisfies WebGLDeclaration[];
```

Add compile-time rejection snippets:

```ts
const image = {
  key: "old.image",
  // @ts-expect-error old explicit image source declarations are removed
  source: { kind: "image", src: "/image.png" },
} satisfies WebGLDeclaration;

const snapshot = {
  key: "old.snapshot",
  // @ts-expect-error snapshot/mode has been replaced by dom/type
  source: { kind: "snapshot", mode: "element" },
} satisfies WebGLDeclaration;

const model = {
  key: "old.model",
  // @ts-expect-error model/format has been replaced by model/type
  source: { kind: "model", format: "glb", src: "/model.glb" },
} satisfies WebGLDeclaration;
```

- [ ] **Step 2: Run type tests and confirm they fail before implementation**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/types.test.ts packages/dom-webgl-runtime/src/publicExports.test.ts
```

Expected: FAIL because `kind: "dom"` and `kind: "media"` are not in `WebGLSourceDeclaration` yet, and old public export snippets still use old source shapes.

- [ ] **Step 3: Replace source declaration types in `types.ts`**

In `packages/dom-webgl-runtime/src/lib/types.ts`, replace the current source declaration block with:

```ts
export type WebGLSourceDeclaration =
  | WebGLDOMSourceDeclaration
  | WebGLMediaSourceDeclaration
  | WebGLModelSourceDeclaration;

export type WebGLDOMSourceDeclaration = {
  kind: "dom";
  type?: "element" | "text";
};

export type WebGLMediaSourceDeclaration =
  | WebGLMediaImageSourceDeclaration
  | WebGLMediaVideoSourceDeclaration
  | WebGLMediaImageSequenceSourceDeclaration;

export type WebGLMediaImageSourceDeclaration = {
  kind: "media";
  type: "image";
  src?: string;
};

export type WebGLMediaVideoPlaybackDeclaration = {
  muted?: boolean;
  loop?: boolean;
  autoplay?: boolean;
  playsInline?: boolean;
  playbackRate?: number;
  visibility?: "pause-resume" | "continue";
};

export type WebGLMediaVideoSourceDeclaration = {
  kind: "media";
  type: "video";
  src?: string;
  playback?: WebGLMediaVideoPlaybackDeclaration;
};

export type WebGLImageSequenceFrame =
  | HTMLImageElement
  | HTMLCanvasElement
  | ImageBitmap;

export type WebGLMediaImageSequenceSourceDeclaration = {
  kind: "media";
  type: "image-sequence";
  frameCount: number;
  frames: readonly WebGLImageSequenceFrame[];
  progressKey?: string;
  startFrame?: number;
};

export type WebGLModelSourceDeclaration = {
  kind: "model";
  type: "glb";
  src: string;
};
```

- [ ] **Step 4: Update public export compile snippets**

In `packages/dom-webgl-runtime/src/publicExports.test.ts`, update all `WebGLDeclaration` examples to the new shape:

```ts
const declarations = [
  { key: "surface", source: { kind: "dom", type: "element" } },
  { key: "text", source: { kind: "dom", type: "text" } },
  { key: "image", source: { kind: "media", type: "image", src: "/image.png" } },
  { key: "video", source: { kind: "media", type: "video", src: "/video.mp4" } },
  {
    key: "sequence",
    source: {
      kind: "media",
      type: "image-sequence",
      frameCount: 1,
      frames: [document.createElement("canvas")],
    },
  },
  { key: "model", source: { kind: "model", type: "glb", src: "/product.glb" } },
] satisfies WebGLDeclaration[];
```

- [ ] **Step 5: Verify type-level task**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/types.test.ts packages/dom-webgl-runtime/src/publicExports.test.ts
```

Expected: the `types.test.ts` cases pass; `publicExports.test.ts` may still fail on effect context snippets until Task 4.

- [ ] **Step 6: Commit Task 1**

```bash
git add packages/dom-webgl-runtime/src/lib/types.ts packages/dom-webgl-runtime/src/lib/types.test.ts packages/dom-webgl-runtime/src/publicExports.test.ts
git commit -m "feat: replace source declarations with kind type model"
```

### Task 2: Normalize Internal Source Descriptors

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/source/sourceDescriptor.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/source/inferSource.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/source/inferSource.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/source/sourceDescriptor.test.ts`

- [ ] **Step 1: Write failing inference tests**

In `packages/dom-webgl-runtime/src/lib/source/inferSource.test.ts`, replace old declaration tests with:

```ts
test("infers media/image for IMG targets without explicit source", () => {
  const element = document.createElement("img");
  element.setAttribute("src", "/image.png");

  expect(inferSourceDescriptor(createTargetDescriptor(element, { key: "image" }, 0))).toEqual({
    kind: "media",
    type: "image",
    anchor: element,
    element,
    src: "/image.png",
  });
});

test("infers media/video for VIDEO targets without explicit source", () => {
  const element = document.createElement("video");
  element.setAttribute("src", "/video.mp4");

  expect(inferSourceDescriptor(createTargetDescriptor(element, { key: "video" }, 0))).toEqual({
    kind: "media",
    type: "video",
    anchor: element,
    element,
    src: "/video.mp4",
    playback: undefined,
  });
});

test("uses a section as an anchored media/image source when src is declared", () => {
  const element = document.createElement("section");

  expect(
    inferSourceDescriptor(
      createTargetDescriptor(
        element,
        {
          key: "hero",
          source: { kind: "media", type: "image", src: "/hero.png" },
        },
        0,
      ),
    ),
  ).toEqual({
    kind: "media",
    type: "image",
    anchor: element,
    element: undefined,
    src: "/hero.png",
  });
});

test("rejects anchored media/image without a src", () => {
  const element = document.createElement("section");

  expect(() =>
    inferSourceDescriptor(
      createTargetDescriptor(
        element,
        {
          key: "hero",
          source: { kind: "media", type: "image" },
        },
        0,
      ),
    ),
  ).toThrow('WebGL target "hero" declares media/image on a non-IMG element without src.');
});

test("normalizes media/image-sequence to an anchored descriptor", () => {
  const element = document.createElement("section");
  const frame = document.createElement("canvas");

  expect(
    inferSourceDescriptor(
      createTargetDescriptor(
        element,
        {
          key: "sequence",
          source: {
            kind: "media",
            type: "image-sequence",
            frameCount: 1,
            frames: [frame],
            progressKey: "scrub",
          },
        },
        0,
      ),
    ),
  ).toEqual({
    kind: "media",
    type: "image-sequence",
    anchor: element,
    frameCount: 1,
    frames: [frame],
    progressKey: "scrub",
    startFrame: 1,
  });
});

test("rejects old explicit source kinds at runtime", () => {
  const element = document.createElement("section");

  expect(() =>
    inferSourceDescriptor(
      createTargetDescriptor(
        element,
        {
          key: "old",
          source: { kind: "image", src: "/legacy.png" } as never,
        },
        0,
      ),
    ),
  ).toThrow('Unsupported WebGL source declaration kind "image" on target "old".');
});
```

- [ ] **Step 2: Run inference tests and confirm failure**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/source/inferSource.test.ts packages/dom-webgl-runtime/src/lib/source/sourceDescriptor.test.ts
```

Expected: FAIL because descriptors still use `snapshot`, `image`, `video`, `image-sequence`, and `model.format`.

- [ ] **Step 3: Replace internal descriptors**

In `packages/dom-webgl-runtime/src/lib/source/sourceDescriptor.ts`, replace all descriptor types with:

```ts
import type {
  WebGLImageSequenceFrame,
  WebGLMediaVideoPlaybackDeclaration,
} from "../types";

export type WebGLSourceDescriptor =
  | WebGLDOMSourceDescriptor
  | WebGLMediaSourceDescriptor
  | WebGLModelSourceDescriptor;

export type WebGLDOMSourceDescriptor = {
  kind: "dom";
  type: "element" | "text";
  element: HTMLElement;
};

export type WebGLMediaSourceDescriptor =
  | WebGLMediaImageSourceDescriptor
  | WebGLMediaVideoSourceDescriptor
  | WebGLMediaImageSequenceSourceDescriptor;

export type WebGLMediaImageSourceDescriptor = {
  kind: "media";
  type: "image";
  anchor: HTMLElement;
  element?: HTMLImageElement;
  src: string;
};

export type WebGLMediaVideoSourceDescriptor = {
  kind: "media";
  type: "video";
  anchor: HTMLElement;
  element?: HTMLVideoElement;
  src: string;
  playback?: WebGLMediaVideoPlaybackDeclaration;
};

export type WebGLMediaImageSequenceSourceDescriptor = {
  kind: "media";
  type: "image-sequence";
  anchor: HTMLElement;
  frameCount: number;
  frames: readonly WebGLImageSequenceFrame[];
  progressKey?: string;
  startFrame: number;
};

export type WebGLModelSourceDescriptor = {
  kind: "model";
  type: "glb";
  anchor: HTMLElement;
  src: string;
};
```

- [ ] **Step 4: Replace `inferSourceDescriptor`**

In `packages/dom-webgl-runtime/src/lib/source/inferSource.ts`, implement the new normalized flow:

```ts
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
    case "model":
      if (declaredSource.type !== "glb") {
        throw new Error(
          `Unsupported model source type "${String(declaredSource.type)}". Only "glb" is supported.`,
        );
      }

      return {
        kind: "model",
        type: "glb",
        anchor: element,
        src: declaredSource.src,
      };
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
```

- [ ] **Step 5: Update source descriptor tests**

In `packages/dom-webgl-runtime/src/lib/source/sourceDescriptor.test.ts`, change descriptor samples to:

```ts
const descriptors: WebGLSourceDescriptor[] = [
  { kind: "dom", type: "element", element },
  { kind: "dom", type: "text", element },
  { kind: "media", type: "image", anchor: image, element: image, src: "/image.png" },
  { kind: "media", type: "video", anchor: video, element: video, src: "/video.mp4" },
  {
    kind: "media",
    type: "image-sequence",
    anchor: element,
    frameCount: 1,
    frames: [document.createElement("canvas")],
    startFrame: 1,
  },
  { kind: "model", type: "glb", anchor: element, src: "/model.glb" },
];
```

- [ ] **Step 6: Verify descriptor task**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/source/inferSource.test.ts packages/dom-webgl-runtime/src/lib/source/sourceDescriptor.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Task 2**

```bash
git add packages/dom-webgl-runtime/src/lib/source/sourceDescriptor.ts packages/dom-webgl-runtime/src/lib/source/inferSource.ts packages/dom-webgl-runtime/src/lib/source/inferSource.test.ts packages/dom-webgl-runtime/src/lib/source/sourceDescriptor.test.ts
git commit -m "feat: normalize source descriptors around kind type"
```

### Task 3: Route And Render The New Descriptor Model

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderRole.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderRole.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderableFactory.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderableFactory.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/imageRenderable.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/imageRenderable.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/videoRenderable.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/videoRenderable.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/imageSequenceRenderable.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/imageSequenceRenderable.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/modelRenderable.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/render/renderables/modelRenderable.test.ts`

- [ ] **Step 1: Write failing render role tests**

In `renderRole.test.ts`, change cases to:

```ts
test.each([
  ["dom element", { kind: "dom", type: "element", element }, "surface"],
  ["dom text", { kind: "dom", type: "text", element }, "content"],
  ["media image", { kind: "media", type: "image", anchor: image, element: image, src: "/image.png" }, "media"],
  ["media video", { kind: "media", type: "video", anchor: video, element: video, src: "/video.mp4" }, "media"],
  [
    "media image-sequence",
    {
      kind: "media",
      type: "image-sequence",
      anchor: element,
      frameCount: 1,
      frames: [document.createElement("canvas")],
      startFrame: 1,
    },
    "media",
  ],
  ["model glb", { kind: "model", type: "glb", anchor: element, src: "/model.glb" }, "model"],
] satisfies Array<[string, WebGLSourceDescriptor, WebGLRenderRole]>)(
  "infers %s as %s",
  (_name, source, expected) => {
    expect(inferRenderRole(source)).toBe(expected);
  },
);
```

- [ ] **Step 2: Run render tests and confirm failure**

Run:

```bash
npm test -- --run packages/dom-webgl-runtime/src/lib/render/renderRole.test.ts packages/dom-webgl-runtime/src/lib/render/renderableFactory.test.ts
```

Expected: FAIL because routing still switches on old descriptor kinds.

- [ ] **Step 3: Update render role inference**

In `renderRole.ts`, use kind/type only:

```ts
export function inferRenderRole(source: WebGLSourceDescriptor): WebGLRenderRole {
  switch (source.kind) {
    case "dom":
      return source.type === "text" ? "content" : "surface";
    case "media":
      return "media";
    case "model":
      return "model";
  }
}
```

- [ ] **Step 4: Update renderable factory routing**

In `renderableFactory.ts`, change factory routing to:

```ts
switch (sourceDescriptor.kind) {
  case "dom":
    if (sourceDescriptor.type === "element") {
      return createElementSnapshotRenderable(renderableContext, {
        sceneAdapter: context.sceneAdapter,
        measureElement: context.measureElement,
        getViewportSize: context.getViewportSize,
      });
    }

    return createTextSnapshotRenderable(renderableContext, {
      sceneAdapter: context.sceneAdapter,
      measureElement: context.measureElement,
      getViewportSize: context.getViewportSize,
    });
  case "media":
    if (sourceDescriptor.type === "image") {
      return createImageRenderable(renderableContext, {
        resourceManager: context.resourceManager,
        sceneAdapter: context.sceneAdapter,
        measureElement: context.measureElement,
        getViewportSize: context.getViewportSize,
      });
    }

    if (sourceDescriptor.type === "video") {
      return createVideoRenderable(renderableContext, {
        resourceManager: context.resourceManager,
        sceneAdapter: context.sceneAdapter,
        measureElement: context.measureElement,
        getViewportSize: context.getViewportSize,
        loadVideo: context.loadVideo,
      });
    }

    return createImageSequenceRenderable(renderableContext, {
      sceneAdapter: context.sceneAdapter,
      measureElement: context.measureElement,
      getViewportSize: context.getViewportSize,
      progressSignals: context.progressSignals,
    });
  case "model":
    return createModelRenderable(renderableContext, {
      resourceManager: context.resourceManager,
      sceneAdapter: context.sceneAdapter,
      measureElement: context.measureElement,
      getViewportSize: context.getViewportSize,
      loadModel: context.loadModel,
    });
}
```

Replace `readSourceDescriptorKind` with:

```ts
function readSourceDescriptorKind(sourceDescriptor: WebGLSourceDescriptor): string {
  return `${sourceDescriptor.kind}/${sourceDescriptor.type}`;
}
```

- [ ] **Step 5: Update image renderable source reading**

In `imageRenderable.ts`, replace the source type and reader with:

```ts
import type { WebGLMediaImageSourceDescriptor } from "../../source/sourceDescriptor";

function readImageSource(
  source: RenderableContext["source"],
): WebGLMediaImageSourceDescriptor {
  if (source.kind !== "media" || source.type !== "image") {
    throw new Error(
      `Expected media/image source descriptor, received ${readSourceKind(source)}`,
    );
  }

  return source;
}

function readSourceKind(source: RenderableContext["source"]): string {
  return `${source.kind}/${source.type}`;
}
```

Replace `loadDomImage` with:

```ts
async function loadDomImage(
  source: WebGLMediaImageSourceDescriptor,
): Promise<HTMLImageElement> {
  const image = source.element ?? new Image();

  if (!source.element) {
    image.decoding = "async";
    image.src = source.src;
  }

  if (typeof image.decode === "function") {
    await image.decode();
  }

  return image;
}
```

When creating the scene controller, pass the anchor:

```ts
element: source.anchor,
```

- [ ] **Step 6: Update video renderable source reading**

In `videoRenderable.ts`, replace the source type and reader with:

```ts
import type { WebGLMediaVideoSourceDescriptor } from "../../source/sourceDescriptor";

function readVideoSource(
  source: RenderableContext["source"],
): WebGLMediaVideoSourceDescriptor {
  if (source.kind !== "media" || source.type !== "video") {
    throw new Error(
      `Expected media/video source descriptor, received ${readSourceKind(source)}`,
    );
  }

  return source;
}

function readSourceKind(source: RenderableContext["source"]): string {
  return `${source.kind}/${source.type}`;
}
```

Replace `loadDomVideo` with:

```ts
function createVideoElement(source: WebGLMediaVideoSourceDescriptor): HTMLVideoElement {
  const video = source.element ?? document.createElement("video");

  if (!source.element) {
    video.src = source.src;
  }

  const playback = source.playback;
  if (playback) {
    if (typeof playback.muted === "boolean") {
      video.muted = playback.muted;
    }
    if (typeof playback.loop === "boolean") {
      video.loop = playback.loop;
    }
    if (typeof playback.autoplay === "boolean") {
      video.autoplay = playback.autoplay;
    }
    if (typeof playback.playsInline === "boolean") {
      video.playsInline = playback.playsInline;
    }
    if (typeof playback.playbackRate === "number") {
      video.playbackRate = playback.playbackRate;
    }
  }

  return video;
}

async function loadDomVideo(
  source: WebGLMediaVideoSourceDescriptor,
): Promise<HTMLVideoElement> {
  const video = createVideoElement(source);

  if (video.error) {
    throw new Error(readVideoErrorMessage(video.error));
  }

  if (video.readyState >= 2) {
    return video;
  }

  return new Promise<HTMLVideoElement>((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener("loadeddata", handleReady);
      video.removeEventListener("canplay", handleReady);
      video.removeEventListener("error", handleError);
    };
    const handleReady = () => {
      cleanup();
      resolve(video);
    };
    const handleError = () => {
      cleanup();
      reject(
        new Error(
          video.error ? readVideoErrorMessage(video.error) : "Video resource failed",
        ),
      );
    };

    video.addEventListener("loadeddata", handleReady, { once: true });
    video.addEventListener("canplay", handleReady, { once: true });
    video.addEventListener("error", handleError, { once: true });
    if (!source.element) {
      video.load();
    }
  });
}
```

When creating the scene controller, pass:

```ts
element: source.anchor,
textureSource: video,
```

When pausing on visibility/dispose, pause the loaded texture source, not only `source.element`. Store it in state:

```ts
video: undefined as HTMLVideoElement | undefined,
```

and use:

```ts
state.video?.pause();
```

- [ ] **Step 7: Update image-sequence and model renderables**

In `imageSequenceRenderable.ts`, update reader guards:

```ts
function readImageSequenceSource(
  source: RenderableContext["source"],
): WebGLMediaImageSequenceSourceDescriptor {
  if (source.kind !== "media" || source.type !== "image-sequence") {
    throw new Error(
      `Expected media/image-sequence source descriptor, received ${source.kind}/${source.type}`,
    );
  }

  return source;
}
```

In `modelRenderable.ts`, update reader guards:

```ts
function readModelSource(
  source: RenderableContext["source"],
): WebGLModelSourceDescriptor {
  if (source.kind !== "model" || source.type !== "glb") {
    throw new Error(
      `Expected model/glb source descriptor, received ${source.kind}/${source.type}`,
    );
  }

  return source;
}
```

- [ ] **Step 8: Update renderable tests for anchored media**

In `imageRenderable.test.ts`, add:

```ts
test("uses the anchor element for layout and an off-DOM image for media texture", async () => {
  const anchor = document.createElement("section");
  const source = {
    kind: "media",
    type: "image",
    anchor,
    src: "/hero.png",
  } satisfies WebGLMediaImageSourceDescriptor;

  const renderable = createImageRenderable(createRenderableContext(source), {
    resourceManager: createResourceManager(),
    sceneAdapter,
    measureElement,
    getViewportSize,
  });

  await renderable.update(createFrameInput());

  expect(sceneAdapter.added[0]?.element).toBe(anchor);
});
```

In `videoRenderable.test.ts`, add:

```ts
test("uses the anchor element for layout and an off-DOM video for media texture", async () => {
  const anchor = document.createElement("section");
  const source = {
    kind: "media",
    type: "video",
    anchor,
    src: "/hero.mp4",
    playback: { muted: true, loop: true, playsInline: true },
  } satisfies WebGLMediaVideoSourceDescriptor;

  const renderable = createVideoRenderable(createRenderableContext(source), {
    resourceManager: createResourceManager(),
    sceneAdapter,
    measureElement,
    getViewportSize,
    loadVideo: async () => {
      const video = document.createElement("video");
      video.src = "/hero.mp4";
      return video;
    },
  });

  await renderable.update(createFrameInput());

  expect(sceneAdapter.added[0]?.element).toBe(anchor);
});
```

- [ ] **Step 9: Verify render routing**

Run:

```bash
npm test -- --run \
  packages/dom-webgl-runtime/src/lib/render/renderRole.test.ts \
  packages/dom-webgl-runtime/src/lib/render/renderableFactory.test.ts \
  packages/dom-webgl-runtime/src/lib/render/renderables/imageRenderable.test.ts \
  packages/dom-webgl-runtime/src/lib/render/renderables/videoRenderable.test.ts \
  packages/dom-webgl-runtime/src/lib/render/renderables/imageSequenceRenderable.test.ts \
  packages/dom-webgl-runtime/src/lib/render/renderables/modelRenderable.test.ts
```

Expected: PASS.

- [ ] **Step 10: Commit Task 3**

```bash
git add packages/dom-webgl-runtime/src/lib/render
git commit -m "feat: route renderables through source kind type descriptors"
```

### Task 4: Unify Effect Context Around `kind` And `type`

**Files:**
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectAuthoring.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectController.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectCompatibility.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectController.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/effects/effectAuthoring.test.ts`
- Modify: `packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts`
- Modify: `packages/dom-webgl-runtime/src/publicExports.test.ts`
- Modify renderable files that return `effectSource()`

- [ ] **Step 1: Write failing effect context tests**

In `effectController.test.ts`, replace old source-kind expectations with:

```ts
test("creates media/image effect contexts with kind and type", () => {
  const element = document.createElement("img");
  const source = {
    kind: "media",
    type: "image",
    anchor: element,
    element,
    src: "/image.png",
  } satisfies WebGLSourceDescriptor;
  const updates: WebGLEffectContext[] = [];

  const effect = defineWebGLEffect({
    kind: "test.media",
    source: "media/image",
    update(ctx) {
      updates.push(ctx);
    },
  });

  const controller = createWebGLEffectController({
    key: "image",
    source,
    declaration: [{ kind: "test.media" }],
    registry: createWebGLEffectRegistry([effect]),
  });

  controller.update(createFrameInput(), createLayout());

  expect(updates[0]?.source).toMatchObject({
    kind: "media",
    type: "image",
    element,
    src: "/image.png",
  });
  expect(updates[0]?.sourceKind).toBe("media/image");
});
```

In `effectAuthoring.test.ts`, update image-sequence tests to narrow as:

```ts
if (ctx.source.kind !== "media" || ctx.source.type !== "image-sequence") {
  return;
}
ctx.source.image?.setTextureTransform({ offsetX: 0.2 });
```

- [ ] **Step 2: Run effect tests and confirm failure**

Run:

```bash
npm test -- --run \
  packages/dom-webgl-runtime/src/lib/effects/effectController.test.ts \
  packages/dom-webgl-runtime/src/lib/effects/effectAuthoring.test.ts \
  packages/dom-webgl-runtime/src/publicExports.test.ts
```

Expected: FAIL because effect source handles still expose `"snapshot/text"`, `"image"`, `"video"`, `"image-sequence"`, and `"model/glb"` as `ctx.source.kind` values.

- [ ] **Step 3: Replace effect source handle types**

In `effectAuthoring.ts`, replace `WebGLEffectSourceKind` with:

```ts
export type WebGLEffectSourceKind =
  | "dom/element"
  | "dom/text"
  | "media/image"
  | "media/video"
  | "media/image-sequence"
  | "model/glb";
```

Replace `WebGLEffectSourceHandle` with:

```ts
export type WebGLEffectSourceHandle =
  | {
      kind: "dom";
      type: "element";
      element: HTMLElement;
      surface?: WebGLEffectCanvasSurfaceHandle;
    }
  | {
      kind: "dom";
      type: "text";
      element: HTMLElement;
      text: string;
      textLayer?: WebGLEffectTextLayerHandle;
    }
  | {
      kind: "media";
      type: "image";
      element: HTMLElement;
      src: string;
      image?: WebGLEffectTextureLayerHandle<HTMLImageElement>;
    }
  | {
      kind: "media";
      type: "video";
      element: HTMLElement;
      src: string;
      video?: WebGLEffectVideoLayerHandle;
    }
  | {
      kind: "media";
      type: "image-sequence";
      element: HTMLElement;
      frame: number;
      src: string;
      image?: WebGLEffectImageSequenceLayerHandle;
    }
  | {
      kind: "model";
      type: "glb";
      anchor: HTMLElement;
      src: string;
      model: WebGLModelEffectHandle;
    };
```

- [ ] **Step 4: Update static source creation and source compatibility keys**

In `effectController.ts`, replace `createStaticEffectSource` and `readEffectSourceKind` with:

```ts
function createStaticEffectSource(
  source: WebGLSourceDescriptor,
): WebGLEffectSourceHandle | undefined {
  if (source.kind === "dom") {
    if (source.type === "text") {
      return {
        kind: "dom",
        type: "text",
        element: source.element,
        text: source.element.textContent ?? "",
      };
    }

    return { kind: "dom", type: "element", element: source.element };
  }

  if (source.kind === "media") {
    if (source.type === "image") {
      return {
        kind: "media",
        type: "image",
        element: source.anchor,
        src: source.src,
      };
    }

    if (source.type === "video") {
      return {
        kind: "media",
        type: "video",
        element: source.anchor,
        src: source.src,
      };
    }

    return {
      kind: "media",
      type: "image-sequence",
      element: source.anchor,
      frame: source.startFrame,
      src: "",
    };
  }

  return undefined;
}

function readEffectSourceKind(
  source: WebGLSourceDescriptor,
): WebGLEffectSourceKind {
  return `${source.kind}/${source.type}` as WebGLEffectSourceKind;
}
```

Keep `effectCompatibility.ts` unchanged except for tests; it remains responsible only for comparing source filter strings.

- [ ] **Step 5: Update renderable-provided effect sources**

In `elementSnapshotRenderable.ts`, return:

```ts
return {
  kind: "dom",
  type: "element",
  element: context.descriptor.element,
  surface: state.scene?.object.surfaceCapability,
};
```

In `textSnapshotRenderable.ts`, return:

```ts
return {
  kind: "dom",
  type: "text",
  element: context.descriptor.element,
  text: state.textContent,
  textLayer: state.scene?.object.textLayerCapability,
};
```

In `imageRenderable.ts`, return:

```ts
return {
  kind: "media",
  type: "image",
  element: source.anchor,
  src: source.src,
  image: state.scene?.object.textureLayerCapability,
};
```

In `videoRenderable.ts`, return:

```ts
return {
  kind: "media",
  type: "video",
  element: source.anchor,
  src: source.src,
  video: state.scene?.object.videoLayerCapability,
};
```

In `imageSequenceRenderable.ts`, return:

```ts
return {
  kind: "media",
  type: "image-sequence",
  element: source.anchor,
  frame: state.frame,
  src: state.src,
  image: state.scene?.object.textureLayerCapability,
};
```

In `modelRenderable.ts`, return:

```ts
return {
  kind: "model",
  type: "glb",
  anchor: source.anchor,
  src: source.src,
  model: state.scene.object.modelCapability,
};
```

- [ ] **Step 6: Update public export effect snippets**

In `publicExports.test.ts`, update custom effect examples:

```ts
const imageEffect = defineWebGLEffect({
  kind: "test.image",
  source: "media/image",
  update(ctx) {
    if (ctx.source.kind !== "media" || ctx.source.type !== "image") {
      return;
    }
    ctx.source.image?.setTextureTransform({ offsetX: 0.1 });
  },
});

const textEffect = defineWebGLEffect({
  kind: "test.text",
  source: "dom/text",
  update(ctx) {
    if (ctx.source.kind !== "dom" || ctx.source.type !== "text") {
      return;
    }
    ctx.source.textLayer?.setText(ctx.source.text.toUpperCase());
  },
});

const modelEffect = defineWebGLEffect({
  kind: "test.model",
  source: "model/glb",
  update(ctx) {
    if (ctx.source.kind !== "model" || ctx.source.type !== "glb") {
      return;
    }
    ctx.source.model.setRotation?.(0, 1, 0);
  },
});
```

- [ ] **Step 7: Verify effect context task**

Run:

```bash
npm test -- --run \
  packages/dom-webgl-runtime/src/lib/effects/effectController.test.ts \
  packages/dom-webgl-runtime/src/lib/effects/effectAuthoring.test.ts \
  packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts \
  packages/dom-webgl-runtime/src/publicExports.test.ts
```

Expected: PASS after all effect source and compatibility strings are updated.

- [ ] **Step 8: Commit Task 4**

```bash
git add packages/dom-webgl-runtime/src/lib/effects packages/dom-webgl-runtime/src/lib/render/renderables packages/dom-webgl-runtime/src/lib/renderer/runtimePipeline.test.ts packages/dom-webgl-runtime/src/publicExports.test.ts
git commit -m "feat: unify effect source context by kind type"
```

## Phase B: Consumer Surface, Demo Removal, Docs, And Verification

### Task 5: Migrate `apps/example` To The New API

**Files:**
- Modify: `apps/example/src/App.tsx`
- Modify: `apps/example/src/SnapshotElementExamples.tsx`
- Modify: `apps/example/src/PinnedScrollExample.tsx`
- Modify: `apps/example/src/*.test.tsx`
- Modify: `apps/example/src/*Effects.ts`
- Modify: `apps/example/src/*Effects.test.ts`
- Modify: `apps/example/test/effectSourceHandles.ts`

- [ ] **Step 1: Write/update example expectation tests**

In `apps/example/src/App.test.tsx`, update expected source declarations:

```ts
expect(registeredSources).toEqual([
  { kind: "dom", type: "element" },
  { kind: "dom", type: "element" },
  { kind: "dom", type: "element" },
  { kind: "dom", type: "element" },
  { kind: "dom", type: "element" },
  { kind: "dom", type: "text" },
  { kind: "dom", type: "text" },
  { kind: "dom", type: "text" },
  { kind: "media", type: "image", src: "/example/image.png" },
  { kind: "media", type: "image", src: "/example/image.png" },
  { kind: "media", type: "image", src: "/example/bg.png" },
  { kind: "media", type: "video", src: "/example/video.mp4" },
  { kind: "media", type: "video", src: "/example/video.mp4" },
  {
    kind: "media",
    type: "image-sequence",
    frameCount: exampleResources.imageSequenceFrames.length,
    frames: exampleResources.imageSequenceFrames,
    progressKey: videoScrubProgressKey,
  },
  { kind: "model", type: "glb", src: "/models/hero.glb" },
  { kind: "model", type: "glb", src: "/models/hero.glb" },
]);
```

- [ ] **Step 2: Run example tests and confirm failure**

Run:

```bash
npm test -- --run apps/example/src/App.test.tsx apps/example/src/PinnedScrollExample.test.tsx apps/example/src/mediaEffects.test.ts apps/example/src/textEffects.test.ts apps/example/src/modelEffects.test.ts apps/example/src/surfaceEffects.test.ts
```

Expected: FAIL because example declarations and effect guards still use old source shapes.

- [ ] **Step 3: Update example declarations**

Replace declarations in `apps/example/src/App.tsx`:

```tsx
source: { kind: "dom", type: "text" }
source: { kind: "media", type: "image", src: "/example/image.png" }
source: { kind: "media", type: "video", src: "/example/video.mp4" }
```

Replace the image sequence declaration with:

```tsx
source: {
  kind: "media",
  type: "image-sequence",
  frameCount: exampleResources.imageSequenceFrames.length,
  frames: exampleResources.imageSequenceFrames,
  progressKey: videoScrubProgressKey,
}
```

Replace model declarations with:

```tsx
source: { kind: "model", type: "glb", src: "/models/hero.glb" }
```

Replace declarations in `SnapshotElementExamples.tsx` and `PinnedScrollExample.tsx`:

```tsx
source: { kind: "dom", type: "element" }
source: { kind: "dom", type: "text" }
```

- [ ] **Step 4: Update example effect guards**

Replace old guards:

```ts
if (ctx.source.kind !== "snapshot/element") return;
if (ctx.source.kind !== "snapshot/text") return;
if (ctx.source.kind !== "image") return;
if (ctx.source.kind !== "video") return;
if (ctx.source.kind !== "model/glb") return;
```

with:

```ts
if (ctx.source.kind !== "dom" || ctx.source.type !== "element") return;
if (ctx.source.kind !== "dom" || ctx.source.type !== "text") return;
if (ctx.source.kind !== "media" || ctx.source.type !== "image") return;
if (ctx.source.kind !== "media" || ctx.source.type !== "video") return;
if (ctx.source.kind !== "model" || ctx.source.type !== "glb") return;
```

In `apps/example/src/mediaEffects.ts`, use media-specific handles after narrowing:

```ts
if (ctx.source.kind !== "media" || ctx.source.type !== "image") {
  return;
}
ctx.source.image?.setTextureTransform({ offsetX: params.offsetX ?? 0 });
```

In `apps/example/src/textEffects.ts`, use:

```ts
if (ctx.source.kind !== "dom" || ctx.source.type !== "text") {
  return;
}
ctx.source.textLayer?.setGlyphs((glyphs) => glyphs.map((glyph) => ({ index: glyph.index })));
```

- [ ] **Step 5: Update example effect source filter strings**

Replace effect definitions:

```ts
source: "snapshot/element"
source: "snapshot/text"
source: "image"
source: "video"
source: "image-sequence"
source: "model/glb"
```

with:

```ts
source: "dom/element"
source: "dom/text"
source: "media/image"
source: "media/video"
source: "media/image-sequence"
source: "model/glb"
```

- [ ] **Step 6: Verify example migration**

Run:

```bash
npm test -- --run apps/example/src apps/example/test
```

Expected: PASS for all example tests.

- [ ] **Step 7: Commit Task 5**

```bash
git add apps/example
git commit -m "feat: migrate example to unified source api"
```

### Task 6: Delete `apps/demo` And Keep Import Boundary Guarding

**Files:**
- Delete: `apps/demo`
- Delete: `scripts/assert-demo-public-imports.mjs`
- Create: `scripts/assert-example-public-imports.mjs`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `workspace.test.ts`
- Modify: any tests that reference `apps/demo`

- [ ] **Step 1: Confirm demo references before deletion**

Run:

```bash
rg -n "apps/demo|dom-webgl-demo|@project/dom-webgl-demo|assert-demo-public-imports|Demo and example|demo import" package.json package-lock.json workspace.test.ts scripts apps packages docs README.md AGENTS.md
```

Expected: output lists every remaining demo reference. Save the terminal output for the execution summary.

- [ ] **Step 2: Delete demo app**

Run:

```bash
rm -rf apps/demo
```

This deletion is explicitly requested by the user. Do not delete `apps/example`.

- [ ] **Step 3: Replace import boundary script**

Create `scripts/assert-example-public-imports.mjs` with:

```js
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const IMPORT_PATTERN =
  /\b(?:import|export)\b[\s\S]*?\bfrom\s*["']([^"']+)["']|\bimport\s*["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)|\brequire\s*\(\s*["']([^"']+)["']\s*\)/g;

const ALLOWED_PUBLIC_IMPORTS = new Set([
  "@project/dom-webgl-runtime",
  "@project/dom-webgl-runtime/react",
]);

const SOURCE_FILE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mts",
  ".cts",
  ".mjs",
  ".cjs",
]);

export async function findExampleImportViolations({
  workspaceRoot = defaultWorkspaceRoot(),
  exampleSourceDir = path.join(workspaceRoot, "apps", "example", "src"),
} = {}) {
  const files = await collectSourceFiles(exampleSourceDir);
  const runtimeSourceDir = path.resolve(
    workspaceRoot,
    "packages",
    "dom-webgl-runtime",
    "src",
  );
  const violations = [];

  for (const file of files) {
    const source = await readFile(file, "utf8");
    for (const specifier of collectImportSpecifiers(source)) {
      const reason = getViolationReason({
        specifier,
        file,
        exampleSourceDir,
        runtimeSourceDir,
      });
      if (reason) {
        violations.push({ file, specifier, reason });
      }
    }
  }

  return violations;
}

async function collectSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectSourceFiles(entryPath)));
      continue;
    }
    if (entry.name.includes(".test.")) {
      continue;
    }
    if (SOURCE_FILE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(entryPath);
    }
  }

  return files;
}

function collectImportSpecifiers(source) {
  const specifiers = [];
  for (const match of source.matchAll(IMPORT_PATTERN)) {
    const specifier = match[1] ?? match[2] ?? match[3] ?? match[4];
    if (specifier) {
      specifiers.push(specifier);
    }
  }
  return specifiers;
}

function getViolationReason({
  specifier,
  file,
  exampleSourceDir,
  runtimeSourceDir,
}) {
  if (specifier.startsWith("@project/dom-webgl-runtime/")) {
    return ALLOWED_PUBLIC_IMPORTS.has(specifier)
      ? null
      : "non-public runtime alias import";
  }

  if (
    specifier === "packages/dom-webgl-runtime/src" ||
    specifier.startsWith("packages/dom-webgl-runtime/src/")
  ) {
    return "workspace runtime source import";
  }

  if (!specifier.startsWith(".")) {
    return null;
  }

  const resolved = path.resolve(path.dirname(file), specifier);
  if (isInside(resolved, runtimeSourceDir)) {
    return "relative import reaches runtime source";
  }
  if (isInside(resolved, exampleSourceDir)) {
    return null;
  }

  return null;
}

function isInside(candidatePath, parentPath) {
  const relativePath = path.relative(parentPath, candidatePath);
  return (
    relativePath === "" ||
    (!relativePath.startsWith("..") && !path.isAbsolute(relativePath))
  );
}

function defaultWorkspaceRoot() {
  const currentFile = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(currentFile), "..");
}

function formatViolations(violations, workspaceRoot) {
  return violations.map(({ file, specifier, reason }) => {
    const relativeFile = path.relative(workspaceRoot, file) || file;
    return `${relativeFile}: ${specifier} (${reason})`;
  });
}

async function main() {
  const workspaceRoot = defaultWorkspaceRoot();
  const violations = await findExampleImportViolations({ workspaceRoot });

  if (violations.length === 0) {
    process.stdout.write("Example import boundaries OK\n");
    return;
  }

  process.stderr.write("Example import boundary violations:\n");
  for (const line of formatViolations(violations, workspaceRoot)) {
    process.stderr.write(`- ${line}\n`);
  }
  process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
```

- [ ] **Step 4: Update package script**

In `package.json`, change:

```json
"check:imports": "node ./scripts/assert-demo-public-imports.mjs"
```

to:

```json
"check:imports": "node ./scripts/assert-example-public-imports.mjs"
```

- [ ] **Step 5: Update package lock after workspace deletion**

Run:

```bash
npm install --package-lock-only
```

Expected: `package-lock.json` no longer contains an `apps/demo` package entry.

- [ ] **Step 6: Verify demo references are gone from active code**

Run:

```bash
rg -n "apps/demo|dom-webgl-demo|@project/dom-webgl-demo|assert-demo-public-imports" package.json package-lock.json workspace.test.ts scripts apps packages
```

Expected: no output.

- [ ] **Step 7: Verify import boundary**

Run:

```bash
npm run check:imports
```

Expected:

```text
Example import boundaries OK
```

- [ ] **Step 8: Commit Task 6**

```bash
git add -A apps/demo scripts package.json package-lock.json workspace.test.ts
git commit -m "chore: remove demo app and keep example import guard"
```

### Task 7: Update Active Documentation

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `docs/agent/package-onboarding.md`
- Modify: `docs/agent/package-usage.md`
- Modify: `docs/agent/custom-effects.md`
- Modify: `docs/examples/effect-authoring.md`
- Modify: `docs/examples/third-party-scroll-adapters.md`
- Modify: `docs/EXECUTION_STATE.md`
- Modify: `docs/00-goal.md`

- [ ] **Step 1: Scan active docs for old source contract**

Run:

```bash
rg -n "kind: \"(snapshot|image|video|image-sequence)\"|mode: \"(element|text)\"|format: \"glb\"|ctx\\.source\\.kind !== \"(snapshot|image|video|model)|ctx\\.source\\.kind === \"(snapshot|image|video|model)" README.md AGENTS.md docs/agent docs/examples docs/EXECUTION_STATE.md docs/00-goal.md
```

Expected: output lists active docs that still teach old source API.

- [ ] **Step 2: Update source declaration docs**

Replace the source contract section in `docs/agent/package-usage.md` with:

```md
Source declarations use a two-level model:

- `{ kind: "dom", type?: "element" | "text" }`
- `{ kind: "media", type: "image", src?: string }`
- `{ kind: "media", type: "video", src?: string, playback?: { muted?: boolean, loop?: boolean, autoplay?: boolean, playsInline?: boolean, playbackRate?: number, visibility?: "pause-resume" | "continue" } }`
- `{ kind: "media", type: "image-sequence", frameCount: number, frames: readonly (HTMLImageElement | HTMLCanvasElement | ImageBitmap)[], progressKey?: string, startFrame?: number }`
- `{ kind: "model", type: "glb", src: string }`

Every target still has a DOM anchor. `dom` means the anchor's own content becomes the WebGL source. `media` means external media is rendered as a texture at the anchor's layout box. `model` means an external GLB is anchored to the target element.
```

Replace effect context docs with:

```md
Effects narrow source handles with both fields:

```ts
if (ctx.source.kind !== "media" || ctx.source.type !== "video") {
  return;
}

ctx.source.video?.setPlaybackRate(0.8);
```
```

- [ ] **Step 3: Update onboarding examples**

In `docs/agent/package-onboarding.md`, replace the source mapping table with:

```md
| Desired WebGL source | Declaration |
| --- | --- |
| DOM element surface | `{ kind: "dom", type: "element" }` |
| DOM text layer | `{ kind: "dom", type: "text" }` |
| Image texture on any anchor | `{ kind: "media", type: "image", src }` |
| Video texture on any anchor | `{ kind: "media", type: "video", src }` |
| Image sequence texture on any anchor | `{ kind: "media", type: "image-sequence", frameCount, frames, progressKey }` |
| GLB model on any anchor | `{ kind: "model", type: "glb", src }` |
```

- [ ] **Step 4: Update README and AGENTS current truth**

In `README.md`, replace old media-source warnings with:

```md
Media sources now use `{ kind: "media", type: "image" | "video" | "image-sequence" }`.
The target element is always the layout anchor. For real `img` and `video` targets, `src` can be inferred from the element. For non-media anchors such as `section` or `div`, declare `src` explicitly for image/video media.
```

In `AGENTS.md`, replace the strict image/video note with:

```md
- Source declarations use `kind + type`: `dom/element`, `dom/text`, `media/image`, `media/video`, `media/image-sequence`, and `model/glb`.
- `media/image` and `media/video` may use any HTMLElement as the anchor when `src` is declared. Real `img`/`video` targets can infer `src`.
- Effect code narrows with `ctx.source.kind` and `ctx.source.type`.
```

- [ ] **Step 5: Verify docs sweep**

Run:

```bash
rg -n "kind: \"(snapshot|image|video|image-sequence)\"|mode: \"(element|text)\"|format: \"glb\"|snapshot/text|snapshot/element|ctx\\.source\\.kind !== \"(image|video|snapshot)|ctx\\.source\\.kind === \"(image|video|snapshot)" README.md AGENTS.md docs/agent docs/examples docs/EXECUTION_STATE.md docs/00-goal.md
```

Expected: no old contract in active docs. Historical docs under `docs/superpowers/plans` may still contain old contract because they are archived plans.

- [ ] **Step 6: Commit Task 7**

```bash
git add README.md AGENTS.md docs/agent docs/examples docs/EXECUTION_STATE.md docs/00-goal.md
git commit -m "docs: document unified source kind type contract"
```

### Task 8: Full Verification And Cleanup

**Files:**
- Modify only files needed to fix verification failures.

- [ ] **Step 1: Run full test suite**

Run:

```bash
npm run test -- --run
```

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Run workspace build**

Run:

```bash
npm run build
```

Expected: PASS. The build should include packages and `apps/example`; it should not try to build `apps/demo`.

- [ ] **Step 4: Run import guard**

Run:

```bash
npm run check:imports
```

Expected:

```text
Example import boundaries OK
```

- [ ] **Step 5: Run whitespace check**

Run:

```bash
git diff --check
```

Expected: no output.

- [ ] **Step 6: Run final old-contract sweep**

Run:

```bash
rg -n "kind: \"(snapshot|image|video|image-sequence)\"|mode: \"(element|text)\"|format: \"glb\"|snapshot/text|snapshot/element|model/glb|ctx\\.source\\.kind !== \"(image|video|snapshot|model)|ctx\\.source\\.kind === \"(image|video|snapshot|model)" apps packages README.md AGENTS.md docs/agent docs/examples docs/EXECUTION_STATE.md docs/00-goal.md
```

Expected:

- No old declaration shapes in `apps`, `packages`, active docs.
- `model/glb` may remain only as an effect source filter string, because `WebGLEffectSourceKind` still uses compact compatibility keys.
- Old contract may remain only in archived plan files under `docs/superpowers/plans`, which are intentionally excluded from this command.

- [ ] **Step 7: Inspect git status for accidental generated files**

Run:

```bash
git status --short
```

Expected:

- Source, test, doc, script, package, and lockfile changes are present.
- No `.DS_Store`, `dist`, local output, secret, or temporary files are staged.

- [ ] **Step 8: Commit verification fixes**

If verification required follow-up fixes:

```bash
git add -A
git commit -m "fix: complete source api migration verification"
```

If no follow-up fixes were required, do not create an empty commit.

## Final Acceptance Criteria

- Public declarations only expose `dom`, `media`, and `model` source kinds.
- Public docs do not teach old explicit source declarations.
- `media/image`, `media/video`, and `media/image-sequence` work on arbitrary HTMLElement anchors.
- Real `<img>` and `<video>` targets still infer media sources when `source` is omitted.
- `ctx.source.kind` is one of `dom`, `media`, or `model`.
- `ctx.source.type` is the source subtype.
- Effect source filters use `dom/element`, `dom/text`, `media/image`, `media/video`, `media/image-sequence`, or `model/glb`.
- `apps/demo` is deleted.
- `apps/example` is the only app consumer surface.
- `npm run test -- --run`, `npm run typecheck`, `npm run build`, `npm run check:imports`, and `git diff --check` pass.

## Self-Review

- **Spec coverage:** The plan covers the user-approved source model, non-compatibility requirement, demo deletion, example-only consumer surface, effect context unification, modular responsibilities, docs, and verification.
- **Placeholder scan:** No step uses deferred implementation language. Each code-changing task names exact files, concrete code shapes, and exact verification commands.
- **Type consistency:** Public declaration `kind/type`, internal descriptor `kind/type`, effect context `kind/type`, and effect source filter strings are consistently mapped. `model/glb` remains only as a compact effect compatibility key; declaration and context use `kind: "model", type: "glb"`.
