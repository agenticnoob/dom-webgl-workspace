import {
  defineWebGLSceneObjectEffect,
  type WebGLEffectMaterialShaderDefinition,
} from "@viselora/dom-webgl";
import { createPortalAtlas } from "./atlas";
import { spatialBaseRotation } from "./config";
import { radialRadius, resolveHoldShake, stepHold } from "./frame";
import { resolvePortalGeometryFrame } from "./geometry";
import { clampProgress } from "./math";
import { resolveReliefFrame } from "./relief";
import {
  createSpatialShader,
  spatialShaderKey,
  spatialUniforms,
} from "./shader";
import type { SpatialStage } from "./stage";
import type {
  FourFaces,
  PortalChapter,
  ReliefModel,
  SpatialMotion,
  SpatialPalette,
} from "./types";

export type SpatialEffectParams = {
  readonly kind: "recipe.spatial.mesh";
  readonly stage: SpatialStage;
  readonly palette: SpatialPalette;
  readonly motion: SpatialMotion;
  readonly chapters?: FourFaces<PortalChapter>;
  readonly relief?: ReliefModel;
  readonly holdMs?: number;
};

type MeshState = {
  disposed: boolean;
  atlasSize: string;
  tiltX: number;
  tiltY: number;
  lightX: number;
  lightY: number;
  intensity: number;
};

export const spatialMeshEffect = defineWebGLSceneObjectEffect<
  SpatialEffectParams,
  MeshState
>({
  kind: "recipe.spatial.mesh",
  source: "mesh",
  schedule: "frame",
  setup(ctx, params) {
    const shader = ctx.object.material?.shader;
    if (!shader)
      throw new Error(
        "Spatial recipes require a managed lit-material shader facade.",
      );
    const atlas = createPortalAtlas(
      params.stage.viewport,
      params.chapters,
      params.relief?.face ?? (params.relief ? 0 : undefined),
    );
    shader.onBeforeCompile(
      createSpatialShader(
        atlas,
        spatialUniforms(
          params.stage,
          params.palette,
          params.motion.rimStrength ?? 0.22,
        ),
      ),
    );
    return {
      disposed: false,
      atlasSize: "",
      tiltX: 0,
      tiltY: 0,
      lightX: 0,
      lightY: 0.32,
      intensity: 0,
    };
  },
  update(ctx, state, params) {
    if (state.disposed) return;
    const { stage, motion } = params;
    const { viewport, frame } = stage;
    const width = viewport.width;
    const height = viewport.height;
    const localX = ctx.pointer.x - stage.pointerLeft;
    const localY = ctx.pointer.y - stage.pointerTop;
    const inside =
      ctx.pointer.isInside &&
      localX >= 0 &&
      localX <= width &&
      localY >= 0 &&
      localY <= height &&
      stage.visible;
    const px = inside ? (localX / width) * 2 - 1 : 0;
    const py = inside ? 1 - (localY / height) * 2 : 0;
    const previousScheme = stage.hold.scheme;
    const primaryDown =
      ctx.pointer.isDown && ctx.pointer.buttons.includes("primary");
    if (params.holdMs && !params.chapters) {
      if (stage.keyboardToggle) {
        stage.hold = {
          ...stage.hold,
          scheme: stage.hold.scheme === 0 ? 1 : 0,
          coverage: 0,
          phase: "idle",
        };
        stage.keyboardToggle = false;
      } else {
        stage.hold = stepHold(stage.hold, {
          hit:
            inside &&
            ctx.objectPointer.isPressed &&
            ctx.objectPointer.hit !== undefined,
          down: primaryDown && ctx.objectPointer.isPressed && stage.visible,
          origin: [
            clampProgress(localX / width),
            clampProgress(localY / height),
          ],
          delta: ctx.delta,
          holdMs: params.holdMs,
        });
      }
    }
    if (stage.hold.scheme !== previousScheme)
      stage.publishScheme(stage.hold.scheme);
    const weight = stage.reducedMotion
      ? 0
      : (1 - frame.screenLock) * (1 - stage.hold.coverage);
    const damping =
      1 -
      Math.exp(
        -Math.min(64, Math.max(0, ctx.delta)) / (motion.dampingMs ?? 130),
      );
    state.tiltX += (-py * (motion.parallax ?? 0.18) - state.tiltX) * damping;
    state.tiltY += (px * (motion.parallax ?? 0.18) - state.tiltY) * damping;
    const base = resolvePortalGeometryFrame(
      viewport,
      frame,
      spatialBaseRotation,
      stage.reducedMotion,
    );
    const shake = resolveHoldShake(
      ctx.time,
      stage.hold,
      stage.reducedMotion,
      motion.holdShake,
    );
    stage.transform = {
      position: [
        base.position[0] + shake.position[0],
        base.position[1] +
          Math.sin((ctx.time * Math.PI) / 4000) *
            (motion.floating ?? 0.018) *
            weight +
          shake.position[1],
        base.position[2] + shake.position[2],
      ],
      rotation: [
        base.rotation[0] + state.tiltX * weight + shake.rotation[0],
        base.rotation[1] + state.tiltY * weight + shake.rotation[1],
        base.rotation[2] + shake.rotation[2],
      ],
      scale:
        base.scale *
        (1 +
          Math.sin((ctx.time * Math.PI) / 3000) *
            (motion.breathing ?? 0.012) *
            weight),
    };
    ctx.object.position.set(...stage.transform.position);
    ctx.object.rotation.set(...stage.transform.rotation);
    ctx.object.scale.setScalar(stage.transform.scale);
    ctx.object.visible = stage.visible && !frame.domContentActive;
    const atlasSize = `${width}:${height}`;
    if (state.atlasSize !== atlasSize) {
      ctx.object.material?.shader?.setUniforms(spatialShaderKey, {
        spatialChapterAtlas: {
          kind: "canvas-texture",
          source: createPortalAtlas(
            viewport,
            params.chapters,
            params.relief?.face ?? (params.relief ? 0 : undefined),
          ),
        },
      });
      state.atlasSize = atlasSize;
    }
    ctx.object.material?.shader?.setUniforms(
      spatialShaderKey,
      spatialUniforms(stage, params.palette, motion.rimStrength ?? 0.22),
    );
    const intensity =
      inside && !stage.reducedMotion
        ? (motion.pointerLight ?? 4) * (frame.domContentActive ? 0.08 : 1)
        : 0;
    state.lightX += (px * 1.05 - state.lightX) * damping;
    state.lightY += (0.32 + py * 0.72 - state.lightY) * damping;
    state.intensity += (intensity - state.intensity) * damping;
    ctx.object.lights?.point("pointer", {
      color: "#ffffff",
      intensity: state.intensity,
      distance: 1.8,
      decay: 3,
      position: [state.lightX, state.lightY, 0.8],
      follow: "none",
    });
    if (!stage.ready && width > 1 && height > 1) {
      stage.ready = true;
      stage.publishReady(true);
    }
  },
  dispose(ctx, state, params) {
    if (state.disposed) return;
    state.disposed = true;
    ctx.object.material?.shader?.remove(spatialShaderKey);
    ctx.object.lights?.remove("pointer");
    params.stage.ready = false;
    params.stage.publishReady(false);
  },
});

