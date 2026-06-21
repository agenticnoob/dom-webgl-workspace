import { defineWebGLEffect } from "@project/dom-webgl-runtime";

export const demoSurfaceEffect = defineWebGLEffect<{
  kind: "demo.surface";
  opacity?: number;
}>({
  kind: "demo.surface",
  source: "snapshot/element",
  setup(ctx, params) {
    if (ctx.source.kind !== "snapshot/element") {
      return;
    }

    ctx.source.surface?.draw(({ context, width, height }) => {
      context.fillStyle = "rgba(44, 70, 54, 0.82)";
      context.fillRect(0, 0, width, height);
      context.strokeStyle = "rgba(255, 255, 255, 0.38)";
      context.lineWidth = Math.max(2, Math.min(width, height) * 0.012);
      context.strokeRect(
        context.lineWidth / 2,
        context.lineWidth / 2,
        width - context.lineWidth,
        height - context.lineWidth,
      );
    });
    ctx.source.surface?.setVisible?.(true);
    ctx.source.surface?.setOpacity?.(clampNumber(params.opacity, 0, 1, 1));
  },
  update(ctx, _state, params) {
    const opacity = clampNumber(params.opacity, 0, 1, 1);

    ctx.target?.setVisible(true);
    ctx.target?.setOpacity(opacity);

    if (ctx.source.kind !== "snapshot/element") {
      return;
    }

    ctx.source.surface?.setVisible?.(true);
    ctx.source.surface?.setOpacity?.(opacity);
  },
});

export const demoPointerTiltEffect = defineWebGLEffect<{
  kind: "demo.pointerTilt";
  strength?: number;
  maxDegrees?: number;
}>({
  kind: "demo.pointerTilt",
  update(ctx, _state, params) {
    if (!ctx.pointer.isInside) {
      ctx.target?.setRotation(0, 0);
      return;
    }

    const strength = clampNumber(params.strength, 0, 2, 1);
    const maxDegrees = clampNumber(params.maxDegrees, 0, 30, 8);
    const radians = (maxDegrees * Math.PI) / 180;

    ctx.target?.setRotation(
      -ctx.pointer.normalizedY * radians * strength,
      ctx.pointer.normalizedX * radians * strength,
    );
  },
});

export const demoScrollImageZoomEffect = defineWebGLEffect<{
  kind: "demo.scrollImageZoom";
  maxScale?: number;
}>({
  kind: "demo.scrollImageZoom",
  source: "image",
  setup(ctx, params) {
    applyScrollImageZoom(ctx, params);
  },
  update(ctx, _state, params) {
    applyScrollImageZoom(ctx, params);
  },
});

function applyScrollImageZoom(
  ctx: Parameters<typeof demoScrollImageZoomEffect.update>[0],
  params: { maxScale?: number },
) {
  const progress = readStickyStageProgress(ctx);
  const maxScale = clampNumber(params.maxScale, 1, 3, 1.72);
  const scale = 1 + (maxScale - 1) * progress;

  ctx.target?.setScale(scale, scale, 1);
}

function readStickyStageProgress(
  ctx: Parameters<typeof demoScrollImageZoomEffect.update>[0],
): number {
  if (ctx.source.kind !== "image") {
    return 0;
  }

  const stage = ctx.source.element.parentElement;
  const viewportHeight = Math.max(1, ctx.layout.viewport.height);
  const stageRect = stage?.getBoundingClientRect();
  if (!stageRect) {
    return 0;
  }

  const scrollRange = Math.max(1, stageRect.height - viewportHeight);

  return clampNumber(-stageRect.top / scrollRange, 0, 1, 0);
}

