import React from "react";
import { useMemo } from "react";
import {
  WebGLCamera,
  WebGLLight,
  WebGLMesh,
  WebGLModel,
  WebGLPassViewport,
  WebGLScene,
  type WebGLMeshProps,
  type WebGLModelProps,
  type WebGLSceneRenderOptions,
} from "@viselora/dom-webgl/react";
import { spatialCameraPosition, spatialCameraTarget } from "./config";
import type { SpatialEffectParams } from "./effects";

const tetrahedron = { kind: "tetrahedron", radius: 0.52 } as const;
const material = {
  kind: "standard",
  color: "#ffffff",
  roughness: 0.28,
  metalness: 0.62,
} as const;
const backgroundGeometry = { kind: "plane", size: [1, 1] } as const;
const backgroundMaterial = { kind: "basic", color: "#ffffff" } as const;
const backgroundPosition = [0, 0.8, -4] as const;
const backgroundRotation = [Math.atan2(0.32, 3.2), 0, 0] as const;
const keyPosition = [1.6, 2.2, 2.6] as const;
const rimPosition = [-2.2, -1.2, 0.8] as const;
const interaction = {
  pickable: { hitTest: "mesh", pointer: { press: true } },
} as const;

export function SpatialScene({
  id,
  params,
}: {
  readonly id: string;
  readonly params: SpatialEffectParams;
}) {
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
    () => [params] satisfies NonNullable<WebGLMeshProps["effects"]>,
    [params],
  );
  const backgroundEffects = useMemo(
    () =>
      [
        {
          kind: "recipe.spatial.background",
          stage: params.stage,
          palette: params.palette,
          portal: Boolean(params.chapters),
        },
      ] satisfies NonNullable<WebGLMeshProps["effects"]>,
    [params],
  );
  const modelEffects = useMemo(
    () =>
      params.relief
        ? ([
            {
              kind: "recipe.spatial.relief",
              stage: params.stage,
              model: params.relief,
            },
          ] satisfies NonNullable<WebGLModelProps["effects"]>)
        : undefined,
    [params],
  );
  return (
    <WebGLPassViewport id={`${id}.viewport`} as="div" className="spatial-pass">
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
          fov={38}
          near={0.01}
          far={50}
          position={spatialCameraPosition}
          target={spatialCameraTarget}
        />
        <WebGLMesh
          id={`${id}.background`}
          geometry={backgroundGeometry}
          material={backgroundMaterial}
          position={backgroundPosition}
          rotation={backgroundRotation}
          effects={backgroundEffects}
        />
        <WebGLMesh
          id={`${id}.mesh`}
          geometry={tetrahedron}
          material={material}
          effects={meshEffects}
          interaction={interaction}
        />
        {params.relief && (
          <WebGLModel
            id={`${id}.relief`}
            src={params.relief.src}
            loader={params.relief.loader}
            effects={modelEffects}
          />
        )}
        <WebGLLight id={`${id}.ambient`} kind="ambient" intensity={0.8} />
        <WebGLLight
          id={`${id}.key`}
          kind="directional"
          color="#ffffff"
          intensity={5.4}
          position={keyPosition}
          target={spatialCameraTarget}
        />
        <WebGLLight
          id={`${id}.rim`}
          kind="directional"
          color="#ffffff"
          intensity={1.35}
          position={rimPosition}
          target={spatialCameraTarget}
        />
      </WebGLScene>
    </WebGLPassViewport>
  );
}
