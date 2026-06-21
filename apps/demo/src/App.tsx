import * as React from "react";
import { useState } from "react";
import type { WebGLDebugState } from "@project/dom-webgl-runtime";
import { WebGLRuntime, WebGLTarget } from "@project/dom-webgl-runtime/react";

import "./demo.css";
import { DebugPanel } from "./debugPanel";
import {
  demoCapabilityImageTextureEffect,
  demoCapabilitySurfaceEffect,
  demoCapabilityTextLayerEffect,
  demoCapabilityVideoPlaybackEffect,
  demoGLBVertexParticlesEffect,
  demoGLBRotateEffect,
  demoPointerTiltEffect,
  demoSurfaceEffect,
} from "./demoEffects";

const demoRuntimeEffects = [
  demoSurfaceEffect,
  demoPointerTiltEffect,
  demoCapabilitySurfaceEffect,
  demoCapabilityTextLayerEffect,
  demoCapabilityImageTextureEffect,
  demoCapabilityVideoPlaybackEffect,
  demoGLBRotateEffect,
  demoGLBVertexParticlesEffect,
] as const;

export default function App() {
  const [debugState, setDebugState] = useState<WebGLDebugState>(createInitialDebugState);

  return (
    <main className="demo-shell">
      <WebGLRuntime
        className="demo-runtime"
        effects={demoRuntimeEffects}
        onDebugStateChange={setDebugState}
      >
        <WebGLTarget as="section" className="demo-scene" aria-label="DOM WebGL demo scene"
          webgl={{
            key: "demo.section",
            source: { kind: "snapshot", mode: "element" },
          }}>
          <header className="demo-header">
            <p className="demo-kicker">Phase 3 Demo / 第三阶段演示</p>
            <h1>One runtime, five source categories. 一个 runtime，五类 source。</h1>
            <p className="demo-summary">
              The DOM stays author-facing. The runtime compiles declared targets into a
              single WebGL scene. DOM 保持作者可见，runtime 把声明的目标编译进同一个
              WebGL 场景。
            </p>
          </header>

          <div className="demo-grid">
            <WebGLTarget
              className="demo-card demo-card-surface"
              webgl={{
                key: "demo.surface",
                source: { kind: "snapshot", mode: "element" },
                effects: [{ kind: "demo.capabilitySurface" }],
                // lifecycle: { hideWhenReady: false },
              }}
            >
              <p className="demo-label">Element snapshot / 元素快照</p>
              <strong>Surface target / 表面目标</strong>
              <span>Box paint and layout-driven fallback content. 盒模型和布局驱动的 fallback 内容。</span>
            </WebGLTarget>

            <WebGLTarget
              as="h2"
              className="demo-card demo-card-text"
              webgl={{
                key: "demo.text",
                source: { kind: "snapshot", mode: "text" },
                effects: [{ kind: "demo.capabilityTextLayer" }],
                // lifecycle: { hideWhenReady: false },
              }}
            >
              Text snapshot target / 文字快照目标
            </WebGLTarget>

            <WebGLTarget
              as="img"
              className="demo-card demo-card-media"
              alt="Demo image target / 演示图片目标"
              src="/demo/image.png"
              webgl={{
                key: "demo.image",
                source: { kind: "image", src: "/demo/image.png" },
                effects: [{ kind: "demo.capabilityImageTexture" }],
                // lifecycle: { hideWhenReady: false },
              }}
            />

            <WebGLTarget
              as="video"
              className="demo-card demo-card-media"
              controls
              loop
              muted
              playsInline
              src="/demo/video.mp4"
              webgl={{
                key: "demo.video",
                source: { kind: "video", src: "/demo/video.mp4" },
                effects: [{ kind: "demo.capabilityVideoPlayback" }],
                // lifecycle: { hideWhenReady: false },
              }}
            />

            <WebGLTarget
              className="demo-card demo-card-model"
              webgl={{
                key: "demo.model",
                source: { kind: "model", format: "glb", src: "/models/hero.glb" },
                lifecycle: { hideWhenReady: true, hideMode: "subtree" },
                effects: [
                  {
                    kind: "demo.glbRotate",
                    rotationSpeed: 0.5,
                  },
                  {
                    kind: "demo.glbVertexParticles",
                    color: "rgb(255, 0, 0)",
                    density: 2.5,
                    size: 0.026,
                    scatterRadius: 0.42,
                    hitRadius: 0.075,
                    scatterStrength: 1.8,
                    returnStrength: 0.075,
                    damping: 0.9,
                  },
                ],
              }}
            >
              <p className="demo-label">GLB model / GLB 模型</p>
              <strong>/models/hero.glb</strong>
              <span>Anchor this panel to a model renderable in the shared scene. 这个面板锚定到共享场景里的模型 renderable。</span>
            </WebGLTarget>
          </div>

          <section className="demo-layout" aria-label="DOM layout and content targets">
            <WebGLTarget
              className="demo-layout-card demo-layout-card-surface"
              webgl={{
                key: "demo.layout.surface",
                source: { kind: "snapshot", mode: "element" },
              }}
            >
              <p className="demo-label">Layout anchor / 布局锚点</p>
              <strong>Content box target / 内容盒目标</strong>
              <span>Padding and measured layout feed WebGL placement. padding 和测量布局会进入 WebGL 摆放逻辑。</span>
            </WebGLTarget>

            <WebGLTarget
              as="p"
              className="demo-layout-card demo-layout-card-text"
              webgl={{
                key: "demo.layout.text",
                source: { kind: "snapshot", mode: "text" },
              }}
            >
              Multi-line text snapshot with centered alignment and responsive line
              wrapping. 多行文字快照，居中对齐，并随宽度响应式换行。
            </WebGLTarget>

            <WebGLTarget
              as="img"
              className="demo-layout-card demo-layout-card-media"
              alt="Responsive object-fit cover target / 响应式 object-fit cover 目标"
              src="/demo/layout-cover.png"
              webgl={{
                key: "demo.layout.image",
                source: { kind: "image", src: "/demo/layout-cover.png" },
              }}
            />
          </section>

          <section className="demo-effects" aria-label="WebGL effect and material targets">
            <WebGLTarget
              className="demo-effect-surface"
              webgl={{
                key: "demo.effects.surface",
                source: { kind: "snapshot", mode: "element" },
                effects: [
                  { kind: "demo.surface", opacity: 0.82 },
                  { kind: "demo.pointerTilt", strength: 0.6, maxDegrees: 8 },
                ],
              }}
            >
              <p className="demo-label">Effect material / 效果材质</p>
              <strong>Solid WebGL surface / WebGL 实色表面</strong>
              <span>Pointer state drives a small runtime-owned tilt. 指针状态驱动 runtime 持有的小幅倾斜。</span>
            </WebGLTarget>

            <WebGLTarget
              as="section"
              className="demo-effect-card demo-effect-card--phase6"
              webgl={{
                key: "demo.effects.surface.phase6",
                source: { kind: "snapshot", mode: "element" },
                lifecycle: { hideWhenReady: true, hideMode: "self" },
                effects: [
                  { kind: "demo.surface", opacity: 0.86 },
                  { kind: "demo.pointerTilt", strength: 1, maxDegrees: 15 },
                ],
              }}
            >
              <span>Phase 6 surface material / 第六阶段表面材质</span>
            </WebGLTarget>
          </section>

          <section className="demo-scroll-harness" aria-label="Scroll event effect targets">
            <header className="demo-scroll-header">
              <p className="demo-kicker">Scroll event harness / 滚动事件测试区</p>
              <h2>More targets, more page travel. 更多目标，更长滚动距离。</h2>
            </header>

            <div className="demo-scroll-stack">
              <WebGLTarget
                className="demo-scroll-card demo-scroll-card--mint"
                webgl={{
                  key: "demo.scroll.marker.01",
                  source: { kind: "snapshot", mode: "element" },
                  effects: [
                    { kind: "demo.surface", opacity: 0.58 },
                    { kind: "demo.pointerTilt", strength: 0.25, maxDegrees: 4 },
                  ],
                }}
              >
                <div>
                  <p className="demo-label">Scroll marker 01 / 滚动标记 01</p>
                  <strong>Top threshold / 顶部阈值</strong>
                  <span>
                    Large element anchor for checking enter and leave ranges near the hero.
                    大尺寸元素锚点，用来检查 hero 附近的进入和离开区间。
                  </span>
                </div>
                <em>0-15%</em>
              </WebGLTarget>

              <WebGLTarget
                className="demo-scroll-card demo-scroll-card--sky"
                webgl={{
                  key: "demo.scroll.marker.02",
                  source: { kind: "snapshot", mode: "element" },
                  lifecycle: { hideWhenReady: true, hideMode: "self" },
                  effects: [{ kind: "demo.surface", opacity: 0.64 }],
                }}
              >
                <div>
                  <p className="demo-label">Scroll marker 02 / 滚动标记 02</p>
                  <strong>Slow text band / 慢速文字带</strong>
                  <WebGLTarget
                    as="p"
                    className="demo-scroll-copy"
                    webgl={{
                      key: "demo.scroll.marker.02.copy",
                      source: { kind: "snapshot", mode: "text" },
                    }}
                  >
                    Text snapshot target with enough copy to expose line wrapping during scroll.
                    带有足够文案的文字快照目标，用来观察滚动时的换行表现。
                  </WebGLTarget>
                </div>
                <em>15-25%</em>
              </WebGLTarget>

              <WebGLTarget
                className="demo-scroll-card demo-scroll-card--rose"
                webgl={{
                  key: "demo.scroll.marker.03",
                  source: { kind: "snapshot", mode: "element" },
                  effects: [{ kind: "demo.surface", opacity: 0.64 }],
                }}
              >
                <div>
                  <p className="demo-label">Scroll marker 03 / 滚动标记 03</p>
                  <strong>Pinned-size card / 固定尺寸卡片</strong>
                  <span>
                    Fixed-height DOM block for comparing rect stability against page scroll.
                    固定高度 DOM 区块，用来对比页面滚动时的矩形稳定性。
                  </span>
                </div>
                <em>25-35%</em>
              </WebGLTarget>

              <WebGLTarget
                className="demo-scroll-card demo-scroll-card--amber"
                webgl={{
                  key: "demo.scroll.marker.04",
                  source: { kind: "snapshot", mode: "element" },
                  effects: [
                    { kind: "demo.surface", opacity: 0.62 },
                    { kind: "demo.pointerTilt", strength: 0.45, maxDegrees: 6 },
                  ],
                }}
              >
                <div>
                  <p className="demo-label">Scroll marker 04 / 滚动标记 04</p>
                  <strong>Pointer overlap / 指针重叠区</strong>
                  <span>
                    Use this section to test pointer and scroll input together over the same
                    target. 在同一个目标上同时测试指针输入和滚动输入。
                  </span>
                </div>
                <em>35-45%</em>
              </WebGLTarget>

              <WebGLTarget
                className="demo-scroll-card demo-scroll-card--mint"
                webgl={{
                  key: "demo.scroll.marker.05",
                  source: { kind: "snapshot", mode: "element" },
                }}
              >
                <div>
                  <p className="demo-label">Scroll marker 05 / 滚动标记 05</p>
                  <strong>Mid-page checkpoint / 页面中段检查点</strong>
                  <span>
                    Middle viewport anchor for testing normalized scroll progress calculations.
                    位于页面中段的视口锚点，用来测试归一化滚动进度。
                  </span>
                </div>
                <em>45-55%</em>
              </WebGLTarget>

              <WebGLTarget
                className="demo-scroll-card demo-scroll-card--sky"
                webgl={{
                  key: "demo.scroll.marker.06",
                  source: { kind: "snapshot", mode: "element" },
                  lifecycle: { hideWhenReady: true, hideMode: "self" },
                  effects: [{ kind: "demo.surface", opacity: 0.64 }],
                }}
              >
                <div>
                  <p className="demo-label">Scroll marker 06 / 滚动标记 06</p>
                  <strong>Dense copy target / 密集文案目标</strong>
                  <WebGLTarget
                    as="p"
                    className="demo-scroll-copy"
                    webgl={{
                      key: "demo.scroll.marker.06.copy",
                      source: { kind: "snapshot", mode: "text" },
                    }}
                  >
                    Another text source to confirm scroll-driven effects can target content-only
                    snapshots. 另一个文字源，用来确认滚动驱动效果可以作用在纯内容快照上。
                  </WebGLTarget>
                </div>
                <em>55-65%</em>
              </WebGLTarget>

              <WebGLTarget
                className="demo-scroll-card demo-scroll-card--rose"
                webgl={{
                  key: "demo.scroll.marker.07",
                  source: { kind: "snapshot", mode: "element" },
                  effects: [{ kind: "demo.surface", opacity: 0.68 }],
                }}
              >
                <div>
                  <p className="demo-label">Scroll marker 07 / 滚动标记 07</p>
                  <strong>Late-page surface / 页面后段表面</strong>
                  <span>
                    Effect-enabled element target placed far enough down to force real scrollbar
                    travel. 放在页面较后位置的 effect 目标，用来制造真实滚动距离。
                  </span>
                </div>
                <em>65-80%</em>
              </WebGLTarget>

              <WebGLTarget
                className="demo-scroll-card demo-scroll-card--amber"
                webgl={{
                  key: "demo.scroll.marker.08",
                  source: { kind: "snapshot", mode: "element" },
                  effects: [
                    { kind: "demo.surface", opacity: 0.7 },
                    { kind: "demo.pointerTilt", strength: 0.35, maxDegrees: 5 },
                  ],
                }}
              >
                <div>
                  <p className="demo-label">Scroll marker 08 / 滚动标记 08</p>
                  <strong>Bottom threshold / 底部阈值</strong>
                  <span>
                    Final anchor for checking bottom-of-page event behavior without scene gate
                    locking. 最后的底部锚点，用来检查没有 scene gate 锁定时的页面底部事件。
                  </span>
                </div>
                <em>80-100%</em>
              </WebGLTarget>
            </div>
          </section>

          <DebugPanel state={debugState} />
        </WebGLTarget>
      </WebGLRuntime>
    </main>
  );
}

function createInitialDebugState(): WebGLDebugState {
  return {
    targetCount: 0,
    renderableCount: 0,
    currentScrollMode: "page",
    pointer: {
      x: 0,
      y: 0,
      normalizedX: 0,
      normalizedY: 0,
      isInside: false,
      isDown: false,
      downTime: 0,
      pressDuration: 0,
      isDragging: false,
      dragStartX: 0,
      dragStartY: 0,
      dragDeltaX: 0,
      dragDeltaY: 0,
      clickCount: 0,
    },
    targets: [],
  };
}
