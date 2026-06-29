import * as React from "react";
import { WebGLTarget } from "@project/dom-webgl-runtime/react";
import { ScrollEffectSection } from "@project/dom-webgl-scroll-adapters/react";

import { EffectDescription } from "./EffectDescription";

export const pinnedRevealProgressKey = "example.pinned.reveal";

const pinnedRevealEffects = [
  {
    kind: "example.pinnedReveal",
    color: "#172124",
    progressKey: pinnedRevealProgressKey,
  },
] as const;

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
      <EffectDescription source="dom/text" title="固定滚动显现">
        页面继续真实滚动，但这个区域的滚动进度会直接控制 WebGL 文字显现。
      </EffectDescription>
      <WebGLTarget
        as="p"
        className="example-text example-pinned-text"
        webgl={{
          key: pinnedRevealProgressKey,
          source: { kind: "dom", type: "text" },
          lifecycle: { hideWhenReady: true, hideMode: "self" },
          effects: pinnedRevealEffects,
        }}
      >
        滚动控制文字
      </WebGLTarget>
    </ScrollEffectSection>
  );
}
