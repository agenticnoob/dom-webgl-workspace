import React, { useState, useEffect, useRef, type CSSProperties } from "react";
import { OrthographicCamera, View } from "@react-three/drei";
import { ProjectRoomSurface } from "./ProjectRoomSurface";
import { useRuntimeReady } from "../../useRuntimeReady";
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

/** Immutable content/palette declarations: change the React key to replace them. */
export function ProjectRoom(props: ProjectRoomProps) {
  const runtimeReady = useRuntimeReady();
  const view = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ width: 1, height: 1 });
  useEffect(() => {
    const element = view.current;
    if (!element) return;
    const update = () => {
      const rect = element.getBoundingClientRect();
      setViewport((current) =>
        current.width === rect.width && current.height === rect.height
          ? current
          : { width: rect.width, height: rect.height },
      );
    };
    const observer = new ResizeObserver(update);
    observer.observe(element);
    update();
    return () => observer.disconnect();
  }, []);
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
    };
  });
  return (
    <section
      id={`${mount.id}.viewport`}
      className={["recipe-room", props.className].filter(Boolean).join(" ")}
      aria-label={mount.title}
      style={mount.style}
    >
      <View ref={view} className="recipe-room__surface">
        <OrthographicCamera
          makeDefault
          manual
          position={[0, 0, 1]}
          left={-1}
          right={1}
          top={1}
          bottom={-1}
          near={0.01}
          far={10}
        />
        <ProjectRoomSurface
          items={mount.items}
          palette={mount.palette}
          room={mount.room}
          viewport={viewport}
        />
      </View>
      <ProjectRoomControls
        id={mount.id}
        items={mount.items}
        title={mount.title}
        labels={mount.labels}
        room={mount.room}
        available={runtimeReady}
      />
    </section>
  );
}