export const demoCapabilitySurfaceEffect = defineWebGLEffect<{
  kind: "demo.capabilitySurface";
}>({
  kind: "demo.capabilitySurface",
  source: "snapshot/element",
  setup(ctx) {
    if (ctx.source.kind !== "snapshot/element") {
      return;
    }

    ctx.source.surface?.draw(({ context, width, height }) => {
      context.fillStyle = "rgba(255, 207, 90, 0.42)";
      context.fillRect(0, 0, width, height);
      context.strokeStyle = "rgba(20, 20, 20, 0.82)";
      context.lineWidth = Math.max(2, Math.min(width, height) * 0.015);
      context.strokeRect(
        context.lineWidth / 2,
        context.lineWidth / 2,
        width - context.lineWidth,
        height - context.lineWidth,
      );
    });
    ctx.source.surface?.setOpacity?.(0.55);
    ctx.source.surface?.setVisible?.(true);
  },
  update() {
    return;
  },
});

export const demoCapabilityTextLayerEffect = defineWebGLEffect<{
  kind: "demo.capabilityTextLayer";
}>({
  kind: "demo.capabilityTextLayer",
  source: "snapshot/text",
  setup(ctx) {
    if (ctx.source.kind !== "snapshot/text") {
      return;
    }

    ctx.source.textLayer?.setGlyphs((glyphs) =>
      glyphs.map((glyph) => {
        const lift = glyph.index % 2 === 0 ? -10 : 10;

        return {
          index: glyph.index,
          char: glyph.char.trim() ? (glyph.index % 3 === 0 ? "*" : glyph.char) : glyph.char,
          y: glyph.y + lift,
          color: glyph.index % 2 === 0 ? "#ffcf5a" : "#4be1ec",
          scaleX: glyph.index % 2 === 0 ? 1.08 : 0.92,
          scaleY: glyph.index % 2 === 0 ? 1.28 : 0.86,
          rotation: glyph.index % 2 === 0 ? -0.05 : 0.05,
          opacity: 1,
        };
      }),
    );
  },
  update() {
    return;
  },
});

const SCRAMBLED_TEXT_CHARACTERS = "!<>-_\\/[]{}--=+*^?#________";

type DemoPointerTextState = {
  activity: number;
  lastPointerX: number | undefined;
  lastPointerY: number | undefined;
  lastTime: number | undefined;
};

export const demoScrambledTextEffect = defineWebGLEffect<{
  kind: "demo.scrambledText";
  characters?: string;
  intensity?: number;
  radius?: number;
  speed?: number;
  trailMs?: number;
}, DemoPointerTextState>({
  kind: "demo.scrambledText",
  source: "snapshot/text",
  setup(ctx, params) {
    if (ctx.source.kind !== "snapshot/text") {
      return createPointerTextState();
    }

    const state = createPointerTextState();

    applyScrambledTextGlyphs(ctx, state, params);

    return state;
  },
  update(ctx, state, params) {
    if (ctx.source.kind !== "snapshot/text") {
      return;
    }

    applyScrambledTextGlyphs(ctx, state, params);
  },
});

function applyScrambledTextGlyphs(
  ctx: Parameters<typeof demoScrambledTextEffect.update>[0],
  state: DemoPointerTextState,
  params: {
    characters?: string;
    intensity?: number;
    radius?: number;
    speed?: number;
    trailMs?: number;
  },
) {
  if (ctx.source.kind !== "snapshot/text") {
    return;
  }

  const textLayer = ctx.source.textLayer;
  if (!textLayer) {
    return;
  }

  updatePointerTextActivity(ctx, state, {
    trailMs: params.trailMs,
  });
  const intensity = clampNumber(params.intensity, 0, 1, 0.84) * state.activity;
  const radius = clampNumber(params.radius, 8, 240, 72);
  const speed = clampNumber(params.speed, 1, 32, 12);
  const characters = params.characters?.length
    ? params.characters
    : SCRAMBLED_TEXT_CHARACTERS;
  const frame = Math.floor((ctx.time / 1000) * speed);
  const localPointerX = ctx.pointer.x - ctx.layout.left;
  const localPointerY = ctx.pointer.y - ctx.layout.top;

  textLayer.setGlyphs((glyphs) =>
    glyphs.map((glyph) => {
      const glyphCenterX = glyph.x + glyph.width / 2;
      const glyphCenterY = glyph.y - glyph.height / 2;
      const distance = Math.hypot(
        glyphCenterX - localPointerX,
        glyphCenterY - localPointerY,
      );
      const proximity = Math.max(0, 1 - distance / radius);
      const glyphIntensity = intensity * proximity;

      if (!glyph.char.trim() || glyphIntensity <= 0) {
        return {
          index: glyph.index,
          char: glyph.char,
          opacity: 1,
        };
      }

      const noise = seededUnit(frame, glyph.index);
      const shouldScramble = noise < glyphIntensity;
      const char = shouldScramble
        ? characters[Math.floor(noise * characters.length) % characters.length]
        : glyph.char;
      const jitter = shouldScramble ? (seededUnit(frame + 17, glyph.index) - 0.5) * 3 : 0;

      return {
        index: glyph.index,
        char,
        y: glyph.y + jitter,
        color: shouldScramble ? "#4be1ec" : undefined,
        opacity: 1,
        scaleX: shouldScramble ? 1.04 : 1,
        scaleY: shouldScramble ? 1.08 : 1,
      };
    }),
  );
}

