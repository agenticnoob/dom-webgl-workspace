import { useFrame, useThree } from "@react-three/fiber";
import React, { useLayoutEffect, useRef } from "react";
import { type Mesh, type ShaderMaterial, type Texture } from "three";
import type { WebGLProgressSignalSource } from "@viselora/dom-webgl";
import { updateUniforms } from "../../nativeMaterials";
import { createPaperReaderArtwork } from "./artwork";
import { resolvePaperReaderFrame } from "./frame";
import type { PaperReaderContent, PaperReaderPalette } from "./model";
import { createPaperReaderProgram, createPaperReaderUniforms } from "./program";
import { createPaperReaderTexture } from "./texture";

export type PaperReaderSurfaceProps = {
  readonly progress: WebGLProgressSignalSource;
  readonly viewport?: { readonly width: number; readonly height: number };
  readonly progressKey: string;
  readonly content: PaperReaderContent;
  readonly eyebrow: string;
  readonly palette: PaperReaderPalette;
  readonly onReady: (ready: boolean) => void;
  readonly onError: (error: Error) => void;
};

export function PaperReaderSurface(props: PaperReaderSurfaceProps) {
  const canvasSize = useThree((state) => state.size);
  const size = props.viewport ?? canvasSize;
  const mesh = useRef<Mesh>(null);
  const frame = useRef<{
    artwork: ReturnType<typeof createPaperReaderArtwork>;
    material: ShaderMaterial;
    progress: number;
  } | null>(null);
  useLayoutEffect(() => {
    if (!mesh.current || size.width <= 1 || size.height <= 1) return;
    let material: ShaderMaterial | undefined;
    try {
      const context = document.createElement("canvas").getContext("2d");
      if (!context)
        throw new Error("PaperReader requires a 2D text measurement context.");
      const artwork = createPaperReaderArtwork(
        context,
        size,
        props.content,
        props.eyebrow,
      );
      if (artwork.layout.paperArea.height < 120)
        throw new Error(
          "PaperReader stage is too short for its heading. Increase height or shorten the description.",
        );
      const progress = props.progress.get(props.progressKey);
      material = createPaperReaderProgram(
        artwork,
        createPaperReaderTexture(artwork),
        resolvePaperReaderFrame(progress, artwork.layout),
        props.palette,
      );
      mesh.current.material = material;
      mesh.current.visible = true;
      frame.current = { artwork, material, progress };
      props.onReady(true);
    } catch (error: unknown) {
      mesh.current.visible = false;
      props.onReady(false);
      props.onError(error instanceof Error ? error : new Error(String(error)));
    }
    return () => {
      frame.current = null;
      if (material) {
        (material.uniforms.inkAtlas.value as Texture).dispose();
        material.dispose();
      }
      props.onReady(false);
    };
  }, [
    size.width,
    size.height,
    props.content,
    props.eyebrow,
    props.palette,
    props.onReady,
    props.onError,
    props.progress,
    props.progressKey,
  ]);
  useFrame(() => {
    const state = frame.current;
    const progress = props.progress.get(props.progressKey);
    if (!state || state.progress === progress) return;
    updateUniforms(
      state.material.uniforms,
      createPaperReaderUniforms(
        state.artwork,
        resolvePaperReaderFrame(progress, state.artwork.layout),
        props.palette,
      ),
    );
    state.progress = progress;
  });
  return (
    <mesh ref={mesh} visible={false}>
      <planeGeometry args={[2, 2]} />
      <meshBasicMaterial transparent opacity={0} />
    </mesh>
  );
}
