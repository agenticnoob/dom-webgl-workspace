import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useRef } from "react";

export function readHoverOpacity(
  time: number,
  hovered: boolean,
  clickUntil: number,
  base = 0.72,
  hover = 0.9,
): number {
  return time < clickUntil ? 1 : hovered ? hover : base;
}

export function readKinematicSweep(timeSeconds: number): {
  x: number;
  y: number;
  z: number;
} {
  return { x: 2.52 + Math.sin(timeSeconds * 2.4) * 0.96, y: -1.32, z: -0.7 };
}

/** Native mesh events and frame mutation keep hover independent of React renders. */
export function useHoverPulse(
  apply: (opacity: number) => void,
  base: number,
  hover: number,
) {
  const clock = useThree((state) => state.clock);
  const state = useRef({ hovered: false, clickUntil: 0 });
  useFrame(() =>
    apply(
      readHoverOpacity(
        clock.elapsedTime,
        state.current.hovered,
        state.current.clickUntil,
        base,
        hover,
      ),
    ),
  );
  return {
    onPointerOver(event: ThreeEvent<PointerEvent>) {
      event.stopPropagation();
      state.current.hovered = true;
    },
    onPointerOut() {
      state.current.hovered = false;
    },
    onClick(event: ThreeEvent<MouseEvent>) {
      event.stopPropagation();
      state.current.clickUntil = clock.elapsedTime + 0.26;
    },
  };
}