export const demoTextPressureEffect = defineWebGLEffect<{
  kind: "demo.textPressure";
  intensity?: number;
  radius?: number;
  trailMs?: number;
}, DemoPointerTextState>({
  kind: "demo.textPressure",
  source: "snapshot/text",
  setup(ctx, params) {
    const state = createPointerTextState();

    if (ctx.source.kind === "snapshot/text") {
      applyTextPressureGlyphs(ctx, state, params);
    }

    return state;
  },
  update(ctx, state, params) {
    if (ctx.source.kind !== "snapshot/text") {
      return;
    }

    applyTextPressureGlyphs(ctx, state, params);
  },
});

function applyTextPressureGlyphs(
  ctx: Parameters<typeof demoTextPressureEffect.update>[0],
  state: DemoPointerTextState,
  params: {
    intensity?: number;
    radius?: number;
    trailMs?: number;
  },
) {
  if (ctx.source.kind !== "snapshot/text") {
    return;
  }

  const textLayer = ctx.source.textLayer;
  if (!textLayer) {
    return;
  }

  updatePointerTextActivity(ctx, state, {
    trailMs: params.trailMs,
  });
  const intensity = clampNumber(params.intensity, 0, 1, 0.9) * state.activity;
  const radius = clampNumber(params.radius, 8, 260, 76);
  const localPointerX = ctx.pointer.x - ctx.layout.left;
  const localPointerY = ctx.pointer.y - ctx.layout.top;

  textLayer.setGlyphs((glyphs) =>
    glyphs.map((glyph) => {
      const proximity = readGlyphPointerProximity(
        glyph,
        localPointerX,
        localPointerY,
        radius,
      );
      const pressure = intensity * proximity;

      if (!glyph.char.trim() || pressure <= 0) {
        return {
          index: glyph.index,
          char: glyph.char,
          opacity: 1,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
        };
      }

      const direction = glyph.x + glyph.width / 2 < localPointerX ? -1 : 1;

      return {
        index: glyph.index,
        char: glyph.char,
        color: "#ffcf5a",
        opacity: 1,
        rotation: direction * pressure * 0.11,
        scaleX: 1 - pressure * 0.22,
        scaleY: 1 + pressure * 0.65,
      };
    }),
  );
}

function createPointerTextState(): DemoPointerTextState {
  return {
    activity: 0,
    lastPointerX: undefined,
    lastPointerY: undefined,
    lastTime: undefined,
  };
}

function updatePointerTextActivity(
  ctx: Parameters<typeof demoScrambledTextEffect.update>[0],
  state: DemoPointerTextState,
  params: { trailMs?: number },
) {
  const pointerInTarget =
    ctx.pointer.isInside &&
    ctx.pointer.x >= ctx.layout.left &&
    ctx.pointer.x <= ctx.layout.right &&
    ctx.pointer.y >= ctx.layout.top &&
    ctx.pointer.y <= ctx.layout.bottom;
  const moved =
    state.lastPointerX !== undefined &&
    state.lastPointerY !== undefined &&
    (Math.abs(ctx.pointer.x - state.lastPointerX) > 0.5 ||
      Math.abs(ctx.pointer.y - state.lastPointerY) > 0.5);
  const elapsed =
    state.lastTime === undefined ? 0 : Math.max(0, ctx.time - state.lastTime);
  const trailMs = clampNumber(params.trailMs, 40, 1000, 260);

  if (pointerInTarget && moved) {
    state.activity = 1;
  } else {
    state.activity = Math.max(0, state.activity - elapsed / trailMs);
  }

  state.lastPointerX = ctx.pointer.x;
  state.lastPointerY = ctx.pointer.y;
  state.lastTime = ctx.time;
}