type BackgroundParams = {
  readonly kind: "recipe.spatial.background";
  readonly stage: SpatialStage;
  readonly palette: SpatialPalette;
  readonly portal: boolean;
};
const backgroundKey = "recipe.spatial.background.material";

function backgroundShader(
  palette: SpatialPalette,
): WebGLEffectMaterialShaderDefinition {
  return {
    key: backgroundKey,
    uniforms: {
      committed: palette.background,
      target: palette.foreground,
      origin: [0.5, 0.5],
      radius: 0,
      viewport: [0, 0, 1, 1],
    },
    compile(draft) {
      const chunk = "#include <color_fragment>";
      if (!draft.fragmentShader.includes(chunk))
        throw new Error(
          "Spatial background requires the managed color_fragment shader chunk.",
        );
      draft.fragmentShader = `uniform vec3 committed;\nuniform vec3 target;\nuniform vec2 origin;\nuniform float radius;\nuniform vec4 viewport;\n${draft.fragmentShader.replace(chunk, `${chunk}\nvec2 cssPoint = gl_FragCoord.xy / domWebGLPixelRatio - viewport.xy;\nfloat cover = 1.0 - smoothstep(radius - 1.5, radius + 1.5, length(cssPoint - origin * viewport.zw));\ndiffuseColor.rgb = mix(committed, target, cover);`)}`;
    },
  };
}

export const spatialBackgroundEffect = defineWebGLSceneObjectEffect<
  BackgroundParams,
  { disposed: boolean }
>({
  kind: "recipe.spatial.background",
  source: "mesh",
  schedule: "frame",
  setup(ctx, params) {
    ctx.object.material?.shader?.onBeforeCompile(
      backgroundShader(params.palette),
    );
    return { disposed: false };
  },
  update(ctx, state, { stage, palette, portal }) {
    if (state.disposed) return;
    const { viewport: v, hold } = stage;
    ctx.object.visible = stage.visible;
    ctx.object.scale.set((v.width / v.height) * 12, 12, 1);
    const foreground = hold.scheme ? palette.background : palette.foreground;
    const background = hold.scheme ? palette.foreground : palette.background;
    ctx.object.material?.shader?.setUniforms(backgroundKey, {
      committed:
        portal && stage.frame.domContentActive ? foreground : background,
      target: foreground,
      origin: [hold.origin[0], 1 - hold.origin[1]],
      radius: stage.reducedMotion
        ? 0
        : radialRadius(hold.coverage, hold.origin, v.width, v.height),
      viewport: [v.left, v.windowHeight - v.top - v.height, v.width, v.height],
    });
  },
  dispose(ctx, state) {
    if (state.disposed) return;
    state.disposed = true;
    ctx.object.material?.shader?.remove(backgroundKey);
  },
});

export const spatialReliefEffect = defineWebGLSceneObjectEffect<
  {
    readonly kind: "recipe.spatial.relief";
    readonly stage: SpatialStage;
    readonly model: ReliefModel;
  },
  { disposed: boolean }
>({
  kind: "recipe.spatial.relief",
  source: "model/glb",
  schedule: "frame",
  setup() {
    return { disposed: false };
  },
  update(ctx, state, { stage, model }) {
    if (state.disposed) return;
    const frame = resolveReliefFrame(
      stage.transform,
      stage.frame,
      stage.viewport,
      model,
    );
    ctx.object.visible = frame.visible && stage.visible;
    ctx.object.position.set(...frame.position);
    ctx.object.rotation.set(...frame.rotation);
    ctx.object.scale.set(...frame.scale);
  },
  dispose(_ctx, state) {
    if (state.disposed) return;
    state.disposed = true;
  },
});

export const spatialEffects = [
  spatialMeshEffect,
  spatialBackgroundEffect,
  spatialReliefEffect,
] as const;
