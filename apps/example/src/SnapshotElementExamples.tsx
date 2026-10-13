import React from "react";
import { EffectDescription } from "./EffectDescription";
import { ExampleVisual } from "./ExampleVisual";
import { SurfaceVisual, VideoVisual } from "./BasicVisuals";

const surfaces = [
  {
    id: "fill",
    title: "表面填充",
    className: "example-panel-gold",
    copy: "把元素表面绘制到原生 CanvasTexture。",
  },
  {
    id: "pulse",
    title: "表面脉冲",
    className: "example-panel-coral",
    copy: "真实 DOM 文案盖在 WebGL 脉冲表面之上。",
  },
  {
    id: "ghost",
    title: "Ghost Cursor",
    className: "example-panel-ghost",
    copy: "Boo!",
  },
  {
    id: "waves",
    title: "Waves",
    className: "example-panel-waves",
    copy: "Waves 背景由 ShaderMaterial 绘制。",
  },
] as const;

export function SnapshotElementExamples() {
  return (
    <>
      {surfaces.map((surface) => {
        const id = `example.surface.${surface.id}`;
        return (
          <section className="example-row" key={id}>
            <EffectDescription
              source="CanvasTexture / ShaderMaterial"
              title={surface.title}
            >
              应用直接编写 Three.js 材质；Runtime 管理 DOM
              布局、就绪状态和降级。
            </EffectDescription>
            <ExampleVisual
              id={id}
              retainText
              visual={<SurfaceVisual id={id} mode={surface.id} />}
            >
              <section className={`example-panel ${surface.className}`}>
                <strong
                  className={
                    surface.id === "ghost" ? "example-ghost-copy" : undefined
                  }
                >
                  {surface.copy}
                </strong>
              </section>
            </ExampleVisual>
          </section>
        );
      })}
      <section className="example-row">
        <EffectDescription source="VideoTexture" title="视频背景纹理">
          原生视频纹理在离屏时暂停，DOM 文案保持可读。
        </EffectDescription>
        <ExampleVisual
          id="example.surface.video-background"
          retainText
          visual={
            <VideoVisual
              id="example.surface.video-background"
              src="/example/bg.mp4"
              background
            />
          }
        >
          <section className="example-panel example-panel-video-bg">
            <strong>视频作为 WebGL surface 背景。</strong>
          </section>
        </ExampleVisual>
      </section>
    </>
  );
}