function readGlyphPointerProximity(
  glyph: { x: number; y: number; width: number; height: number },
  localPointerX: number,
  localPointerY: number,
  radius: number,
): number {
  const glyphCenterX = glyph.x + glyph.width / 2;
  const glyphCenterY = glyph.y + glyph.height / 2;
  const distance = Math.hypot(
    glyphCenterX - localPointerX,
    glyphCenterY - localPointerY,
  );

  return Math.max(0, 1 - distance / radius);
}

export const demoCapabilityImageTextureEffect = defineWebGLEffect<{
  kind: "demo.capabilityImageTexture";
}>({
  kind: "demo.capabilityImageTexture",
  source: "image",
  setup(ctx) {
    if (ctx.source.kind !== "image") {
      return;
    }

    ctx.source.image?.setTextureTransform({
      repeatX: 0.55,
      repeatY: 0.55,
      offsetX: 0.22,
      offsetY: 0.22,
    });
  },
  update() {
    return;
  },
});

export const demoCapabilityVideoPlaybackEffect = defineWebGLEffect<{
  kind: "demo.capabilityVideoPlayback";
}>({
  kind: "demo.capabilityVideoPlayback",
  source: "video",
  setup(ctx) {
    if (ctx.source.kind !== "video") {
      return;
    }

    ctx.source.video?.setMuted(true);
    ctx.source.video?.setPlaybackRate(1.15);
    const playResult = ctx.source.video?.play();
    if (playResult && typeof playResult.catch === "function") {
      void playResult.catch(() => undefined);
    }
  },
  update() {
    return;
  },
});

type DemoGLBRotateParams = {
  kind: "demo.glbRotate";
  rotationSpeed?: number;
};

type DemoGLBVertexParticlesParams = {
  kind: "demo.glbVertexParticles";
  color?: number | string;
  density?: number;
  size?: number;
  scatterRadius?: number;
  hitRadius?: number;
  scatterStrength?: number;
  returnStrength?: number;
  damping?: number;
};

type RotatableObject3D = {
  rotation?: { x?: number; y?: number; z?: number };
};

type MutablePointCloud = {
  geometry?: {
    attributes?: {
      position?: {
        array?: Float32Array;
        needsUpdate?: boolean;
      };
    };
    dispose?: () => void;
  };
  material?: {
    depthTest?: boolean;
    depthWrite?: boolean;
    dispose?: () => void;
    opacity?: number;
    transparent?: boolean;
  };
  parent?: { remove?: (child: unknown) => void };
  renderOrder?: number;
  scale?: { setScalar?: (scale: number) => void };
};

type Object3DLike = {
  add?: (child: unknown) => void;
};

type MeshLike = {
  visible?: boolean;
};

type Bounds = {
  centerX: number;
  centerY: number;
  extentX: number;
  extentY: number;
};

type RotationProjection = {
  cosY: number;
  sinY: number;
  bounds: Bounds;
};

type HiddenMesh = {
  mesh: MeshLike;
  visible: boolean | undefined;
};

type VertexParticlesState = {
  pointCloud: MutablePointCloud;
  basePositions: Float32Array;
  velocities: Float32Array;
  bounds: Bounds;
  hiddenMeshes: HiddenMesh[];
  lastPointerX: number;
  lastPointerY: number;
  hasPointer: boolean;
};

