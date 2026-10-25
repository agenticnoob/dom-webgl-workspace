import { useFrame, useThree } from "@react-three/fiber";
import React, { useEffect, useLayoutEffect, useRef } from "react";
import { type Mesh, type ShaderMaterial, type Texture } from "three";
import { updateUniforms } from "../shared/nativeMaterials";
import { createProjectRoomTexture } from "./artwork";
import { createProjectRoomProgram } from "./program";
import {
  projectRoomConfig,
  resolveRoomTurn,
  stepRoomAngle,
  wrapRoomAngle,
  type ProjectRoomStore,
} from "./room";
import type { ProjectRoomItems, ProjectRoomPalette } from "./types";

export function ProjectRoomSurface({
  items,
  palette,
  room,
  viewport,
}: {
  readonly items: ProjectRoomItems;
  readonly palette: ProjectRoomPalette;
  readonly room: ProjectRoomStore;
  readonly viewport?: { readonly width: number; readonly height: number };
}) {
  const mesh = useRef<Mesh>(null);
  const canvasSize = useThree((state) => state.size);
  const size = viewport ?? canvasSize;
  const pointer = useRef({ x: 0, y: 0, inside: false });
  const motion = useRef({
    yaw: 0,
    parallaxX: 0,
    parallaxY: 0,
    armed: false,
    visible: false,
  });
  const material = useRef<ShaderMaterial | null>(null);
  const preferences = useRef({ desktop: false, reduced: false });
  useEffect(() => {
    const desktop = window.matchMedia(projectRoomConfig.pointerQuery);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      preferences.current = {
        desktop: desktop.matches,
        reduced: reduced.matches,
      };
    };
    update();
    desktop.addEventListener("change", update);
    reduced.addEventListener("change", update);
    return () => {
      desktop.removeEventListener("change", update);
      reduced.removeEventListener("change", update);
    };
  }, []);
  useLayoutEffect(() => {
    if (!mesh.current) return;
    try {
      const next = createProjectRoomProgram(
        createProjectRoomTexture(items),
        palette,
      );
      mesh.current.material = next;
      material.current = next;
      return () => {
        material.current = null;
        (next.uniforms.inkAtlas.value as Texture).dispose();
        next.dispose();
        room.publishFrame({ ready: false, settled: true });
      };
    } catch (error: unknown) {
      room.publishFrame({
        ready: false,
        settled: true,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, [items, palette, room]);
  useFrame((_frame, seconds) => {
    const state = motion.current;
    const enabled =
      preferences.current.desktop &&
      size.width >= projectRoomConfig.minimumWidth &&
      !!material.current;
    if (mesh.current) mesh.current.visible = enabled;
    if (!enabled || !material.current) {
      if (state.visible) room.publishFrame({ ready: false, settled: true });
      state.visible = false;
      state.armed = false;
      return;
    }
    if (!state.visible) {
      state.yaw = (room.getSnapshot().selected * Math.PI) / 2;
      state.parallaxX = 0;
      state.parallaxY = 0;
    }
    state.visible = true;
    const { x, y, inside } = pointer.current;
    const active =
      inside && !preferences.current.reduced && !room.pointerLocked();
    if (active && Math.abs(x) < projectRoomConfig.rearmThreshold)
      state.armed = true;
    const turn = active ? resolveRoomTurn(x, y, state.armed) : 0;
    if (turn) {
      room.select(room.getSnapshot().selected + turn);
      state.armed = false;
    }
    const target = (room.getSnapshot().selected * Math.PI) / 2;
    const delta = seconds * 1000;
    state.yaw = stepRoomAngle(
      state.yaw,
      target,
      delta,
      preferences.current.reduced,
    );
    const smoothing = 1 - Math.exp(-Math.min(delta, 64) / 120);
    state.parallaxX += ((active ? x : 0) - state.parallaxX) * smoothing;
    state.parallaxY += ((active ? y : 0) - state.parallaxY) * smoothing;
    if (preferences.current.reduced) {
      state.parallaxX = 0;
      state.parallaxY = 0;
    }
    updateUniforms(material.current.uniforms, {
      viewport: [size.width, Math.max(1, size.height)],
      view: [
        wrapRoomAngle(state.yaw) + state.parallaxX * 0.045,
        -state.parallaxY * 0.025,
        state.parallaxX * 0.12,
        -state.parallaxY * 0.08,
      ],
    });
    room.publishFrame({
      ready: true,
      settled: Math.abs(wrapRoomAngle(target - state.yaw)) < 0.025,
    });
  });
  return (
    <mesh
      ref={mesh}
      onPointerMove={(event) => {
        if (event.uv)
          pointer.current = {
            x: event.uv.x * 2 - 1,
            y: 1 - event.uv.y * 2,
            inside: true,
          };
      }}
      onPointerOut={() => {
        pointer.current.inside = false;
      }}
    >
      <planeGeometry args={[2, 2]} />
      <meshBasicMaterial transparent opacity={0} />
    </mesh>
  );
}
