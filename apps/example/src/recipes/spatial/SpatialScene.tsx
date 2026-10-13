import { PerspectiveCamera, View } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import React, { Suspense, useEffect, useLayoutEffect, useRef } from "react";
import { ErrorBoundary } from "react-error-boundary";
import {
  MeshStandardMaterial,
  ShaderMaterial,
  type Mesh,
  type PointLight,
  type IUniform,
} from "three";
import {
  canvasTexture,
  shaderUniforms,
  updateUniforms,
  surfaceVertexShader,
} from "../../nativeMaterials";
import { useClonedModel } from "../../useClonedModel";
import { createPortalAtlas } from "./atlas";
import {
  spatialBaseRotation,
  spatialCameraPosition,
  spatialCameraTarget,
} from "./config";
import type { SpatialEffectParams } from "./effects";
import { radialRadius, resolveHoldShake, stepHold } from "./frame";
import { resolvePortalGeometryFrame } from "./geometry";
import { clampProgress } from "./math";
import { resolveReliefFrame } from "./relief";
import {
  compileSpatialShader,
  spatialShaderKey,
  spatialUniforms,
} from "./shader";
import type { SpatialStage } from "./stage";
import type { ReliefModel } from "./types";

export function SpatialScene({
  id,
  params,
}: {
  readonly id: string;
  readonly params: SpatialEffectParams;
}) {
  return (
    <View id={`${id}.viewport`} className="spatial-pass">
      <PerspectiveCamera
        makeDefault
        fov={38}
        near={0.01}
        far={50}
        position={spatialCameraPosition}
        onUpdate={(camera) => camera.lookAt(...spatialCameraTarget)}
      />
      <SpatialObjects params={params} />
      {params.relief && (
        <ErrorBoundary fallback={null}>
          <Suspense fallback={null}>
            <Relief model={params.relief} stage={params.stage} />
          </Suspense>
        </ErrorBoundary>
      )}
      <ambientLight intensity={0.8} />
      <directionalLight
        intensity={5.4}
        position={[1.6, 2.2, 2.6]}
        onUpdate={(light) => {
          light.target.position.set(...spatialCameraTarget);
          light.target.updateMatrixWorld();
        }}
      />
      <directionalLight
        intensity={1.35}
        position={[-2.2, -1.2, 0.8]}
        onUpdate={(light) => {
          light.target.position.set(...spatialCameraTarget);
          light.target.updateMatrixWorld();
        }}
      />
      <ambientLight intensity={0.45} />
      <directionalLight intensity={1} position={[1, 1.5, 2]} />
    </View>
  );
}

