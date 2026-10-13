import React from "react";
import { ScrollEffectSection } from "@viselora/scroll-adapters/react";
import { EffectDescription } from "./EffectDescription";
import { ExampleVisual } from "./ExampleVisual";
import { TextVisual } from "./BasicVisuals";

export const pinnedRevealProgressKey = "example.pinned.reveal";
const options = { color: "#172124", progressKey: pinnedRevealProgressKey };

export function PinnedScrollExample() {
  return (
    <ScrollEffectSection
      className="example-row example-pinned-row"
      progressKey={pinnedRevealProgressKey}
      start="top top"
      end="+=140%"
      pin
      scrub
    >
      <EffectDescription source="DOM → CanvasTexture" title="固定滚动显现">
        页面继续真实滚动，命名进度信号控制原生纹理中的文字显现。
      </EffectDescription>
      <ExampleVisual
        id={pinnedRevealProgressKey}
        visual={
          <TextVisual
            id={pinnedRevealProgressKey}
            mode="pinned"
            options={options}
          />
        }
      >
        <p className="example-text example-pinned-text">滚动控制文字</p>
      </ExampleVisual>
    </ScrollEffectSection>
  );
}
