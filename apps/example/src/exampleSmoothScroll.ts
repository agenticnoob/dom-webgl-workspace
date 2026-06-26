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
  return new Lenis({
    autoRaf: false,
    lerp: 0.06,
    smoothWheel: true,
    touchMultiplier: 1,
    wheelMultiplier: 0.9,
  });
}