export const demoGLBRotateEffect = defineWebGLEffect<DemoGLBRotateParams>({
  kind: "demo.glbRotate",
  source: "model/glb",
  update(ctx, _state, params) {
    if (ctx.source.kind !== "model/glb") {
      return;
    }

    const rotationSpeed = clampNumber(params.rotationSpeed, -2, 2, 0.015);

    setObjectRotation(
      ctx.source.model.object3D,
      0,
      (ctx.time / 1000) * rotationSpeed,
      0,
    );
  },
});

export const demoGLBVertexParticlesEffect = defineWebGLEffect<
  DemoGLBVertexParticlesParams,
  VertexParticlesState | undefined
>({
  kind: "demo.glbVertexParticles",
  source: "model/glb",
  setup(ctx, params) {
    if (ctx.source.kind !== "model/glb") {
      return undefined;
    }

    const pointCloud = ctx.source.model.createPointCloud({
      color: params.color ?? "rgb(255, 0, 0)",
      density: clampNumber(params.density, 0.1, 4, 2.5),
      size: clampNumber(params.size, 0.006, 0.12, 0.026),
    }) as MutablePointCloud;
    const positions = readPointCloudPositions(pointCloud);

    if (!positions) {
      return undefined;
    }

    const hiddenMeshes = hideModelMeshes(ctx.source.model);
    configurePointCloudOverlay(pointCloud);
    addChildObject3D(ctx.source.model.object3D, pointCloud);
    ctx.resources.addDisposable(() => {
      restoreModelMeshes(hiddenMeshes);
      disposePointCloud(pointCloud);
    });

    return {
      pointCloud,
      basePositions: new Float32Array(positions),
      velocities: new Float32Array(positions.length),
      bounds: measurePositionBounds(positions),
      hiddenMeshes,
      lastPointerX: 0,
      lastPointerY: 0,
      hasPointer: false,
    };
  },
  update(ctx, state, params) {
    if (!state) {
      return;
    }

    const positions = readPointCloudPositions(state.pointCloud);
    if (!positions) {
      return;
    }

    updateScatteredParticles(ctx, state, params, positions);
    state.pointCloud.geometry!.attributes!.position!.needsUpdate = true;
  },
});

function clampNumber(
  value: number | undefined,
  min: number,
  max: number,
  fallback: number,
): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, value));
}

function seededUnit(a: number, b: number): number {
  const value = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;

  return value - Math.floor(value);
}

function setObjectRotation(
  object: unknown,
  x: number,
  y: number,
  z: number,
): void {
  if (!object || typeof object !== "object") {
    return;
  }

  const rotation = (object as RotatableObject3D).rotation;

  if (!rotation) {
    return;
  }

  rotation.x = x;
  rotation.y = y;
  rotation.z = z;
}

function addChildObject3D(parent: unknown, child: unknown): void {
  if (!parent || typeof parent !== "object") {
    return;
  }

  const add = (parent as Object3DLike).add;
  if (typeof add === "function") {
    add.call(parent, child);
  }
}

function hideModelMeshes(model: {
  traverseMeshes(visitor: (mesh: unknown) => void): void;
}): HiddenMesh[] {
  const hiddenMeshes: HiddenMesh[] = [];

  model.traverseMeshes((mesh) => {
    if (!mesh || typeof mesh !== "object" || !("visible" in mesh)) {
      return;
    }

    const mutableMesh = mesh as MeshLike;
    hiddenMeshes.push({ mesh: mutableMesh, visible: mutableMesh.visible });
    mutableMesh.visible = false;
  });

  return hiddenMeshes;
}

function restoreModelMeshes(hiddenMeshes: readonly HiddenMesh[]): void {
  for (const hiddenMesh of hiddenMeshes) {
    hiddenMesh.mesh.visible = hiddenMesh.visible;
  }
}

function readPointCloudPositions(pointCloud: MutablePointCloud): Float32Array | undefined {
  return pointCloud.geometry?.attributes?.position?.array;
}

