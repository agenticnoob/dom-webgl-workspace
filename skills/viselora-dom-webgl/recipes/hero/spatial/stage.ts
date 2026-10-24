import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useScrollEffectProgressStore } from "@viselora/scroll-adapters/react";
import { useRuntimeReady } from "../shared/useRuntimeReady";
import {
  resolvePortalGeometryFrame,
  type PortalGeometryFrame,
} from "./geometry";
import { spatialBaseRotation } from "./config";
import type { FaceIndex, SpatialViewport } from "./types";
import { clampProgress } from "./math";
import {
  createHoldState,
  resolvePortalFrame,
  type HoldState,
  type PortalFrame,
} from "./frame";

export type SpatialStage = {
  viewport: SpatialViewport;
  frame: PortalFrame;
  tails: readonly number[];
  reducedMotion: boolean;
  visible: boolean;
  hold: HoldState;
  keyboardToggle: boolean;
  ready: boolean;
  pointerLeft: number;
  pointerTop: number;
  transform: PortalGeometryFrame;
  publishReady(ready: boolean): void;
  publishScheme(scheme: 0 | 1): void;
};

export function createSpatialStage(
  publishReady: SpatialStage["publishReady"],
  publishScheme: SpatialStage["publishScheme"],
): SpatialStage {
  return {
    viewport: {
      width: 1,
      height: 1,
      left: 0,
      top: 0,
      windowWidth: 1,
      windowHeight: 1,
    },
    frame: resolvePortalFrame(0, 0),
    tails: [0, 0, 0, 0],
    reducedMotion: false,
    visible: false,
    hold: createHoldState(),
    keyboardToggle: false,
    ready: false,
    pointerLeft: 0,
    pointerTop: 0,
    transform: resolvePortalGeometryFrame(
      { width: 1, height: 1, left: 0, top: 0, windowWidth: 1, windowHeight: 1 },
      resolvePortalFrame(0, 0),
      spatialBaseRotation,
    ),
    publishReady,
    publishScheme,
  };
}

export function useSpatialStage(id: string, portal: boolean) {
  const runtimeReady = useRuntimeReady();
  const root = useRef<HTMLElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [scheme, setScheme] = useState<0 | 1>(0);
  const [size, setSize] = useState({ width: 1, height: 1 });
  const stage = useMemo(() => createSpatialStage(setReady, setScheme), []);
  const progress = useScrollEffectProgressStore();

  useEffect(() => {
    const element = root.current;
    const view = viewport.current;
    if (!element || !view) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let disposed = false;
    const update = () => {
      frame = 0;
      if (disposed) return;
      const rect = view.getBoundingClientRect();
      setSize((current) =>
        current.width === rect.width && current.height === rect.height
          ? current
          : {
              width: Math.max(1, rect.width),
              height: Math.max(1, rect.height),
            },
      );
      // Runtime pointer coordinates use the fixed viewport canvas, not its scrolling host.
      stage.pointerLeft = rect.left;
      stage.pointerTop = rect.top;
      stage.viewport = {
        width: Math.max(1, rect.width),
        height: Math.max(1, rect.height),
        left: rect.left,
        top: rect.top,
        windowWidth: innerWidth,
        windowHeight: innerHeight,
      };
      stage.reducedMotion = motion.matches;
      stage.visible =
        rect.bottom > 0 &&
        rect.top < innerHeight &&
        rect.right > 0 &&
        rect.left < innerWidth;
      if (!portal) return;
      const cycles = Array.from(
        element.querySelectorAll<HTMLElement>("[data-spatial-cycle]"),
      );
      const samples = cycles.map((cycle, index) => {
        const entry = cycle.querySelector<HTMLElement>("[data-spatial-entry]");
        const body = cycle.querySelector<HTMLElement>("[data-spatial-body]");
        const exit = cycle.querySelector<HTMLElement>("[data-spatial-exit]");
        if (!entry || !body || !exit)
          throw new Error(
            "FacePortal cycle is missing its entry, body or exit region.",
          );
        const entryRect = entry.getBoundingClientRect();
        const bodyRect = body.getBoundingClientRect();
        const exitRect = exit.getBoundingClientRect();
        const entryProgress = clampProgress(
          -entryRect.top / Math.max(1, entryRect.height),
        );
        // Return starts precisely when the last DOM panel fills the viewport.
        const exitProgress = clampProgress(
          (innerHeight - exitRect.top) / Math.max(1, exitRect.height),
        );
        const bodyProgress = clampProgress(
          -bodyRect.top / Math.max(1, bodyRect.height - innerHeight),
        );
        progress.set(`${id}.${index}.entry`, entryProgress);
        progress.set(`${id}.${index}.body`, bodyProgress);
        progress.set(`${id}.${index}.exit`, exitProgress);
        return { entry: entryProgress, exit: exitProgress };
      });
      let active: FaceIndex = 0;
      for (const candidate of [0, 1, 2, 3] as const) {
        if ((samples[candidate]?.entry ?? 0) > 0) active = candidate;
      }
      const sample = samples[active];
      stage.frame = resolvePortalFrame(
        sample?.entry ?? 0,
        sample?.exit ?? 0,
        active,
      );
      stage.tails = samples.map((sample) => (sample.exit > 0 ? 1 : 0));
      for (let index = 0; index < cycles.length; index++) {
        const cycle = cycles[index];
        const isActive = index === active && stage.frame.domContentActive;
        cycle.dataset.active = String(isActive);
      }
    };
    const schedule = () => {
      if (!disposed && !frame) frame = requestAnimationFrame(update);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(element);
    observer.observe(view);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    motion.addEventListener("change", schedule);
    update();
    return () => {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      motion.removeEventListener("change", schedule);
      stage.visible = false;
      if (portal) {
        for (const index of [0, 1, 2, 3]) {
          for (const phase of ["entry", "body", "exit"]) {
            progress.clear(`${id}.${index}.${phase}`);
          }
        }
      }
    };
  }, [id, portal, progress, stage]);
  return { root, viewport, stage, ready: ready && runtimeReady, scheme, size };
}

export type SpatialStageRef = RefObject<HTMLDivElement | null>;
