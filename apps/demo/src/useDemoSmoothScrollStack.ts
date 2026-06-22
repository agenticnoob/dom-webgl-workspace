import { useLayoutEffect, useState } from "react";
import {
  createLenisGsapScrollStack,
  type LenisGsapScrollStack,
} from "@project/dom-webgl-scroll-adapters";
import gsap from "gsap";
import Lenis from "lenis";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import "lenis/dist/lenis.css";

gsap.registerPlugin(ScrollTrigger);

export function useDemoSmoothScrollStack(): LenisGsapScrollStack | null {
  const [smoothScroll, setSmoothScroll] = useState<LenisGsapScrollStack | null>(null);

  useLayoutEffect(() => {
    const lenis = new Lenis({
      autoRaf: false,
      lerp: 0.055,
      smoothWheel: true,
      touchMultiplier: 1,
      wheelMultiplier: 0.85,
    });
    const smoothScrollStack = createLenisGsapScrollStack({
      lenis,
      gsap,
      ScrollTrigger,
      getViewportHeight: () => window.innerHeight,
      manageLenis: false,
    });

    setSmoothScroll(smoothScrollStack);

    return () => {
      setSmoothScroll((currentSmoothScroll) =>
        currentSmoothScroll === smoothScrollStack ? null : currentSmoothScroll,
      );
      smoothScrollStack.dispose();
      lenis.destroy();
    };
  }, []);

  return smoothScroll;
}
