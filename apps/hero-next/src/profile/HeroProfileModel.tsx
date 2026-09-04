import { WebGLModel, type WebGLModelProps } from "@viselora/dom-webgl/react";
import React from "react";

import { heroChapterDefinitions } from "../chapters/definitions";

const profileModelLoader = {
  draco: { decoderPath: "/draco/gltf/", preload: true },
} satisfies NonNullable<WebGLModelProps["loader"]>;

const profileModelEffects = [
  {
    kind: "hero.profile.model",
    spinProgressKey: heroChapterDefinitions.self.signals.body,
  },
] satisfies NonNullable<WebGLModelProps["effects"]>;

export function HeroProfileModel() {
  return (
    <WebGLModel
      id="hero.profile.model"
      src="/models/noobli-profile.glb"
      loader={profileModelLoader}
      effects={profileModelEffects}
    />
  );
}