function SpatialObjects({ params }: { readonly params: SpatialEffectParams }) {
  const mesh = useRef<Mesh>(null);
  const background = useRef<Mesh>(null);
  const light = useRef<PointLight>(null);
  const uniforms = useRef<Record<string, IUniform>>({});
  const backgroundUniforms = useRef<Record<string, IUniform>>({});
  const pointer = useRef({
    x: 0,
    y: 0,
    inside: false,
    down: false,
    pressed: false,
  });
  const motion = useRef({
    tiltX: 0,
    tiltY: 0,
    lightX: 0,
    lightY: 0.32,
    intensity: 0,
  });
  useEffect(() => {
    const up = () => {
      pointer.current.down = false;
      pointer.current.pressed = false;
    };
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, []);
  useLayoutEffect(() => {
    if (!mesh.current || !background.current) return;
    const atlas = canvasTexture(
      createPortalAtlas(
        params.stage.viewport,
        params.chapters,
        params.relief?.face ?? (params.relief ? 0 : undefined),
      ),
    );
    const values = shaderUniforms({
      ...spatialUniforms(
        params.stage,
        params.palette,
        params.motion.rimStrength ?? 0.22,
      ),
      spatialChapterAtlas: atlas,
      domWebGLPixelRatio: 1,
    });
    const material = new MeshStandardMaterial({
      color: "#ffffff",
      roughness: 0.28,
      metalness: 0.62,
    });
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, values);
      compileSpatialShader(shader);
    };
    material.customProgramCacheKey = () => spatialShaderKey;
    mesh.current.material = material;
    uniforms.current = values;
    const back = new ShaderMaterial({
      vertexShader: surfaceVertexShader,
      uniforms: shaderUniforms({
        committed: params.palette.background,
        target: params.palette.foreground,
        origin: [0.5, 0.5],
        radius: 0,
        viewport: [0, 0, 1, 1],
        domWebGLPixelRatio: 1,
      }),
      fragmentShader: `uniform vec3 committed; uniform vec3 target; uniform vec2 origin; uniform float radius; uniform vec4 viewport; uniform float domWebGLPixelRatio;
        void main() {
          vec2 pixel = gl_FragCoord.xy / domWebGLPixelRatio - viewport.xy;
          float cover = 1.0 - smoothstep(radius - 1.5, radius + 1.5, length(pixel - origin * viewport.zw));
          gl_FragColor = vec4(mix(committed, target, cover), 1.0);
          #include <colorspace_fragment>
        }`,
      toneMapped: false,
    });
    background.current.material = back;
    backgroundUniforms.current = back.uniforms;
    params.stage.ready = true;
    params.stage.publishReady(true);
    return () => {
      atlas.dispose();
      material.dispose();
      back.dispose();
      params.stage.ready = false;
      params.stage.publishReady(false);
    };
  }, [params, params.stage.viewport.width, params.stage.viewport.height]);
  useFrame((state, seconds) => {
    if (!mesh.current || !background.current || !light.current) return;
    const { stage, motion: config } = params;
    const { viewport, frame } = stage;
    const input = pointer.current;
    const localX = input.x - stage.pointerLeft;
    const localY = input.y - stage.pointerTop;
    const inside =
      input.inside &&
      localX >= 0 &&
      localX <= viewport.width &&
      localY >= 0 &&
      localY <= viewport.height &&
      stage.visible;
    const px = inside ? (localX / viewport.width) * 2 - 1 : 0;
    const py = inside ? 1 - (localY / viewport.height) * 2 : 0;
    const previousScheme = stage.hold.scheme;
    const delta = seconds * 1000;
    const time = state.clock.elapsedTime * 1000;
    if (params.holdMs && !params.chapters) {
      if (stage.keyboardToggle) {
        stage.hold = {
          ...stage.hold,
          scheme: stage.hold.scheme === 0 ? 1 : 0,
          coverage: 0,
          phase: "idle",
        };
        stage.keyboardToggle = false;
      } else
        stage.hold = stepHold(stage.hold, {
          hit: inside && input.pressed,
          down: input.down && input.pressed && stage.visible,
          origin: [
            clampProgress(localX / viewport.width),
            clampProgress(localY / viewport.height),
          ],
          delta,
          holdMs: params.holdMs,
        });
    }
    if (stage.hold.scheme !== previousScheme)
      stage.publishScheme(stage.hold.scheme);
    const weight = stage.reducedMotion
      ? 0
      : (1 - frame.screenLock) * (1 - stage.hold.coverage);
    const damping =
      1 -
      Math.exp(-Math.min(64, Math.max(0, delta)) / (config.dampingMs ?? 130));
    const current = motion.current;
    current.tiltX +=
      (-py * (config.parallax ?? 0.18) - current.tiltX) * damping;
    current.tiltY += (px * (config.parallax ?? 0.18) - current.tiltY) * damping;
    const base = resolvePortalGeometryFrame(
      viewport,
      frame,
      spatialBaseRotation,
      stage.reducedMotion,
    );
    const shake = resolveHoldShake(
      time,
      stage.hold,
      stage.reducedMotion,
      config.holdShake,
    );
    stage.transform = {
      position: [
        base.position[0] + shake.position[0],
        base.position[1] +
          Math.sin((time * Math.PI) / 4000) *
            (config.floating ?? 0.018) *
            weight +
          shake.position[1],
        base.position[2] + shake.position[2],
      ],
      rotation: [
        base.rotation[0] + current.tiltX * weight + shake.rotation[0],
        base.rotation[1] + current.tiltY * weight + shake.rotation[1],
        base.rotation[2] + shake.rotation[2],
      ],
      scale:
        base.scale *
        (1 +
          Math.sin((time * Math.PI) / 3000) *
            (config.breathing ?? 0.012) *
            weight),
    };
    mesh.current.position.set(...stage.transform.position);
    mesh.current.rotation.set(...stage.transform.rotation);
    mesh.current.scale.setScalar(stage.transform.scale);
    mesh.current.visible = stage.visible && !frame.domContentActive;
    updateUniforms(uniforms.current, {
      ...spatialUniforms(stage, params.palette, config.rimStrength ?? 0.22),
      domWebGLPixelRatio: state.gl.getPixelRatio(),
    });
    const intensity =
      inside && !stage.reducedMotion
        ? (config.pointerLight ?? 4) * (frame.domContentActive ? 0.08 : 1)
        : 0;
    current.lightX += (px * 1.05 - current.lightX) * damping;
    current.lightY += (0.32 + py * 0.72 - current.lightY) * damping;
    current.intensity += (intensity - current.intensity) * damping;
    light.current.position.set(current.lightX, current.lightY, 0.8);
    light.current.intensity = current.intensity;
    const foreground = stage.hold.scheme
      ? params.palette.background
      : params.palette.foreground;
    const back = stage.hold.scheme
      ? params.palette.foreground
      : params.palette.background;
    background.current.visible = stage.visible;
    background.current.scale.set(
      (viewport.width / viewport.height) * 12,
      12,
      1,
    );
    updateUniforms(backgroundUniforms.current, {
      committed: params.chapters && frame.domContentActive ? foreground : back,
      target: foreground,
      origin: [stage.hold.origin[0], 1 - stage.hold.origin[1]],
      radius: stage.reducedMotion
        ? 0
        : radialRadius(
            stage.hold.coverage,
            stage.hold.origin,
            viewport.width,
            viewport.height,
          ),
      viewport: [
        viewport.left,
        viewport.windowHeight - viewport.top - viewport.height,
        viewport.width,
        viewport.height,
      ],
      domWebGLPixelRatio: state.gl.getPixelRatio(),
    });
  });
  const move = (event: ThreeEvent<PointerEvent>) => {
    pointer.current.x = event.clientX;
    pointer.current.y = event.clientY;
    pointer.current.inside = true;
  };
  return (
    <group
      onPointerMove={move}
      onPointerOut={() => {
        pointer.current.inside = false;
      }}
    >
      <mesh
        ref={background}
        position={[0, 0.8, -4]}
        rotation={[Math.atan2(0.32, 3.2), 0, 0]}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial />
      </mesh>
      <mesh
        ref={mesh}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          move(event);
          event.stopPropagation();
          if (
            event.target &&
            "setPointerCapture" in event.target &&
            typeof event.target.setPointerCapture === "function"
          )
            event.target.setPointerCapture(event.pointerId);
          pointer.current.pressed = true;
          pointer.current.down = true;
        }}
        onPointerUp={(event) => {
          pointer.current.down = false;
          pointer.current.pressed = false;
          if (
            event.target &&
            "releasePointerCapture" in event.target &&
            typeof event.target.releasePointerCapture === "function"
          )
            event.target.releasePointerCapture(event.pointerId);
        }}
      >
        <tetrahedronGeometry args={[0.52]} />
        <meshStandardMaterial />
      </mesh>
      <pointLight
        ref={light}
        color="#ffffff"
        intensity={0}
        distance={1.8}
        decay={3}
      />
    </group>
  );
}

function Relief({
  model,
  stage,
}: {
  readonly model: ReliefModel;
  readonly stage: SpatialStage;
}) {
  const { scene } = useClonedModel(model.src, model.dracoPath);
  useFrame(() => {
    const frame = resolveReliefFrame(
      stage.transform,
      stage.frame,
      stage.viewport,
      model,
    );
    scene.visible = frame.visible && stage.visible;
    scene.position.set(...frame.position);
    scene.rotation.set(...frame.rotation);
    scene.scale.set(...frame.scale);
  });
  return <primitive object={scene} dispose={null} />;
}
