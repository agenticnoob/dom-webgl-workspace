import { PerspectiveCamera, View } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import {
  createDOMTextTexture,
  type WebGLProgressSignalSource,
} from "@viselora/dom-webgl";
import {
  type Mesh,
  type MeshBasicMaterial,
  type MeshStandardMaterial,
} from "three";
import {
  timelineConfig,
  timelineGeometry,
  timelineWindowStart,
  timelinePanelMotion,
  timelineLanePosition,
  type TimelinePanel,
  type TimelineViewport,
} from "./track";
import { compileTimelineFresnel, type TimelineStageState } from "./effects";
import {
  createTimelineFlightState,
  stepTimelineFlight,
  timelineFlightFrame,
} from "./flight";

type SceneProps = {
  readonly id: string;
  readonly progressKey: string;
  readonly stage: TimelineStageState;
  readonly panels: readonly TimelinePanel[];
  readonly viewport: TimelineViewport;
  readonly progress: WebGLProgressSignalSource;
  readonly onReady: (ready: boolean) => void;
};

export function TimelineScene(props: SceneProps) {
  const { id, progressKey, panels, viewport, progress } = props;
  const sources = useRef(new Map<string, HTMLElement>());
  const subscribe = useCallback(
    (listener: () => void) =>
      progress.subscribe?.(listener) ?? (() => undefined),
    [progress],
  );
  const readWindow = useCallback(
    () =>
      progress.get(`${progressKey}.visible`) > 0
        ? timelineWindowStart(progress.get(progressKey), panels)
        : -1,
    [progress, progressKey, panels],
  );
  const windowStart = useSyncExternalStore(subscribe, readWindow, () => -1);
  const visible =
    windowStart < 0
      ? []
      : panels.slice(windowStart, windowStart + timelineConfig.slots);
  const sizes = timelineGeometry(viewport);
  const style = {
    "--timeline-width": `${sizes.width}px`,
    "--timeline-font": `${sizes.fontSize}px`,
    "--timeline-label": `${sizes.labelSize}px`,
    visibility: "hidden",
  } as CSSProperties;
  const source = (key: string) => (element: HTMLParagraphElement | null) => {
    if (element) sources.current.set(key, element);
    else sources.current.delete(key);
  };
  return (
    <>
      <View className="perspective-timeline__viewport" id={`${id}.view`}>
        <PerspectiveCamera
          makeDefault
          fov={timelineConfig.fov}
          near={0.01}
          far={50}
          position={[0, 0, timelineConfig.cameraZ]}
        />
        <mesh position={[0, 0, -35]}>
          <planeGeometry args={[(60 * viewport.width) / viewport.height, 60]} />
          <meshBasicMaterial color="#c8c8c8" toneMapped={false} />
        </mesh>
        <TimelineFlight stage={props.stage} onReady={props.onReady} />
        <ambientLight intensity={0.8} />
        <directionalLight intensity={4} position={[2, 3, 4]} />
        <directionalLight intensity={1.5} position={[-3, -1, 1]} />
        <ambientLight intensity={0.45} />
        <directionalLight intensity={1} position={[1, 1.5, 2]} />
        {visible.map((panel) => (
          <TimelinePair
            key={panel.id}
            {...props}
            panel={panel}
            sources={sources.current}
          />
        ))}
      </View>
      <div
        className="perspective-timeline__sources"
        aria-hidden="true"
        style={style}
        data-timeline-window={windowStart}
      >
        {visible.map((panel) => (
          <div key={panel.id} data-timeline-panel={panel.id}>
            <div className="perspective-timeline__lane">
              <div className="perspective-timeline__source-column">
                <p
                  ref={source(`${panel.id}.label`)}
                  className="perspective-timeline__label"
                >
                  {panel.label}
                </p>
                <p
                  ref={source(`${panel.id}.meta`)}
                  className="perspective-timeline__meta"
                >
                  {panel.meta}
                </p>
              </div>
            </div>
            <div className="perspective-timeline__lane">
              <div className="perspective-timeline__source-column">
                <p
                  ref={source(`${panel.id}.body`)}
                  className="perspective-timeline__body"
                >
                  {panel.body}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function TimelinePair(
  props: SceneProps & {
    readonly panel: TimelinePanel;
    readonly sources: Map<string, HTMLElement>;
  },
) {
  return (
    <>
      <TimelineText {...props} slot="label" side="left" />
      <TimelineText {...props} slot="meta" side="left" />
      <TimelineText {...props} slot="body" side="right" />
    </>
  );
}

function TimelineText({
  progress,
  progressKey,
  panel,
  panels,
  stage,
  viewport,
  sources,
  slot,
  side,
}: SceneProps & {
  readonly panel: TimelinePanel;
  readonly sources: Map<string, HTMLElement>;
  readonly slot: "label" | "meta" | "body";
  readonly side: "left" | "right";
}) {
  const mesh = useRef<Mesh>(null);
  const material = useRef<MeshBasicMaterial>(null);
  const image = useRef<ReturnType<typeof createDOMTextTexture> | null>(null);
  useEffect(
    () => () => {
      image.current?.dispose();
      image.current = null;
    },
    [],
  );
  useFrame(() => {
    if (!mesh.current || !material.current) return;
    const element = sources.get(`${panel.id}.${slot}`);
    if (!image.current && element) {
      image.current = createDOMTextTexture(element, {
        devicePixelRatio: Math.min(2, window.devicePixelRatio),
      });
      material.current.map = image.current.texture;
      material.current.needsUpdate = true;
    }
    const text = image.current;
    const motion = timelinePanelMotion(
      progress.get(progressKey),
      panel,
      panels,
    );
    mesh.current.visible = !!text && stage.visible && motion.opacity > 0.001;
    if (!text) return;
    const unit =
      (timelineConfig.depth *
        2 *
        Math.tan((timelineConfig.fov * Math.PI) / 360)) /
      viewport.height;
    const yOffset =
      slot === "meta"
        ? (sources.get(`${panel.id}.label`)?.getBoundingClientRect().height ??
            0) + 20
        : 0;
    const position = timelineLanePosition(motion, side, stage.viewport);
    mesh.current.position.set(
      position[0],
      position[1] - (text.height / 2 + yOffset) * unit,
      position[2],
    );
    mesh.current.scale.set(text.width * unit, text.height * unit, 1);
    material.current.opacity = motion.opacity;
  });
  return (
    <mesh ref={mesh} visible={false}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        ref={material}
        transparent
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

function TimelineFlight({
  stage,
  onReady,
}: {
  readonly stage: TimelineStageState;
  readonly onReady: (ready: boolean) => void;
}) {
  const mesh = useRef<Mesh>(null);
  const material = useRef<MeshStandardMaterial>(null);
  const state = useRef({ flight: createTimelineFlightState(), scroll: 0 });
  const thrust = useRef({ value: 0 });
  useLayoutEffect(() => {
    if (!material.current) return;
    material.current.onBeforeCompile = (shader) => {
      shader.uniforms.timelineThrust = thrust.current;
      compileTimelineFresnel(shader);
    };
    material.current.customProgramCacheKey = () => "recipe.timeline.fresnel";
    material.current.needsUpdate = true;
    state.current.scroll = window.scrollY;
    onReady(true);
    return () => onReady(false);
  }, [onReady]);
  useFrame((frame, seconds) => {
    if (!mesh.current) return;
    const scroll = window.scrollY;
    stepTimelineFlight(state.current.flight, {
      delta: seconds * 1000,
      scrollDelta: scroll - state.current.scroll,
      height: stage.viewport.height,
      active: stage.visible,
    });
    state.current.scroll = scroll;
    mesh.current.visible = stage.visible;
    if (!stage.visible) return;
    const next = timelineFlightFrame(
      state.current.flight,
      frame.clock.elapsedTime * 1000,
    );
    mesh.current.position.set(...next.position);
    mesh.current.rotation.set(
      next.rotation[0] + 0.2,
      next.rotation[1] + 0.55,
      next.rotation[2] + Math.PI,
    );
    mesh.current.scale.setScalar(next.scale);
    thrust.current.value = next.glow;
  });
  return (
    <mesh ref={mesh}>
      <tetrahedronGeometry args={[0.52]} />
      <meshStandardMaterial
        ref={material}
        color="#424a56"
        roughness={0.3}
        metalness={0.55}
      />
    </mesh>
  );
}
