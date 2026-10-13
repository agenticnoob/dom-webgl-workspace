import { useFrame, useThree } from "@react-three/fiber";
import { useWebGLRuntime } from "@viselora/dom-webgl/react";
import React, { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { PerspectiveCamera, ShaderMaterial, Texture, type Mesh } from "three";
import { heroChapterDefinitions } from "../chapters/definitions";
import { readHeroChapterScrollState } from "../chapters/scrollState";
import type { HeroLocaleStore } from "../preferences/locale";
import { placeHeroScreenPlane } from "../shared/screenPlane";
import { updateHeroUniforms } from "../shared/shaderUniforms";
import { readHeroTransitionSignals } from "../transition/signals";
import { createAxiomsReaderArtwork } from "./effect";
import { resolveAxiomsFrame } from "./frame";
import { createAxiomsProgram, createAxiomsUniforms } from "./program";
import { createAxiomsTexture } from "./texture";

export function HeroAxiomsScene({
  locale: localeStore,
}: {
  readonly locale: HeroLocaleStore;
}) {
  const runtime = useWebGLRuntime();
  const locale = useSyncExternalStore(
    localeStore.subscribe,
    localeStore.getSnapshot,
    localeStore.getServerSnapshot,
  );
  const size = useThree((state) => state.size);
  const mesh = useRef<Mesh>(null);
  const resources = useMemo(() => {
    const artwork = createAxiomsReaderArtwork(size, locale);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const material = new ShaderMaterial(
      createAxiomsProgram(
        artwork,
        createAxiomsTexture(artwork),
        resolveAxiomsFrame(0, artwork.layout, reduced.matches),
      ),
    );
    return { artwork, reduced, material, lastFrameKey: "" };
  }, [locale, size.width, size.height]);
  useEffect(
    () => () => {
      const texture = resources.material.uniforms.inkAtlas?.value;
      if (texture instanceof Texture) texture.dispose();
      resources.material.dispose();
    },
    [resources],
  );
  useFrame(({ camera }) => {
    if (!mesh.current || !(camera instanceof PerspectiveCamera)) return;
    const chapter = readHeroChapterScrollState(runtime.progress);
    mesh.current.visible =
      chapter.chapterId === "axioms" && chapter.domContentActive;
    if (!mesh.current.visible) return;
    placeHeroScreenPlane(mesh.current, camera, size, 3);
    const progress = runtime.progress.get(
      heroChapterDefinitions.axioms.signals.body,
    );
    const inverted =
      readHeroTransitionSignals(runtime.progress).committedScheme ===
      "inverted";
    const key = `${progress}:${inverted}:${resources.reduced.matches}`;
    if (key === resources.lastFrameKey) return;
    const frame = resolveAxiomsFrame(
      progress,
      resources.artwork.layout,
      resources.reduced.matches,
    );
    updateHeroUniforms(
      resources.material.uniforms,
      createAxiomsUniforms(resources.artwork, frame, inverted),
    );
    resources.lastFrameKey = key;
  });
  return (
    <mesh
      ref={mesh}
      name="hero.axioms.reader"
      material={resources.material}
      visible={false}
    >
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
}