function updateScatteredParticles(
  ctx: Parameters<typeof demoGLBVertexParticlesEffect.update>[0],
  state: VertexParticlesState,
  params: DemoGLBVertexParticlesParams,
  positions: Float32Array,
): void {
  const radius = clampNumber(params.scatterRadius, 0.05, 1.5, 0.38);
  const hitRadius = clampNumber(params.hitRadius, 0.01, 0.5, 0.09);
  const scatterStrength = clampNumber(params.scatterStrength, 0, 4, 1.4);
  const returnStrength = clampNumber(params.returnStrength, 0.001, 0.5, 0.08);
  const damping = clampNumber(params.damping, 0.5, 0.995, 0.88);
  const deltaScale = clampNumber(ctx.delta / 16.67, 0.25, 2.5, 1);
  const pointer = readLayoutPointer(ctx);
  const projection = createRotationProjection(state, readObjectRotationY(ctx));
  const pointerMoveX = state.hasPointer ? pointer.x - state.lastPointerX : 0;
  const pointerMoveY = state.hasPointer ? pointer.y - state.lastPointerY : 0;
  const pointerSpeed = Math.hypot(pointerMoveX, pointerMoveY);
  const hasCollision =
    pointer.isInside &&
    pointerSpeed > 0.0005 &&
    isPointerOverParticle(state, projection, pointer.x, pointer.y, hitRadius);
  const moveDirectionX = hasCollision ? pointerMoveX / pointerSpeed : 0;
  const moveDirectionY = hasCollision ? pointerMoveY / pointerSpeed : 0;
  const dampingFactor = Math.pow(damping, deltaScale);

  for (let index = 0; index < positions.length; index += 3) {
    const baseX = state.basePositions[index] ?? 0;
    const baseY = state.basePositions[index + 1] ?? 0;
    const baseZ = state.basePositions[index + 2] ?? 0;
    let velocityX = state.velocities[index] ?? 0;
    let velocityY = state.velocities[index + 1] ?? 0;
    let velocityZ = state.velocities[index + 2] ?? 0;

    if (hasCollision) {
      const projectedX = projectRotatedX(baseX, baseZ, projection);
      const normalizedX =
        (projectedX - projection.bounds.centerX) / projection.bounds.extentX;
      const normalizedY =
        (baseY - projection.bounds.centerY) / projection.bounds.extentY;
      const deltaX = normalizedX - pointer.x;
      const deltaY = normalizedY - pointer.y;
      const distance = Math.hypot(deltaX, deltaY);

      if (distance < radius) {
        const awayX = distance > 0.0001 ? deltaX / distance : -moveDirectionY;
        const awayY = distance > 0.0001 ? deltaY / distance : moveDirectionX;
        const influence = (1 - distance / radius) ** 2;
        const impulse = influence * pointerSpeed * scatterStrength;

        const screenImpulseX =
          (moveDirectionX * 0.75 + awayX * 0.25) *
          impulse *
          projection.bounds.extentX;
        velocityY +=
          (moveDirectionY * 0.75 + awayY * 0.25) *
          impulse *
          projection.bounds.extentY;
        velocityX += screenImpulseX * projection.cosY;
        velocityZ += screenImpulseX * projection.sinY;
        velocityZ += influence * pointerSpeed * scatterStrength * 0.02;
      }
    }

    velocityX += (baseX - positions[index]) * returnStrength * deltaScale;
    velocityY += (baseY - positions[index + 1]) * returnStrength * deltaScale;
    velocityZ += (baseZ - positions[index + 2]) * returnStrength * deltaScale;

    velocityX *= dampingFactor;
    velocityY *= dampingFactor;
    velocityZ *= dampingFactor;

    positions[index] += velocityX * deltaScale;
    positions[index + 1] += velocityY * deltaScale;
    positions[index + 2] += velocityZ * deltaScale;
    state.velocities[index] = velocityX;
    state.velocities[index + 1] = velocityY;
    state.velocities[index + 2] = velocityZ;
  }

  state.lastPointerX = pointer.x;
  state.lastPointerY = pointer.y;
  state.hasPointer = pointer.isInside;
}

