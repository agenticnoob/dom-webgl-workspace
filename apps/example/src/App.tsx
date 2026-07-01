import * as React from "react";
import {
  WebGLDebugPanel,
  WebGLTarget,
  useWebGLDebugState,
} from "@project/dom-webgl-runtime/react";
import {
  ScrollEffectSection,
  WebGLScrollRuntime,
} from "@project/dom-webgl-scroll-adapters/react";

import { EffectDescription } from "./EffectDescription";
import { exampleSmoothScrollOptions } from "./exampleSmoothScroll";
import { exampleEffects } from "./exampleEffects";
import { useExampleResources } from "./exampleResourceScheduler";
import { PinnedScrollExample } from "./PinnedScrollExample";
import { SnapshotElementExamples } from "./SnapshotElementExamples";

const videoScrubProgressKey = "example.video.scrub";
const sequenceCardEffects = [
  {
    kind: "example.sequenceCardSlide",
    progressKey: videoScrubProgressKey,
    travel: 96,
    minOpacity: 0.72,
    maxOpacity: 1,
  },
  {
    kind: "example.sequenceCardBorderGlow",
    progressKey: videoScrubProgressKey,
    travel: 96,
    edgeSensitivity: 0.28,
    colorSensitivity: 0.48,
    glowRadius: 44,
    glowIntensity: 1,
    fillOpacity: 0.46,
  },
] as const;

