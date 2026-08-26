import type { WebGLScrollSmoothOptions } from "@viselora/scroll-adapters/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

gsap.registerPlugin(ScrollTrigger);

export const heroSmoothScroll = {
  createLenis: () =>
    new Lenis({ lerp: 0.085, smoothWheel: true, syncTouch: false }),
  gsap,
  ScrollTrigger,
  disableLagSmoothing: true,
} satisfies WebGLScrollSmoothOptions;
