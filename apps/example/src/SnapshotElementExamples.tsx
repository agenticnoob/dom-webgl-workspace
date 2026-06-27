import * as React from "react";
import { WebGLTarget } from "@project/dom-webgl-runtime/react";

import { EffectDescription } from "./EffectDescription";

export function SnapshotElementExamples() {
  return (
    <>
      <section className="example-row">
        <EffectDescription source="dom/element" title="表面填充">
          用 bg.png 填充元素快照表面，并只控制表面层透明度。
        </EffectDescription>
        <WebGLTarget
          as="section"
          className="example-panel example-panel-gold"
          webgl={{
            key: "example.surface.fill",
            source: { kind: "dom", type: "element" },
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
          <strong>把元素快照绘制到 WebGL 表面。</strong>
        </WebGLTarget>
      </section>

      <section className="example-row">
        <EffectDescription source="dom/element" title="表面脉冲">
          保留声明式 DOM 来源，同时在 WebGL 表面层绘制可见脉冲。
        </EffectDescription>
        <WebGLTarget
          as="section"
          className="example-panel example-panel-coral"
          webgl={{
            key: "example.surface.pulse",
            source: { kind: "dom", type: "element" },
            lifecycle: { hideWhenReady: true, hideMode: "self" },
            effects: [{ kind: "example.surfacePulse", scale: 1.36, opacity: 0.92 }],
          }}
        >
          <strong>真实 DOM 文案盖在 WebGL 脉冲表面之上。</strong>
        </WebGLTarget>
      </section>

      <section className="example-row">
        <EffectDescription source="dom/element" title="视频背景纹理">
          把 bg.mp4 作为 element snapshot 的 effect 背景纹理，render 后静音循环播放。
        </EffectDescription>
        <WebGLTarget
          as="section"
          className="example-panel example-panel-video-bg"
          webgl={{
            key: "example.surface.video-background",
            source: { kind: "dom", type: "element" },
            lifecycle: { hideWhenReady: true, hideMode: "self" },
            effects: [
              {
                kind: "example.surfaceVideoBackground",
                videoSrc: "/example/bg.mp4",
                opacity: 0.84,
              },
            ],
          }}
        >
          <strong>视频作为 WebGL surface 背景，不把 div 伪装成 video source。</strong>
        </WebGLTarget>
      </section>

      <section className="example-row">
        <EffectDescription source="dom/element" title="Ghost Cursor">
          黑色 element surface 上绘制烟雾，当前 target 内的 pointer 只作为局部照明源。
        </EffectDescription>
        <WebGLTarget
          as="section"
          className="example-panel example-panel-ghost"
          webgl={{
            key: "example.surface.ghost-cursor",
            source: { kind: "dom", type: "element" },
            lifecycle: { hideWhenReady: true, hideMode: "self" },
            effects: [
              {
                kind: "example.surfaceGhostCursor",
                trailLength: 36,
                color: "#b497cf",
                opacity: 0.92,
              },
            ],
          }}
        >
          <strong className="example-ghost-copy">Boo!</strong>
        </WebGLTarget>
      </section>

      <section className="example-row">
        <EffectDescription source="dom/element" title="Waves">
          用同一个 element snapshot surface 生成线网波浪，只接受当前目标内的 pointer 扰动。
        </EffectDescription>
        <WebGLTarget
          as="section"
          className="example-panel example-panel-waves"
          webgl={{
            key: "example.surface.waves",
            source: { kind: "dom", type: "element" },
            lifecycle: { hideWhenReady: true, hideMode: "self" },
            effects: [
              {
                kind: "example.surfaceWaves",
                lineColor: "#172124",
                opacity: 0.82,
              },
            ],
          }}
        >
          <strong>Waves 背景仍是普通 DOM 声明加 effect 输出。</strong>
        </WebGLTarget>
      </section>
    </>
  );
}
