import { useFrame } from "@react-three/fiber";
import {
  Activity,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Group } from "three";

import { useController } from "./Runtime";
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
import { createSectionWarmup } from "./sectionWarmup";

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
  /** Label in debug state and warnings (default: the target or progress range). */
  name?: string;
};

export type WebGLSectionState = {
  readonly phase: SectionPhase;
  /**
   * True once the mounted content's materials are compiled and its loaded
   * textures uploaded. Content that appears later is warmed on later frames.
   */
  readonly warmed: boolean;
};

const outsideSection: WebGLSectionState = { phase: "active", warmed: true };
const SectionContext = createContext<WebGLSectionState>(outsideSection);

type SectionTrigger =
  | { readonly kind: "target"; readonly id: string }
  | { readonly kind: "progress"; readonly range: WebGLSectionProgressRange }
  | { readonly kind: "always" };

/**
 * Pauses offscreen content inside the runtime's single Canvas. While `warm`
 * the content updates but is not drawn; while asleep it sits in a hidden
 * React `Activity`, which hides its objects and disconnects its effects and
 * `useFrame` callbacks. While warm or active, newly mounted materials are
 * compiled and loaded textures uploaded ahead of drawing. Keep lights and the
 * camera rig outside sections: a hidden light changes every lit program.
 */
export function WebGLSection(props: WebGLSectionProps) {
  const controller = useController();
  const runtime = controller.manager;
  const trigger = readTrigger(props);
  const label = props.name ?? describeTrigger(trigger);
  const always = trigger.kind === "always";
  const eager = props.mount === "eager";
  const release = props.retain === "release";
  const [phase, setPhase] = useState<SectionPhase>(
    always ? "active" : "sleep",
  );
  const [approached, setApproached] = useState(always);
  const [warmed, setWarmed] = useState(always);
  const [warmup] = useState(createSectionWarmup);
  const current = useRef(phase);
  const currentWarmed = useRef(warmed);
  const [token] = useState(() => ({}));
  // Program count when the section last became active from warm.
  const entry = useRef<{ programs: number; frames: number } | undefined>(
    undefined,
  );
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
    const root = group.current;
    if (root) root.visible = next === "active";
    // Compile and upload while not yet drawn, so entering does not stall.
    if (root && !always && next !== "sleep") {
      const ready = warmup.step(root, state.gl, state.camera, state.scene);
      if (ready !== currentWarmed.current) {
        currentWarmed.current = ready;
        setWarmed(ready);
      }
    }
    const programs = state.gl.info.programs?.length ?? 0;
    const pending = entry.current;
    if (pending) {
      pending.frames += 1;
      if (programs > pending.programs) {
        entry.current = undefined;
        controller.diagnostics.warn(
          "section-compiled-on-entry",
          label,
          `Section "${label}" compiled ${programs - pending.programs} shader program(s) as it became active, so warmup had not finished. Give it a larger warmMargin or mount it earlier.`,
        );
      } else if (pending.frames > 3) entry.current = undefined;
    }
    if (next === current.current) return;
    if (next === "active" && current.current === "warm")
      entry.current = { programs, frames: 0 };
    current.current = next;
    setPhase(next);
    if (next !== "sleep") setApproached(true);
  }, -99);

  useEffect(() => {
    controller.reportSection(token, { label, phase, warmed });
  }, [controller, token, label, phase, warmed]);
  // After commit the content of a newly woken section is attached.
  useEffect(() => {
    if (phase === "sleep" || always || !group.current) return;
    if (controller.diagnostics.enabled)
      warnAboutLights(group.current, label, controller.diagnostics.warn);
  }, [controller, phase, always, label]);
  useEffect(() => () => controller.removeSection(token), [controller, token]);

  const mounted = release
    ? phase !== "sleep" || (eager && !approached)
    : approached || eager;
  const value = useMemo(() => ({ phase, warmed }), [phase, warmed]);

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

function describeTrigger(trigger: SectionTrigger) {
  switch (trigger.kind) {
    case "target":
      return trigger.id;
    case "progress":
      return `${trigger.range.key} ${trigger.range.from}–${trigger.range.to}`;
    case "always":
      return "always";
  }
}

// Hiding a section hides its lights, which changes every lit program.
function warnAboutLights(
  root: Group,
  label: string,
  warn: (code: "section-contains-lights", subject: string, message: string) => void,
) {
  let lights = 0;
  root.traverse((object) => {
    if ("isLight" in object && object.isLight === true) lights += 1;
  });
  if (lights > 0)
    warn(
      "section-contains-lights",
      label,
      `Section "${label}" contains ${lights} light(s). Hiding the section changes the scene's light count and recompiles every lit material; move lights outside sections or switch them by intensity.`,
    );
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
