import { useFrame, useThree } from "@react-three/fiber";
import { useWebGLRuntime, WebGLSection } from "@viselora/dom-webgl/react";
import { Suspense, useEffect, type ReactNode } from "react";
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
import {
  benchProgress,
  benchSectionMargin,
  cameraZ,
  chapterRange,
  type BenchVariant,
} from "./benchLayout";

export function BenchScene({
  controller,
  variant,
}: {
  readonly controller: BenchController;
  readonly variant: BenchVariant;
}) {
  return (
    <>
      <CameraRail />
      <RoomLighting />
      <ambientLight intensity={0.5} />
      <directionalLight position={[4, 6, 8]} intensity={2.2} />
      <Chapter index={0} variant={variant}>
        <Suspense fallback={null}>
          <ModelChapter controller={controller} />
        </Suspense>
      </Chapter>
      <Chapter index={1} variant={variant}>
        <ParticleChapter />
      </Chapter>
      <Chapter index={2} variant={variant}>
        <TextChapter controller={controller} />
      </Chapter>
      <Chapter index={3} variant={variant}>
        <SequenceChapter controller={controller} />
      </Chapter>
      <Chapter index={4} variant={variant}>
        <Suspense fallback={null}>
          <CardsChapter controller={controller} />
        </Suspense>
      </Chapter>
      <Chapter index={5} variant={variant}>
        <RaymarchChapter />
      </Chapter>
      <BenchProbe controller={controller} />
    </>
  );
}

/** The only difference between the variants: whether a chapter is a section. */
function Chapter({
  index,
  variant,
  children,
}: {
  readonly index: number;
  readonly variant: BenchVariant;
  readonly children: ReactNode;
}) {
  switch (variant) {
    case "naive":
      return children;
    case "sections":
      return (
        <WebGLSection progress={chapterRange(index)} margin={benchSectionMargin}>
          {children}
        </WebGLSection>
      );
  }
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
