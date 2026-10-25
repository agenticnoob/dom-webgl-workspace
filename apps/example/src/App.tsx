import { View } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import React, { useEffect, useRef, useState } from "react";
import { useWebGLRuntime } from "@viselora/dom-webgl/react";
import {
  ScrollEffectSection,
  WebGLScrollRuntime,
} from "@viselora/scroll-adapters/react";
import { EffectDescription } from "./EffectDescription";
import { EffectsGroup, EffectsNav } from "./EffectsGroup";
import { exampleSmoothScrollOptions } from "./exampleSmoothScroll";
import { useExampleResources } from "./exampleResourceScheduler";
import { ExampleVisual } from "./ExampleVisual";
import {
  HoverRevealVisual,
  ImageVisual,
  ModelVisual,
  SequenceVisual,
  TextVisual,
  VideoVisual,
} from "./BasicVisuals";
import { ManagedInteractionExample } from "./ManagedInteractionExample";
import { ManagedModelAnimationExample } from "./ManagedModelAnimationExample";
import { ManagedPhysicsExample } from "./ManagedPhysicsExample";
import { ManagedTimelineExample } from "./ManagedTimelineExample";
import { ManagedMeshExample } from "./ManagedMeshExample";
import { PinnedScrollExample } from "./PinnedScrollExample";
import { SnapshotElementExamples } from "./SnapshotElementExamples";
import { RecipeExamples } from "./RecipeExamples";
import type { TextMode, TextOptions } from "./textEffects";

const canvas = {
  gl: { antialias: true, alpha: true },
  dpr: [1, 2] as [number, number],
  frameloop: "always" as const,
};
const textRows: readonly {
  id: string;
  title: string;
  className: string;
  mode: TextMode;
  text: string;
  options?: TextOptions;
}[] = [
  {
    id: "wave",
    title: "文字波浪",
    className: "example-text",
    mode: "wave",
    text: "文本内容由 DOM 编写，字形输出由原生 CanvasTexture 接管。",
    options: { amplitude: 7 },
  },
  {
    id: "reveal",
    title: "文字显现",
    className: "example-text example-text-compact",
    mode: "reveal",
    text: "滚动字形显现会把段落按阅读顺序逐步点亮，让还未进入视线的字形保持轻微收起，已经经过视口中心的文字则恢复到清晰、稳定的排版状态。",
    options: { color: "#d95f42" },
  },
  {
    id: "spotlight",
    title: "文字聚光",
    className: "example-text example-text-spotlight",
    mode: "spotlight",
    text: "指针掠过这段文字时，WebGL 字形会像被手电扫过一样逐个亮起；离指针更远的字符仍保留在暗处，于是同一段内容可以同时表达阅读、距离和聚焦状态。",
    options: { color: "#f6c453", radius: 180 },
  },
  {
    id: "pressure",
    title: "文字压感",
    className: "example-text example-text-pressure",
    mode: "pressure",
    text: "Pressure",
    options: { color: "#f4f4f5", radius: 180 },
  },
  {
    id: "scramble",
    title: "文字扰码",
    className: "example-text example-text-scramble",
    mode: "scramble",
    text: "指针靠近时，这段文字会在局部出现短暂扰码，字符先被替换成节奏明确的符号，再随着距离拉开回到原文，DOM 中的可访问文本始终保持不变。",
    options: {
      color: "#172124",
      scrambleChars: ".:",
      radius: 148,
      speed: 0.45,
    },
  },
  {
    id: "combo",
    title: "文字组合",
    className: "example-text example-text-combo",
    mode: "combo",
    text: "Focus driven text can glow, scramble, stretch, and drift in a single pass while the source paragraph stays ordinary DOM content for layout and accessibility.",
    options: {
      baseColor: "#f4f4f5",
      spotlightColor: "#f6c453",
      scrambleChars: "01",
      radius: 190,
      amplitude: 8,
      speed: 0.42,
    },
  },
];
const mediaRows = [
  {
    id: "pan",
    title: "图片平移",
    src: "/example/image.png",
    mode: "pan",
    className: "example-media",
  },
  {
    id: "zoom",
    title: "图片缩放",
    src: "/example/image.png",
    mode: "zoom",
    className: "example-media",
  },
  {
    id: "ken-burns",
    title: "图片镜头推进",
    src: "/example/bg.png",
    mode: "ken-burns",
    className: "example-media example-media-tall",
  },
] as const;