export default function App() {
  const [debugState, onDebugStateChange] = useWebGLDebugState();
  const exampleResources = useExampleResources();

  return (
    <WebGLScrollRuntime
      className="example-runtime"
      effects={exampleEffects}
      smooth={exampleSmoothScrollOptions}
      onDebugStateChange={onDebugStateChange}
    >
      <main className="example-shell">
        <section className="example-intro">
          <p className="example-kicker">效果编写示例</p>
          <h1>应用侧 WebGL 效果，包只提供运行时原语。</h1>
        </section>

        <div className="example-stack">
          <SnapshotElementExamples />

          <section className="example-row">
            <EffectDescription source="dom/text" title="文字波浪">
              文本仍写在 JSX 里，effect 只改写 WebGL 字形绘制命令。
            </EffectDescription>
            <WebGLTarget
              as="p"
              className="example-text"
              webgl={{
                key: "example.text.wave",
                source: { kind: "dom", type: "text" },
                lifecycle: { hideWhenReady: true, hideMode: "self" },
                effects: [{ kind: "example.textWave", amplitude: 7 }],
              }}
            >
              文本内容由 DOM 编写，字形输出由 effect 接管。
            </WebGLTarget>
          </section>

          <section className="example-row">
            <EffectDescription source="dom/text" title="文字显现">
              把当前视口位置和滚动进度映射到每个字形的透明度和缩放。
            </EffectDescription>
            <WebGLTarget
              as="p"
              className="example-text example-text-compact"
              webgl={{
                key: "example.text.reveal",
                source: { kind: "dom", type: "text" },
                lifecycle: { hideWhenReady: true, hideMode: "self" },
                effects: [{ kind: "example.textReveal", color: "#d95f42" }],
              }}
            >
              基于包原语实现的滚动字形显现。
            </WebGLTarget>
          </section>

          <section className="example-row">
            <EffectDescription source="dom/text" title="文字聚光">
              根据 target-local pointer 或 runtime time 计算字形中心距离，只改 WebGL 字形命令。
            </EffectDescription>
            <WebGLTarget
              as="p"
              className="example-text example-text-spotlight"
              webgl={{
                key: "example.text.spotlight",
                source: { kind: "dom", type: "text" },
                lifecycle: { hideWhenReady: true, hideMode: "self" },
                effects: [{ kind: "example.textSpotlight", color: "#f6c453", radius: 180 }],
              }}
            >
              指针掠过文字时，WebGL 字形会像被手电扫过一样亮起来。
            </WebGLTarget>
          </section>

          <section
            className="example-row"
          >
            <EffectDescription source="dom/text" title="文字压感">
              用 target-local pointer 距离改写 WebGL 字形缩放、透明度和颜色。
            </EffectDescription>
            <WebGLTarget
              as="p"
              className="example-text example-text-pressure"
              webgl={{
                key: "example.text.pressure",
                source: { kind: "dom", type: "text" },
                lifecycle: { hideWhenReady: true, hideMode: "self" },
                effects: [
                  {
                    kind: "example.textPressure",
                    color: "#f4f4f5",
                    radius: 180,
                  },
                ],
              }}
            >
              Pressure
            </WebGLTarget>
          </section>

          <section className="example-row">
            <EffectDescription source="dom/text" title="文字扰码">
              指针附近的 WebGL 字形会临时替换为扰码字符，离开后回到原文。
            </EffectDescription>
            <WebGLTarget
              as="p"
              className="example-text example-text-scramble"
              webgl={{
                key: "example.text.scramble",
                source: { kind: "dom", type: "text" },
                lifecycle: { hideWhenReady: true, hideMode: "self" },
                effects: [
                  {
                    kind: "example.textScramble",
                    color: "#172124",
                    scrambleChars: ".:",
                    radius: 148,
                    speed: 0.45,
                  },
                ],
              }}
            >
              指针靠近时，字符会短暂打散，再回到原文。
            </WebGLTarget>
          </section>

          <section className="example-row">
            <EffectDescription source="media/image" title="图片平移">
              不修改 DOM 图片元素，按当前视口位置移动 WebGL 纹理采样。
            </EffectDescription>
            <WebGLTarget
              as="img"
              className="example-media"
              src="/example/image.png"
              alt="图片纹理平移示例"
              webgl={{
                key: "example.image.pan",
                source: { kind: "media", type: "image", src: "/example/image.png" },
                effects: [{ kind: "example.imagePan", distance: 0.2 }],
              }}
            />
          </section>

          <section className="example-row">
            <EffectDescription source="media/image" title="图片缩放">
              从 image source 创建渲染对象，再由 effect 驱动 target 缩放。
            </EffectDescription>
            <WebGLTarget
              as="img"
              className="example-media"
              src="/example/image.png"
              alt="图片缩放示例"
              webgl={{
                key: "example.image.zoom",
                source: { kind: "media", type: "image", src: "/example/image.png" },
                effects: [{ kind: "example.imageZoom", maxScale: 1.36 }],
              }}
            />
          </section>

          <section className="example-row">
            <EffectDescription source="media/image" title="图片镜头推进">
              对 image source 同时使用纹理采样偏移和 target scale，模拟慢速镜头运动。
            </EffectDescription>
            <WebGLTarget
              as="img"
              className="example-media example-media-tall"
              src="/example/bg.png"
              alt="图片镜头推进示例"
              webgl={{
                key: "example.image.ken-burns",
                source: { kind: "media", type: "image", src: "/example/bg.png" },
                effects: [{ kind: "example.imageKenBurns", distance: 0.16, maxScale: 1.22 }],
              }}
            />
          </section>

          <section className="example-row">
            <EffectDescription source="media/image" title="图片悬停叠层">
              像橡皮擦一样划开秋景，经过的位置短暂显露绿景纹理后慢慢恢复。
            </EffectDescription>
            <WebGLTarget
              as="img"
              className="example-media example-media-wide"
              src="/example/show.png"
              alt="图片悬停叠层示例"
              webgl={{
                key: "example.image.hover-reveal",
                source: { kind: "media", type: "image", src: "/example/show.png" },
                effects: [
                  {
                    kind: "example.imageHoverReveal",
                    revealSrc: "/example/mask.png",
                    radius: 132,
                    feather: 42,
                    restoreMs: 2200,
                    roughness: 0.26,
                  },
                ],
              }}
            />
          </section>

          <section className="example-row">
            <EffectDescription source="media/video" title="视频播放">
              通过 video capability handle 配置静音、播放和播放速度。
            </EffectDescription>
            <WebGLTarget
              as="video"
              className="example-media"
              src="/example/video.mp4"
              muted
              playsInline
              loop
              webgl={{
                key: "example.video.playback",
                source: { kind: "media", type: "video", src: "/example/video.mp4" },
                effects: [{ kind: "example.videoPlayback", playbackRate: 0.8 }],
              }}
            />
          </section>

          <section className="example-row">
            <EffectDescription source="media/video" title="视频漂移">
              对同一种 video source 叠加实时纹理漂移。
            </EffectDescription>
            <WebGLTarget
              as="video"
              className="example-media"
              src="/example/video.mp4"
              muted
              playsInline
              loop
              webgl={{
                key: "example.video.drift",
                source: { kind: "media", type: "video", src: "/example/video.mp4" },
                effects: [
                  { kind: "example.videoPlayback", playbackRate: 1.05 },
                  { kind: "example.videoDrift", distance: 0.12 },
                ],
              }}
            />
          </section>

          <ScrollEffectSection
            className="example-row example-video-scrub-row"
            progressKey={videoScrubProgressKey}
            start="top top"
            end="+=900%"
            pin
            scrub
          >
            <EffectDescription source="media/image-sequence" title="滚动控制图片序列">
              这个区域固定在视口中，滚动进度由 runtime 映射到 WebGL 图片序列帧。
            </EffectDescription>
            {exampleResources.imageSequenceReady ? (
              <WebGLTarget
                as="section"
                className="example-media example-media-video-bg example-media-sequence"
                webgl={{
                  key: "example.image-sequence.scrub",
                  source: {
                    kind: "media",
                    type: "image-sequence",
                    frameCount: exampleResources.imageSequenceFrames.length,
                    frames: exampleResources.imageSequenceFrames,
                    progressKey: videoScrubProgressKey,
                  },
                  lifecycle: { hideWhenReady: true, hideMode: "self" },
                }}
              >
                <WebGLTarget
                  as="aside"
                  className="example-sequence-card"
                  webgl={{
                    key: "example.image-sequence.card",
                    source: { kind: "dom", type: "element" },
                    lifecycle: { hideWhenReady: true, hideMode: "subtree" },
                    effects: sequenceCardEffects,
                  }}
                >
                  <strong>固定区间卡片</strong>
                  <span>卡片留在 pinned 区间内，由 effect 控制偏移和边缘光效。</span>
                </WebGLTarget>
              </WebGLTarget>
            ) : (
              <section
                aria-busy="true"
                className="example-media example-media-video-bg example-media-sequence"
              >
                <img
                  alt=""
                  aria-hidden="true"
                  className="example-media-sequence-fallback"
                  src="/example/bg-sequence/frame_0001.webp"
                />
              </section>
            )}
          </ScrollEffectSection>

          <section className="example-row">
            <EffectDescription source="model/glb" title="模型旋转">
              通过公开 target controls 旋转 runtime 持有的 GLB。
            </EffectDescription>
            {exampleResources.modelReady ? (
              <WebGLTarget
                as="section"
                className="example-panel example-panel-model"
                webgl={{
                  key: "example.model.spin",
                  source: { kind: "model", type: "glb", src: "/models/hero.glb" },
                  lifecycle: { hideWhenReady: true, hideMode: "subtree" },
                  effects: [{ kind: "example.modelSpin", speed: 0.25 }],
                }}
              >
                <strong>用 target controls 旋转 runtime 持有的模型。</strong>
              </WebGLTarget>
            ) : (
              <section className="example-panel example-panel-model" />
            )}
          </section>

          <section className="example-row">
            <EffectDescription source="model/glb" title="模型浮动">
              结合布局数据和 runtime time 移动、旋转 GLB。
            </EffectDescription>
            {exampleResources.modelReady ? (
              <WebGLTarget
                as="section"
                className="example-panel example-panel-model example-panel-model-float"
                webgl={{
                  key: "example.model.float",
                  source: { kind: "model", type: "glb", src: "/models/hero.glb" },
                  lifecycle: { hideWhenReady: true, hideMode: "subtree" },
                  effects: [{ kind: "example.modelFloat", amplitude: 24 }],
                }}
              >
                <strong>根据布局位置让模型持续浮动。</strong>
              </WebGLTarget>
            ) : (
              <section className="example-panel example-panel-model example-panel-model-float" />
            )}
          </section>

          <PinnedScrollExample />
        </div>
      </main>
      <WebGLDebugPanel state={debugState} />
    </WebGLScrollRuntime>
  );
}
