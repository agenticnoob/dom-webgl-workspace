// Recipe: the page's smooth scroll, passed to every WebGLScrollRuntime host.
//
//   <WebGLScrollRuntime smooth={smoothScroll} ...>
//
// - Lenis eases wheel input and moves the window scroll from the GSAP ticker,
//   so the DOM, ScrollTrigger progress and the runtime's scroll metrics follow
//   one eased position. With native scroll each wheel notch (often 100 px or
//   more) moves the page at once, and every DOM-bound or progress-driven
//   visual jumps with it.
// - Keep this object at module scope: a new object recreates the stack.
// - `autoRaf: false`: the runtime's GSAP ticker bridge drives `lenis.raf`; do
//   not add a second requestAnimationFrame loop.
// - Wheel input keeps native steps under `prefers-reduced-motion: reduce`.
//   `createLenis` runs after mount, so it may read `matchMedia`.
// - `anchors`: Lenis scrolls to in-page `#hash` links itself; a native jump
//   clicked while Lenis is still easing would be pulled back to its target.
// - Keyboard, scrollbar and an idle `window.scrollTo` stay native and Lenis
//   follows them. A scripted `window.scrollTo` during easing is overridden;
//   run scripted scrolls once the page is idle.
// - Requires `lenis` and `gsap` (ScrollTrigger ships with gsap).
import type { WebGLScrollSmoothOptions } from "@viselora/scroll-adapters/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import "lenis/dist/lenis.css";

gsap.registerPlugin(ScrollTrigger);

export const smoothScroll = {
  createLenis: () => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    return new Lenis({
      anchors: { immediate: reducedMotion },
      autoRaf: false,
      lerp: 0.08,
      smoothWheel: !reducedMotion,
      wheelMultiplier: 0.9,
    });
  },
  gsap,
  ScrollTrigger,
} satisfies WebGLScrollSmoothOptions;

/** Call after a layout change that moves sections (fonts, images, content). */
export function refreshScrollLayout(): void {
  ScrollTrigger.refresh();
}