export default function App() {
  return (
    <WebGLScrollRuntime
      className="example-runtime"
      smooth={exampleSmoothScrollOptions}
      canvas={canvas}
      scene={
        <>
          <ClearCanvas />
          <View.Port />
        </>
      }
    >
      <main className="example-shell">
        <EffectsNav />
        <section className="example-intro">
          <p className="example-kicker">Viselora 效果库</p>
          <h1>原生场景与效果，Runtime 管理页面协调。</h1>
        </section>
        <div className="example-stack">
          <EffectsGroup id="surfaces" />
          <SnapshotElementExamples />
          <EffectsGroup id="stage" />
          <ManagedMeshExample />
          <ManagedModelAnimationExample />
          <ManagedTimelineExample />
          <ManagedInteractionExample />
          <ManagedPhysicsExample />
          <EffectsGroup id="text" />
          {textRows.map((row) => (
            <section className="example-row" key={row.id}>
              <EffectDescription source="DOM → CanvasTexture" title={row.title}>
                DOM 保留语义与布局，useFrame 更新 Three.js 纹理。
              </EffectDescription>
              <ExampleVisual
                id={`example.text.${row.id}`}
                visual={
                  <TextVisual
                    id={`example.text.${row.id}`}
                    mode={row.mode}
                    options={row.options}
                  />
                }
              >
                <p className={row.className}>{row.text}</p>
              </ExampleVisual>
            </section>
          ))}
          <EffectsGroup id="media" />
          {mediaRows.map((row) => (
            <section className="example-row" key={row.id}>
              <EffectDescription source="Texture" title={row.title}>
                使用 Drei 加载图片，直接更新 Three.js 纹理与网格。
              </EffectDescription>
              <ExampleVisual
                id={`example.image.${row.id}`}
                visual={
                  <ImageVisual
                    id={`example.image.${row.id}`}
                    src={row.src}
                    mode={row.mode}
                  />
                }
              >
                <img
                  className={row.className}
                  src={row.src}
                  alt={`${row.title}示例`}
                />
              </ExampleVisual>
            </section>
          ))}
          <section className="example-row">
            <EffectDescription source="ShaderMaterial" title="图片悬停叠层">
              像橡皮擦一样划开秋景，经过的位置短暂显露绿景纹理后慢慢恢复。
            </EffectDescription>
            <ExampleVisual
              id="example.image.hover-reveal"
              visual={<HoverRevealVisual id="example.image.hover-reveal" />}
            >
              <img
                className="example-media example-media-wide"
                src="/example/show.png"
                alt="图片悬停叠层示例"
              />
            </ExampleVisual>
          </section>
          {([false, true] as const).map((drift) => {
            const id = drift ? "example.video.drift" : "example.video.playback";
            return (
              <section className="example-row" key={id}>
                <EffectDescription
                  source="VideoTexture"
                  title={drift ? "视频漂移" : "视频播放"}
                >
                  同一个 DOM video 提供播放、降级与原生 Three.js 视频纹理。
                </EffectDescription>
                <ExampleVisual
                  id={id}
                  visual={
                    <VideoVisual
                      id={id}
                      src="/example/video.mp4"
                      playbackRate={drift ? 1.05 : 0.8}
                      drift={drift}
                    />
                  }
                >
                  <video
                    className="example-media"
                    src="/example/video.mp4"
                    muted
                    playsInline
                    loop
                    controls
                  />
                </ExampleVisual>
              </section>
            );
          })}
          <EffectsGroup id="scroll" />
          <SequenceExample />
          <PinnedScrollExample />
          <EffectsGroup id="models" />
          {(["spin", "float", "glow"] as const).map((mode) => {
            const id = `example.model.${mode}`;
            const src = mode === "glow" ? "/models/4.glb" : "/models/hero.glb";
            return (
              <section className="example-row" key={id}>
                <EffectDescription
                  source="useGLTF"
                  title={
                    mode === "spin"
                      ? "模型旋转"
                      : mode === "float"
                        ? "模型浮动"
                        : "模型自发光"
                  }
                >
                  Drei 负责加载，useFrame 直接控制原生 Object3D 与材质。
                </EffectDescription>
                <ExampleVisual
                  id={id}
                  perspective
                  visual={
                    <ModelVisual
                      id={id}
                      src={src}
                      mode={mode}
                      dracoPath={mode === "glow" ? "/draco/gltf/" : undefined}
                    />
                  }
                >
                  <section
                    className={`example-panel example-panel-model${mode === "spin" ? "" : ` example-panel-model-${mode}`}`}
                  >
                    <strong>
                      {mode === "spin"
                        ? "模型持续旋转"
                        : mode === "float"
                          ? "模型随时间浮动"
                          : "模型自发光与局部灯光"}
                    </strong>
                  </section>
                </ExampleVisual>
              </section>
            );
          })}
          <EffectsGroup id="site" />
          <RecipeExamples />
        </div>
      </main>
      <RuntimeDebugPanel />
    </WebGLScrollRuntime>
  );
}

function SequenceExample() {
  const resources = useExampleResources();
  const card = useRef<HTMLElement>(null);
  const id = "example.image-sequence.scrub";
  const progressKey = "example.video.scrub";
  return (
    <ScrollEffectSection
      className="example-row example-video-scrub-row"
      progressKey={progressKey}
      start="top top"
      end="+=900%"
      pin
      scrub
    >
      <EffectDescription source="Texture / scroll" title="滚动控制图片序列">
        固定区间中的图片序列、卡片移动与边缘光共享滚动进度。
      </EffectDescription>
      <ExampleVisual
        id={id}
        visual={
          resources.imageSequence ? (
            <SequenceVisual
              id={id}
              sequence={resources.imageSequence}
              progressKey={progressKey}
              card={card}
            />
          ) : null
        }
      >
        <section
          className="example-media example-media-video-bg example-media-sequence"
          aria-busy={!resources.imageSequenceReady}
        >
          <img
            alt="图片序列首帧"
            className="example-media-sequence-fallback"
            src="/example/bg-sequence/frame_0001.webp"
          />
          <aside ref={card} className="example-sequence-card">
            <strong>固定区间卡片</strong>
            <span>卡片留在 pinned 区间内，由滚动进度控制偏移和边缘光效。</span>
          </aside>
        </section>
      </ExampleVisual>
    </ScrollEffectSection>
  );
}

function ClearCanvas() {
  useFrame(({ gl, size }) => {
    gl.setScissorTest(false);
    gl.setViewport(0, 0, size.width, size.height);
    gl.setClearColor(0x000000, 0);
    gl.clear();
  }, 0);
  return null;
}

function RuntimeDebugPanel() {
  const runtime = useWebGLRuntime();
  const [state, setState] = useState(() => runtime.getDebugState());
  useEffect(() => {
    const timer = window.setInterval(
      () => setState(runtime.getDebugState()),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [runtime]);
  return (
    <details className="example-runtime-debug">
      <summary>Runtime</summary>
      <pre>{JSON.stringify(state, null, 2)}</pre>
    </details>
  );
}
