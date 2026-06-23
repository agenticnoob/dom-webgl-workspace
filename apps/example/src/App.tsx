import * as React from "react";
import { WebGLRuntime, WebGLTarget } from "@project/dom-webgl-runtime/react";

import { exampleEffects } from "./exampleEffects";
import { useExampleSmoothScrollStack } from "./useExampleSmoothScrollStack";

export default function App() {
  const smoothScroll = useExampleSmoothScrollStack();

  return (
    <WebGLRuntime
      className="example-runtime"
      effects={exampleEffects}
      scrollAdapter={smoothScroll?.scrollAdapter}
    >
      <main className="example-shell">
        <section className="example-intro">
          <p className="example-kicker">效果编写示例</p>
          <h1>应用自己编写 WebGL 效果，包只提供运行时原语。</h1>
        </section>

        <div className="example-stack">
          <section className="example-row">
            <div className="example-row-copy">
              <span>snapshot/element</span>
              <h2>表面填充</h2>
              <p>用 bg.png 填充元素快照表面，并只控制表面层透明度。</p>
            </div>
            <WebGLTarget
              as="section"
              className="example-panel example-panel-gold"
              webgl={{
                key: "example.surface.fill",
                source: { kind: "snapshot", mode: "element" },
                lifecycle: { hideWhenReady: true, hideMode: "self" },
                effects: [
                  {
                    kind: "example.surfaceFill",
                    imageSrc: "/example/bg.png",
                    opacity: 0.72,
                  },
                ],
              }}
            >
              <span>surface</span>
              <strong>把元素快照绘制到 WebGL 表面。</strong>
            </WebGLTarget>
          </section>

          <section className="example-row">
            <div className="example-row-copy">
              <span>snapshot/element</span>
              <h2>表面脉冲</h2>
              <p>保留声明式 DOM 来源，同时在 WebGL 表面层绘制可见脉冲。</p>
            </div>
            <WebGLTarget
              as="section"
              className="example-panel example-panel-coral"
              webgl={{
                key: "example.surface.pulse",
                source: { kind: "snapshot", mode: "element" },
                lifecycle: { hideWhenReady: true, hideMode: "self" },
                effects: [{ kind: "example.surfacePulse", scale: 1.36, opacity: 0.92 }],
              }}
            >
              <span>target</span>
              <strong>真实 DOM 文案盖在 WebGL 脉冲表面之上。</strong>
            </WebGLTarget>
          </section>

          <section className="example-row">
            <div className="example-row-copy">
              <span>snapshot/text</span>
              <h2>文字波浪</h2>
              <p>文本仍写在 JSX 里，effect 只改写 WebGL 字形绘制命令。</p>
            </div>
            <WebGLTarget
              as="p"
              className="example-text"
              webgl={{
                key: "example.text.wave",
                source: { kind: "snapshot", mode: "text" },
                lifecycle: { hideWhenReady: true, hideMode: "self" },
                effects: [{ kind: "example.textWave", amplitude: 7 }],
              }}
            >
              文本内容由 DOM 编写，字形输出由 effect 接管。
            </WebGLTarget>
          </section>

          <section className="example-row">
            <div className="example-row-copy">
              <span>snapshot/text</span>
              <h2>文字显现</h2>
              <p>把滚动进度映射到每个字形的透明度和缩放。</p>
            </div>
            <WebGLTarget
              as="p"
              className="example-text example-text-compact"
              webgl={{
                key: "example.text.reveal",
                source: { kind: "snapshot", mode: "text" },
                lifecycle: { hideWhenReady: true, hideMode: "self" },
                effects: [{ kind: "example.textReveal", color: "#d95f42" }],
              }}
            >
              基于包原语实现的滚动字形显现。
            </WebGLTarget>
          </section>

          <section className="example-row">
            <div className="example-row-copy">
              <span>image</span>
              <h2>图片平移</h2>
              <p>不修改 DOM 图片元素，只移动 WebGL 纹理采样。</p>
            </div>
            <WebGLTarget
              as="img"
              className="example-media"
              src="/example/image.png"
              alt="图片纹理平移示例"
              webgl={{
                key: "example.image.pan",
                source: { kind: "image", src: "/example/image.png" },
                effects: [{ kind: "example.imagePan", distance: 0.2 }],
              }}
            />
          </section>

          <section className="example-row">
            <div className="example-row-copy">
              <span>image</span>
              <h2>图片缩放</h2>
              <p>从 image source 创建渲染对象，再由 effect 驱动 target 缩放。</p>
            </div>
            <WebGLTarget
              as="img"
              className="example-media"
              src="/example/image.png"
              alt="图片缩放示例"
              webgl={{
                key: "example.image.zoom",
                source: { kind: "image", src: "/example/image.png" },
                effects: [{ kind: "example.imageZoom", maxScale: 1.36 }],
              }}
            />
          </section>

          <section className="example-row">
            <div className="example-row-copy">
              <span>video</span>
              <h2>视频播放</h2>
              <p>通过 video capability handle 配置静音、播放和播放速度。</p>
            </div>
            <WebGLTarget
              as="video"
              className="example-media"
              src="/example/video.mp4"
              muted
              playsInline
              loop
              webgl={{
                key: "example.video.playback",
                source: { kind: "video", src: "/example/video.mp4" },
                effects: [{ kind: "example.videoPlayback", playbackRate: 0.8 }],
              }}
            />
          </section>

          <section className="example-row">
            <div className="example-row-copy">
              <span>video</span>
              <h2>视频漂移</h2>
              <p>对同一种 video source 叠加实时纹理漂移。</p>
            </div>
            <WebGLTarget
              as="video"
              className="example-media"
              src="/example/video.mp4"
              muted
              playsInline
              loop
              webgl={{
                key: "example.video.drift",
                source: { kind: "video", src: "/example/video.mp4" },
                effects: [
                  { kind: "example.videoPlayback", playbackRate: 1.05 },
                  { kind: "example.videoDrift", distance: 0.12 },
                ],
              }}
            />
          </section>

          <section className="example-row">
            <div className="example-row-copy">
              <span>model/glb</span>
              <h2>模型旋转</h2>
              <p>通过公开 target controls 旋转 runtime 持有的 GLB。</p>
            </div>
            <WebGLTarget
              as="section"
              className="example-panel example-panel-model"
              webgl={{
                key: "example.model.spin",
                source: { kind: "model", format: "glb", src: "/models/hero.glb" },
                lifecycle: { hideWhenReady: true, hideMode: "subtree" },
                effects: [{ kind: "example.modelSpin", speed: 0.25 }],
              }}
            >
              <span>model/glb</span>
              <strong>用 target controls 旋转 runtime 持有的模型。</strong>
            </WebGLTarget>
          </section>

          <section className="example-row">
            <div className="example-row-copy">
              <span>model/glb</span>
              <h2>模型浮动</h2>
              <p>结合布局数据和 runtime time 移动、旋转 GLB。</p>
            </div>
            <WebGLTarget
              as="section"
              className="example-panel example-panel-model example-panel-model-float"
              webgl={{
                key: "example.model.float",
                source: { kind: "model", format: "glb", src: "/models/hero.glb" },
                lifecycle: { hideWhenReady: true, hideMode: "subtree" },
                effects: [{ kind: "example.modelFloat", amplitude: 24 }],
              }}
            >
              <span>layout + time</span>
              <strong>根据布局位置让模型持续浮动。</strong>
            </WebGLTarget>
          </section>
        </div>
      </main>
    </WebGLRuntime>
  );
}
