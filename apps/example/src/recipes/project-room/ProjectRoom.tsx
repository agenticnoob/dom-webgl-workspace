import React, { useState, type CSSProperties } from "react";
import type { WebGLDeclaration } from "@viselora/dom-webgl";
import {
  WebGLPassViewport,
  WebGLCamera,
  WebGLScene,
  WebGLTarget,
  type WebGLSceneRenderOptions,
} from "@viselora/dom-webgl/react";
import type { ProjectRoomEffectParams } from "./effect";
import { ProjectRoomControls } from "./ProjectRoomControls";
import { defaultProjectRoomPalette, projectRoomColors } from "./program";
import { createProjectRoomStore, validateProjectRoomItems } from "./room";
import type { ProjectRoomLabels, ProjectRoomProps } from "./types";
import "./project-room.css";

const defaultLabels: ProjectRoomLabels = {
  hint: "Move to an edge to turn. Return to the center to read.",
  navigation: "Choose a project",
  previous: "Previous wall",
  next: "Next wall",
  visit: "Visit project",
};

export function createProjectRoomDeclaration(
  id: string,
  params: Omit<ProjectRoomEffectParams, "kind">,
): WebGLDeclaration {
  return {
    key: `${id}.surface`,
    source: { kind: "dom", type: "element" },
    lifecycle: { hideWhenReady: true, hideMode: "self" },
    pointer: { hover: true },
    effects: [
      {
        kind: "recipe.project-room",
        ...params,
      } satisfies ProjectRoomEffectParams,
    ],
  } satisfies WebGLDeclaration;
}

/** Immutable content/palette declarations: change the React key to replace them. */
export function ProjectRoom(props: ProjectRoomProps) {
  const [mount] = useState(() => {
    const id = props.id.trim();
    if (!id) throw new Error("ProjectRoom requires a non-empty unique ID.");
    validateProjectRoomItems(props.items);
    const palette = props.palette ?? defaultProjectRoomPalette;
    projectRoomColors(palette);
    const room = createProjectRoomStore(props.initialSelected);
    return {
      id,
      room,
      palette,
      items: props.items,
      title: props.title ?? "Project room",
      labels: { ...defaultLabels, ...props.labels },
      style: {
        color: palette.foreground,
        "--recipe-room-background": palette.background,
      } satisfies CSSProperties & { "--recipe-room-background": string },
      declaration: createProjectRoomDeclaration(id, {
        items: props.items,
        palette,
        room,
      }),
      render: {
        id: `${id}.pass`,
        camera: `${id}.camera`,
        order: 0,
        clearDepth: true,
        viewport: { mode: "dom-rect", scissor: true },
      } satisfies WebGLSceneRenderOptions,
    };
  });
  return (
    <WebGLPassViewport
      id={`${mount.id}.viewport`}
      as="section"
      className={["recipe-room", props.className].filter(Boolean).join(" ")}
      aria-label={mount.title}
      style={mount.style}
    >
      <WebGLScene
        id={`${mount.id}.scene`}
        projection="screen"
        render={mount.render}
      >
        <WebGLCamera
          id={`${mount.id}.camera`}
          default
          type="orthographic"
          mode="screen"
        />
        <WebGLTarget
          as="div"
          className="recipe-room__surface"
          aria-hidden="true"
          style={{ backgroundColor: mount.palette.background }}
          webgl={mount.declaration}
        />
      </WebGLScene>
      <ProjectRoomControls
        id={mount.id}
        items={mount.items}
        title={mount.title}
        labels={mount.labels}
        room={mount.room}
      />
    </WebGLPassViewport>
  );
}
