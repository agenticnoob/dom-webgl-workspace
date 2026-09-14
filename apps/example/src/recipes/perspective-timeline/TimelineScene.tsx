import React, {
  useCallback,
  useMemo,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import type {
  WebGLDeclaration,
  WebGLProgressSignalSource,
} from "@viselora/dom-webgl";
import {
  WebGLCamera,
  WebGLLight,
  WebGLMesh,
  WebGLScene,
  WebGLTarget,
  type WebGLSceneRenderOptions,
} from "@viselora/dom-webgl/react";
import {
  timelineConfig,
  timelineGeometry,
  timelineWindowStart,
  type TimelinePanel,
  type TimelineViewport,
} from "./track";
import type {
  TimelineFlightParams,
  TimelineStageState,
  TimelineTravelParams,
} from "./effects";

const camera = [0, 0, timelineConfig.cameraZ] as const;
const target = [0, 0, 0] as const;
const keyPosition = [2, 3, 4] as const;
const rimPosition = [-3, -1, 1] as const;
const backgroundPosition = [0, 0, -35] as const;
const backgroundMaterial = { kind: "basic", color: "#c8c8c8" } as const;
const geometry = { kind: "tetrahedron", radius: 0.52 } as const;
const material = {
  kind: "standard",
  color: "#424a56",
  roughness: 0.3,
  metalness: 0.55,
} as const;

type SceneProps = {
  readonly id: string;
  readonly progressKey: string;
  readonly stage: TimelineStageState;
  readonly panels: readonly TimelinePanel[];
  readonly viewport: TimelineViewport;
  readonly progress: WebGLProgressSignalSource;
};

export function TimelineScene(props: SceneProps) {
  const { id, progressKey, stage, panels, viewport, progress } = props;
  const backgroundGeometry = useMemo(
    () =>
      ({
        kind: "plane",
        size: [(60 * viewport.width) / viewport.height, 60] as const,
      }) as const,
    [viewport.width, viewport.height],
  );
  const render = useMemo(
    () =>
      ({
        id: `${id}.pass`,
        camera: `${id}.camera`,
        order: 1,
        clearDepth: true,
        viewport: {
          mode: "dom-rect",
          anchorId: `${id}.viewport`,
          scissor: true,
        },
      }) satisfies WebGLSceneRenderOptions,
    [id],
  );
  const meshEffects = useMemo(
    () => [
      { kind: "recipe.timeline.flight", stage } satisfies TimelineFlightParams,
    ],
    [stage],
  );
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
  const sizes = timelineGeometry(viewport);
  const style = {
    "--timeline-width": `${sizes.width}px`,
    "--timeline-font": `${sizes.fontSize}px`,
    "--timeline-label": `${sizes.labelSize}px`,
  } as CSSProperties;
  return (
    <WebGLScene
      id={`${id}.scene`}
      projection="perspective-stage"
      render={render}
    >
      <WebGLCamera
        id={`${id}.camera`}
        default
        type="perspective"
        mode="perspective-stage"
        fov={timelineConfig.fov}
        near={0.01}
        far={50}
        position={camera}
        target={target}
      />
      <WebGLMesh
        id={`${id}.background`}
        geometry={backgroundGeometry}
        material={backgroundMaterial}
        position={backgroundPosition}
      />
      <WebGLMesh
        id={`${id}.mesh`}
        geometry={geometry}
        material={material}
        effects={meshEffects}
      />
      <WebGLLight id={`${id}.ambient`} kind="ambient" intensity={0.8} />
      <WebGLLight
        id={`${id}.key`}
        kind="directional"
        intensity={4}
        position={keyPosition}
      />
      <WebGLLight
        id={`${id}.rim`}
        kind="directional"
        intensity={1.5}
        position={rimPosition}
      />
      <div
        className="perspective-timeline__sources"
        aria-hidden="true"
        style={style}
        data-timeline-window={windowStart}
      >
        {windowStart >= 0 &&
          panels
            .slice(windowStart, windowStart + timelineConfig.slots)
            .map((panel) => (
              <TimelinePair key={panel.id} {...props} panel={panel} />
            ))}
      </div>
    </WebGLScene>
  );
}

function TimelinePair({
  id,
  progressKey,
  stage,
  panels,
  panel,
}: SceneProps & { readonly panel: TimelinePanel }) {
  const declarations = useMemo(() => {
    const text = (slot: string): WebGLDeclaration => ({
      key: `${id}.${panel.id}.${slot}`,
      source: { kind: "dom", type: "text" },
      placement: {
        mode: "screen-depth",
        depth: timelineConfig.depth,
        size: "dom",
      },
      renderRole: "model",
      lifecycle: {
        hideWhenReady: true,
        hideMode: "self",
        offscreen: { strategy: "restore-dom" },
      },
    });
    const group = (side: "left" | "right"): WebGLDeclaration => ({
      ...text(side),
      source: { kind: "dom", type: "element" },
      transformScope: "subtree",
      effects: [
        {
          kind: "recipe.timeline.travel",
          progressKey,
          stage,
          panel,
          panels,
          side,
        } satisfies TimelineTravelParams,
      ],
    });
    return {
      left: group("left"),
      right: group("right"),
      label: text("label"),
      meta: text("meta"),
      body: text("body"),
    };
  }, [id, progressKey, stage, panel, panels]);
  return (
    <div data-timeline-panel={panel.id}>
      <WebGLTarget
        as="div"
        className="perspective-timeline__lane"
        webgl={declarations.left}
      >
        <div className="perspective-timeline__source-column">
          <WebGLTarget
            as="p"
            className="perspective-timeline__label"
            webgl={declarations.label}
          >
            {panel.label}
          </WebGLTarget>
          <WebGLTarget
            as="p"
            className="perspective-timeline__meta"
            webgl={declarations.meta}
          >
            {panel.meta}
          </WebGLTarget>
        </div>
      </WebGLTarget>
      <WebGLTarget
        as="div"
        className="perspective-timeline__lane"
        webgl={declarations.right}
      >
        <div className="perspective-timeline__source-column">
          <WebGLTarget
            as="p"
            className="perspective-timeline__body"
            webgl={declarations.body}
          >
            {panel.body}
          </WebGLTarget>
        </div>
      </WebGLTarget>
    </div>
  );
}
