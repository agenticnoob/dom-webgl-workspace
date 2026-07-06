import { createEffectDeclarations } from "@project/dom-webgl-runtime";

export type ExampleEffectParams = {
  "example.surfaceFill": { imageSrc?: string; opacity?: number };
  "example.surfacePulse": { scale?: number; opacity?: number };
  "example.surfaceVideoBackground": { videoSrc?: string; opacity?: number };
  "example.surfaceGhostCursor": { trailLength?: number; color?: string; opacity?: number };
  "example.surfaceWaves": { lineColor?: string; opacity?: number };
  "example.textWave": { amplitude?: number };
  "example.textReveal": { color?: string; progressKey?: string };
  "example.textSpotlight": { color?: string; radius?: number };
  "example.textPressure": { color?: string; radius?: number };
  "example.textScramble": { color?: string; scrambleChars?: string; radius?: number; speed?: number };
  "example.textSpotlightPressureScrambleWave": {
    baseColor?: string;
    spotlightColor?: string;
    scrambleChars?: string;
    radius?: number;
    amplitude?: number;
    speed?: number;
  };
  "example.managedTimelineCard": { progressKey: string };
  "example.pinnedReveal": { progressKey: string; color?: string };
  "example.sequenceCardSlide": {
    progressKey: string;
    travel?: number;
    minOpacity?: number;
    maxOpacity?: number;
  };
  "example.sequenceCardBorderGlow": {
    progressKey?: string;
    travel?: number;
    edgeSensitivity?: number;
    colorSensitivity?: number;
    glowIntensity?: number;
    glowRadius?: number;
    fillOpacity?: number;
  };
  "example.imagePan": { distance?: number };
  "example.imageZoom": { maxScale?: number };
  "example.imageKenBurns": { distance?: number; maxScale?: number };
  "example.imageHoverReveal": {
    revealSrc?: string;
    radius?: number;
    feather?: number;
    restoreMs?: number;
    roughness?: number;
  };
  "example.mediaPointerParallax": { bleed?: number; strength?: number };
  "example.videoPlayback": { playbackRate?: number };
  "example.videoDrift": { distance?: number };
  "example.modelDarkScene": {};
  "example.modelSpin": { speed?: number };
  "example.modelFloat": { amplitude?: number };
  "example.modelFloatGlow": {
    speed?: number;
    emissive?: string;
    lightIntensity?: number;
  };
  "example.sceneObjectHoverPulse": {
    baseOpacity?: number;
    hoverOpacity?: number;
    dragOpacity?: number;
  };
  "example.sceneObjectDragPose": {
    baseScale?: number;
    hoverScale?: number;
    dragScale?: number;
    baseRotationY?: number;
  };
};

export const typeSafeDeclarations = createEffectDeclarations<ExampleEffectParams>()([
  { kind: "example.surfaceFill", imageSrc: "/example/bg.png", opacity: 0.72 },
  { kind: "example.surfacePulse", scale: 1.36, opacity: 0.92 },
  { kind: "example.surfaceVideoBackground", videoSrc: "/example/bg.mp4", opacity: 0.84 },
  { kind: "example.surfaceGhostCursor", trailLength: 32, color: "#b497cf", opacity: 0.9 },
  { kind: "example.surfaceWaves", lineColor: "#172124", opacity: 0.82 },
  { kind: "example.managedTimelineCard", progressKey: "example.managedTimeline" },
  { kind: "example.textWave", amplitude: 7 },
  { kind: "example.textReveal", color: "#d95f42" },
  { kind: "example.textSpotlight", color: "#f6c453", radius: 180 },
  { kind: "example.textPressure", color: "#f4f4f5", radius: 180 },
  { kind: "example.textScramble", color: "#172124", scrambleChars: ".:", radius: 148, speed: 0.45 },
  {
    kind: "example.textSpotlightPressureScrambleWave",
    baseColor: "#f4f4f5",
    spotlightColor: "#f6c453",
    scrambleChars: "01",
    radius: 190,
    amplitude: 8,
    speed: 0.42,
  },
  { kind: "example.pinnedReveal", progressKey: "example.pinned.reveal", color: "#172124" },
  {
    kind: "example.sequenceCardSlide",
    progressKey: "example.video.scrub",
    travel: 280,
    minOpacity: 0.18,
    maxOpacity: 0.82,
  },
  {
    kind: "example.sequenceCardBorderGlow",
    progressKey: "example.video.scrub",
    travel: 280,
    edgeSensitivity: 0.3,
    colorSensitivity: 0.5,
    glowRadius: 40,
    glowIntensity: 1,
    fillOpacity: 0.42,
  },
  { kind: "example.imagePan", distance: 0.2 },
  { kind: "example.imageZoom", maxScale: 1.36 },
  { kind: "example.imageKenBurns", distance: 0.16, maxScale: 1.22 },
  {
    kind: "example.imageHoverReveal",
    revealSrc: "/example/mask.png",
    radius: 132,
    feather: 42,
    restoreMs: 2200,
    roughness: 0.26,
  },
  { kind: "example.mediaPointerParallax", bleed: 0.08, strength: 0.72 },
  { kind: "example.videoPlayback", playbackRate: 0.8 },
  { kind: "example.videoDrift", distance: 0.12 },
  { kind: "example.modelDarkScene" },
  { kind: "example.modelSpin", speed: 0.25 },
  { kind: "example.modelFloat", amplitude: 24 },
  {
    kind: "example.modelFloatGlow",
    speed: 0.46,
    emissive: "#7dd3fc",
    lightIntensity: 1.8,
  },
  {
    kind: "example.sceneObjectHoverPulse",
    baseOpacity: 0.68,
    hoverOpacity: 0.92,
    dragOpacity: 1,
  },
  {
    kind: "example.sceneObjectDragPose",
    baseScale: 4,
    hoverScale: 1.04,
    dragScale: 1.1,
    baseRotationY: -0.42,
  },
]);