function readLayoutPointer(
  ctx: Parameters<typeof demoGLBVertexParticlesEffect.update>[0],
): { x: number; y: number; isInside: boolean } {
  const viewportX = ((ctx.pointer.normalizedX + 1) / 2) * ctx.layout.viewport.width;
  const viewportY = ((1 - ctx.pointer.normalizedY) / 2) * ctx.layout.viewport.height;
  const localX = ((viewportX - ctx.layout.left) / Math.max(1, ctx.layout.width)) * 2 - 1;
  const localY =
    -(((viewportY - ctx.layout.top) / Math.max(1, ctx.layout.height)) * 2 - 1);

  return {
    x: localX,
    y: localY,
    isInside:
      ctx.pointer.isInside &&
      viewportX >= ctx.layout.left &&
      viewportX <= ctx.layout.right &&
      viewportY >= ctx.layout.top &&
      viewportY <= ctx.layout.bottom,
  };
}

function isPointerOverParticle(
  state: VertexParticlesState,
  projection: RotationProjection,
  pointerX: number,
  pointerY: number,
  hitRadius: number,
): boolean {
  for (let index = 0; index < state.basePositions.length; index += 3) {
    const projectedX = projectRotatedX(
      state.basePositions[index] ?? 0,
      state.basePositions[index + 2] ?? 0,
      projection,
    );
    const normalizedX =
      (projectedX - projection.bounds.centerX) / projection.bounds.extentX;
    const normalizedY =
      ((state.basePositions[index + 1] ?? 0) - projection.bounds.centerY) /
      projection.bounds.extentY;

    if (Math.hypot(normalizedX - pointerX, normalizedY - pointerY) <= hitRadius) {
      return true;
    }
  }

  return false;
}

function createRotationProjection(
  state: VertexParticlesState,
  rotationY: number,
): RotationProjection {
  const cosY = Math.cos(rotationY);
  const sinY = Math.sin(rotationY);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (let index = 0; index < state.basePositions.length; index += 3) {
    const projectedX = projectRotatedX(
      state.basePositions[index] ?? 0,
      state.basePositions[index + 2] ?? 0,
      { cosY, sinY },
    );
    const y = state.basePositions[index + 1] ?? 0;
    minX = Math.min(minX, projectedX);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, projectedX);
    maxY = Math.max(maxY, y);
  }

  return {
    cosY,
    sinY,
    bounds: createBoundsFromExtents(minX, minY, maxX, maxY),
  };
}

function projectRotatedX(
  x: number,
  z: number,
  projection: Pick<RotationProjection, "cosY" | "sinY">,
): number {
  return x * projection.cosY + z * projection.sinY;
}

function readObjectRotationY(
  ctx: Parameters<typeof demoGLBVertexParticlesEffect.update>[0],
): number {
  if (ctx.source.kind !== "model/glb") {
    return 0;
  }

  const rotationY = (ctx.source.model.object3D as RotatableObject3D).rotation?.y;
  return Number.isFinite(rotationY) ? rotationY ?? 0 : 0;
}

function measurePositionBounds(positions: Float32Array): Bounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (let index = 0; index < positions.length; index += 3) {
    minX = Math.min(minX, positions[index] ?? 0);
    minY = Math.min(minY, positions[index + 1] ?? 0);
    maxX = Math.max(maxX, positions[index] ?? 0);
    maxY = Math.max(maxY, positions[index + 1] ?? 0);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return createBoundsFromExtents(-1, -1, 1, 1);
  }

  return createBoundsFromExtents(minX, minY, maxX, maxY);
}

function createBoundsFromExtents(
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): Bounds {
  return {
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
    extentX: Math.max((maxX - minX) / 2, 0.0001),
    extentY: Math.max((maxY - minY) / 2, 0.0001),
  };
}

function configurePointCloudOverlay(pointCloud: MutablePointCloud): void {
  if (pointCloud.material) {
    pointCloud.material.depthTest = false;
    pointCloud.material.depthWrite = false;
    pointCloud.material.transparent = true;
    pointCloud.material.opacity = 0.95;
  }

  pointCloud.renderOrder = 10;
  pointCloud.scale?.setScalar?.(1.015);
}

function disposePointCloud(pointCloud: MutablePointCloud): void {
  pointCloud.parent?.remove?.(pointCloud);
  pointCloud.geometry?.dispose?.();
  pointCloud.material?.dispose?.();
}
