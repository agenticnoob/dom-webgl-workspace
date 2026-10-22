import { useFrame, useThree } from "@react-three/fiber";
import { useWebGLRuntime } from "@viselora/dom-webgl/react";
import { Suspense, useEffect } from "react";
import { PMREMGenerator } from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

import type { BenchController } from "./benchController";
import {
  CardsChapter,
  ModelChapter,
  ParticleChapter,
  RaymarchChapter,
  SequenceChapter,
  TextChapter,
} from "./benchChapters";
import { benchProgress, cameraZ } from "./benchLayout";

export function BenchScene({ controller }: { readonly controller: BenchController }) {
  return (
    <>
      <CameraRail />
      <RoomLighting />
      <ambientLight intensity={0.5} />
      <directionalLight position={[4, 6, 8]} intensity={2.2} />
      <Suspense fallback={null}>
        <ModelChapter controller={controller} />
      </Suspense>
      <ParticleChapter />
      <TextChapter controller={controller} />
      <SequenceChapter controller={controller} />
      <Suspense fallback={null}>
        <CardsChapter controller={controller} />
      </Suspense>
      <RaymarchChapter />
      <BenchProbe controller={controller} />
    </>
  );
}

/** One continuous shot: scroll progress moves the camera down the rail. */
function CameraRail() {
  const runtime = useWebGLRuntime();
  // Runs before the chapters so camera-attached layers read this frame's pose.
  useFrame(({ camera }) => {
    const progress = benchProgress(runtime.scroll);
    camera.position.set(
      Math.sin(progress * Math.PI * 2) * 1.5,
      Math.cos(progress * Math.PI * 3) * 0.6,
      cameraZ(progress),
    );
  }, -1);
  return null;
}

function RoomLighting() {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  useEffect(() => {
    const generator = new PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const environment = generator.fromScene(room, 0.04).texture;
    room.dispose();
    generator.dispose();
    scene.environment = environment;
    return () => {
      if (scene.environment === environment) scene.environment = null;
      environment.dispose();
    };
  }, [gl, scene]);
  return null;
}

function BenchProbe({ controller }: { readonly controller: BenchController }) {
  const runtime = useWebGLRuntime();
  const gl = useThree((state) => state.gl);

  useEffect(() => {
    const context = gl.getContext();
    const debug = context.getExtension("WEBGL_debug_renderer_info");
    controller.setRenderer(
      String(
        context.getParameter(
          debug ? debug.UNMASKED_RENDERER_WEBGL : context.RENDERER,
        ),
      ),
    );
  }, [controller, gl]);

  useEffect(() => {
    if (!PerformanceObserver.supportedEntryTypes?.includes("longtask")) return;
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries())
        controller.longTask(entry.duration, runtime.scroll);
    });
    observer.observe({ type: "longtask" });
    return () => observer.disconnect();
  }, [controller, runtime]);

  // `gl.info` still holds the previous render's counters at this point.
  useFrame((state, delta) => {
    const info = state.gl.info;
    controller.frame(
      {
        deltaMs: delta * 1000,
        calls: info.render.calls,
        triangles: info.render.triangles,
        programs: info.programs?.length ?? 0,
        textures: info.memory.textures,
        geometries: info.memory.geometries,
        dpr: state.gl.getPixelRatio(),
      },
      runtime.scroll,
    );
  }, -2);
  return null;
}
