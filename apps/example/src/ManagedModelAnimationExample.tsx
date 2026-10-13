import { PerspectiveCamera, useAnimations, View } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useRef } from "react";
import type { Group } from "three";
import { ErrorBoundary } from "react-error-boundary";
import {
  useScrollEffectProgressStore,
  WebGLScrollTimeline,
} from "@viselora/scroll-adapters/react";
import { useClonedModel } from "./useClonedModel";

export const managedModelTimelineId = "example.managedModel.timeline";

export function readWalkCycleTime(progress: number, duration = 2.4): number {
  return Math.max(0, Math.min(1, (progress - 0.08) / 0.84)) * duration;
}

export function WalkingModel() {
  const { scene, animations } = useClonedModel("/models/human_male_base.glb");
  const model = useRef<Group>(null);
  const { actions, mixer } = useAnimations(animations, model);
  const progress = useScrollEffectProgressStore();
  useEffect(() => {
    const action = actions.WalkCycle;
    if (!action) return;
    action.play();
    action.paused = true;
    return () => {
      action.stop();
    };
  }, [actions]);
  useFrame(() => {
    const action = actions.WalkCycle;
    if (!action) return;
    action.time = readWalkCycleTime(
      progress.source.get(managedModelTimelineId),
    );
    mixer.update(0);
  });
  return (
    <primitive
      name="example.managedModel.human"
      ref={model}
      object={scene}
      position={[116, -92, -80]}
      rotation={[0, -0.36, 0]}
      scale={126}
      dispose={null}
    />
  );
}

export function ManagedModelAnimationExample() {
  return (
    <WebGLScrollTimeline
      id={managedModelTimelineId}
      className="example-row example-managed-model-dogfood"
      start="top top"
      end="+=180%"
      pin
      scrub
    >
      <div className="example-managed-model-copy">
        <p className="example-kicker">R3F model animation</p>
        <h2>滚动驱动原生模型动画</h2>
        <p>
          human_male_base.glb 通过 Drei useGLTF 加载，用 pinned scroll 区间控制
          Three.js WalkCycle 动画。
        </p>
        <ul
          className="example-managed-model-clips"
          aria-label="Animation coverage"
        >
          <li>Pinned walk scrub</li>
        </ul>
      </div>
      <View className="example-managed-model-viewport" aria-hidden="true">
        <PerspectiveCamera
          makeDefault
          position={[80, 132, 640]}
          fov={40}
          near={0.1}
          far={5000}
          onUpdate={(camera) => camera.lookAt(116, -76, -80)}
        />
        <ErrorBoundary fallback={null}>
          <Suspense fallback={null}>
            <WalkingModel />
          </Suspense>
        </ErrorBoundary>
        <ambientLight intensity={0.75} />
        <directionalLight intensity={1} position={[1, 1.5, 2]} />
        <pointLight
          color="#f6c453"
          intensity={2.15}
          position={[-120, 120, 180]}
        />
      </View>
    </WebGLScrollTimeline>
  );
}
