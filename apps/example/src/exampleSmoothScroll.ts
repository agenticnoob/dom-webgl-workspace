import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import "lenis/dist/lenis.css";

gsap.registerPlugin(ScrollTrigger);

export const exampleSmoothScrollOptions = {
  createLenis: createExampleLenis,
  gsap,
  ScrollTrigger,
  getViewportHeight: () => window.innerHeight,
} as const;

function createExampleLenis() {
  // Wheel input keeps native steps for readers who ask for reduced motion.
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return new Lenis({
    // Lenis scrolls to in-page anchors itself, so a click during easing lands.
    anchors: { immediate: reducedMotion },
    autoRaf: false,
    lerp: 0.06,
    smoothWheel: !reducedMotion,
    touchMultiplier: 1,
    wheelMultiplier: 0.9,
  });
}
