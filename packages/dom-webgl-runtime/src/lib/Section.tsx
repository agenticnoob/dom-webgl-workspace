import { useFrame } from "@react-three/fiber";
import {
  Activity,
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Group } from "three";

import { useWebGLRuntime } from "./Runtime";
import type { RuntimeManager } from "./runtimeManager";
import {
  nextSectionPhase,
  progressSectionMargins,
  rangeDistance,
  targetSectionMargins,
  viewportDistance,
  type SectionMargins,
  type SectionPhase,
} from "./sectionPhase";

export type { SectionPhase } from "./sectionPhase";

export type WebGLSectionProgressRange = {
  /** Progress signal key, read with `runtime.progress.get(key)`. */
  readonly key: string;
  readonly from: number;
  readonly to: number;
};

type SectionTriggerProps =
  | {
      /** A target registered by `WebGLTarget`; distance is in viewport sizes. */
      target: string;
      progress?: never;
      always?: never;
    }
  | {
      /** A progress range; distance is in the signal's own units. */
      progress: WebGLSectionProgressRange;
      target?: never;
      always?: never;
    }
  | {
      /** Never paused; equivalent to not wrapping the content. */
      always: true;
      target?: never;
      progress?: never;
    };

export type WebGLSectionProps = SectionTriggerProps & {
  /** Native R3F/Three.js content of this section. */
  children?: ReactNode;
  /**
   * `"near"` (default) mounts the content the first time the section comes
   * within `warmMargin`; `"eager"` mounts it immediately, still paused.
   */
  mount?: "near" | "eager";
  /**
   * `"keep"` (default) keeps state, refs and memoized resources while asleep;
   * `"release"` unmounts the content when it falls asleep.
   */
  retain?: "keep" | "release";
  /** Largest distance that is drawn (default 0.5 viewports or 0 progress). */
  margin?: number;
  /** Largest distance that stays mounted and updated (default 1.5 or 0.15). */
  warmMargin?: number;
};

export type WebGLSectionState = {
  readonly phase: SectionPhase;
};

const outsideSection: WebGLSectionState = { phase: "active" };
const SectionContext = createContext<WebGLSectionState>(outsideSection);

type SectionTrigger =
  | { readonly kind: "target"; readonly id: string }
  | { readonly kind: "progress"; readonly range: WebGLSectionProgressRange }
  | { readonly kind: "always" };

/**
 * Pauses offscreen content inside the runtime's single Canvas. While `warm`
 * the content updates but is not drawn; while asleep it sits in a hidden
 * React `Activity`, which hides its objects and disconnects its effects and
 * `useFrame` callbacks. Keep lights and the camera rig outside sections.
 */
export function WebGLSection(props: WebGLSectionProps) {
  const runtime = useWebGLRuntime();
  const trigger = readTrigger(props);
  const always = trigger.kind === "always";
  const eager = props.mount === "eager";
  const release = props.retain === "release";
  const [phase, setPhase] = useState<SectionPhase>(
    always ? "active" : "sleep",
  );
  const [approached, setApproached] = useState(always);
  const current = useRef(phase);
  const group = useRef<Group>(null);
  const margins = readMargins(trigger, props.margin, props.warmMargin);

  // Runs after the runtime's measurement (-100), before application frames.
  useFrame((state) => {
    const next = always
      ? "active"
      : nextSectionPhase(
          current.current,
          measureDistance(trigger, runtime, state.size),
          margins,
        );
    if (group.current) group.current.visible = next === "active";
    if (next === current.current) return;
    current.current = next;
    setPhase(next);
    if (next !== "sleep") setApproached(true);
  }, -99);

  const mounted = release
    ? phase !== "sleep" || (eager && !approached)
    : approached || eager;
  const value = useMemo(() => ({ phase }), [phase]);

  return (
    <SectionContext.Provider value={value}>
      <group ref={group}>
        {mounted ? (
          <Activity mode={phase === "sleep" ? "hidden" : "visible"}>
            {props.children}
          </Activity>
        ) : null}
      </group>
    </SectionContext.Provider>
  );
}

/** The surrounding section's phase; `active` outside any `WebGLSection`. */
export function useSectionState(): WebGLSectionState {
  return useContext(SectionContext);
}

function readTrigger(props: SectionTriggerProps): SectionTrigger {
  if (props.always) return { kind: "always" };
  if (props.target !== undefined) return { kind: "target", id: props.target };
  return { kind: "progress", range: props.progress };
}

function readMargins(
  trigger: SectionTrigger,
  margin: number | undefined,
  warmMargin: number | undefined,
): SectionMargins {
  const defaults = defaultMargins(trigger);
  return {
    active: margin ?? defaults.active,
    warm: warmMargin ?? defaults.warm,
    hysteresis: defaults.hysteresis,
  };
}

function defaultMargins(trigger: SectionTrigger): SectionMargins {
  switch (trigger.kind) {
    case "target":
      return targetSectionMargins;
    case "progress":
      return progressSectionMargins;
    case "always":
      return progressSectionMargins;
  }
}

function measureDistance(
  trigger: SectionTrigger,
  runtime: RuntimeManager,
  viewport: { readonly width: number; readonly height: number },
) {
  switch (trigger.kind) {
    case "target": {
      const target = runtime.getTarget(trigger.id);
      return target ? viewportDistance(target.rect, viewport) : undefined;
    }
    case "progress": {
      const { key, from, to } = trigger.range;
      return rangeDistance(runtime.progress.get(key), from, to);
    }
    case "always":
      return 0;
  }
}
