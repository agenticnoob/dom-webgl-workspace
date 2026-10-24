import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useScrollEffectProgressStore } from "@viselora/scroll-adapters/react";
import { useRuntimeReady } from "../shared/useRuntimeReady";
import { createTimelineController } from "./controller";
import { TimelineScene } from "./TimelineScene";
import {
  createTimelinePanels,
  timelineConfig,
  timelineTravel,
  type PerspectiveTimelineEntry,
} from "./track";
import type { TimelineStageState } from "./effects";
import "./perspective-timeline.css";

export type PerspectiveTimelineProps = {
  /** Runtime-unique ID. Remount with a new React key to replace the data/identity. */
  readonly id: string;
  readonly title: string;
  readonly description: string;
  /** Caller order is preserved. Labels may be dates, milestones or version names. */
  readonly entries: readonly PerspectiveTimelineEntry[];
  readonly labels: {
    readonly read: string;
    readonly resume: string;
    readonly empty: string;
  };
  readonly className?: string;
};

/** A single-page recipe rendered through the existing host's View.Port. */
export function PerspectiveTimeline(props: PerspectiveTimelineProps) {
  const [content] = useState(() => {
    if (!props.id.trim())
      throw new Error(
        "PerspectiveTimeline needs a nonempty, runtime-unique id.",
      );
    const ids = new Set<string>();
    for (const entry of props.entries) {
      if (!entry.id.trim() || ids.has(entry.id))
        throw new Error(
          "PerspectiveTimeline entries need nonempty, unique ids.",
        );
      ids.add(entry.id);
    }
    return props;
  });
  const { id, title, description, entries, labels, className } = content;
  const root = useRef<HTMLElement>(null);
  const view = useRef<HTMLDivElement>(null);
  const store = useScrollEffectProgressStore();
  const runtimeReady = useRuntimeReady();
  const layout = useTimelineLayout(root);
  const [read, setRead] = useState(false);
  const [ready, setReady] = useState(false);
  const spatial = !layout.reading && !read && entries.length > 0;
  const enhanced = spatial && ready && runtimeReady;
  const progressKey = `${id}.travel`;
  const [stage] = useState<TimelineStageState>(() => ({
    visible: false,
    viewport: { width: 1, height: 1 },
  }));
  const panels = useMemo(
    () => createTimelinePanels(entries, layout),
    [entries, layout],
  );
  const distance =
    (timelineTravel(1, panels) - timelineTravel(0, panels)) *
    timelineConfig.scrollPerUnit;
  useEffect(() => {
    if (!spatial || !root.current || !view.current) return;
    const controller = createTimelineController({
      root: root.current,
      view: view.current,
      stage,
      progressKey,
      store,
    });
    return () => controller.dispose();
  }, [spatial, enhanced, stage, progressKey, store, panels]);
  function toggleReading() {
    setRead((value) => !value);
    root.current?.scrollIntoView({ behavior: "instant", block: "start" });
  }
  return (
    <section
      ref={root}
      className={`perspective-timeline${className ? ` ${className}` : ""}`}
      data-spatial={enhanced}
      aria-labelledby={`${id}.title`}
      style={
        { "--timeline-distance": `${(1 + distance) * 100}svh` } as CSSProperties
      }
    >
      <div className="perspective-timeline__stage" ref={view}>
        <header className="perspective-timeline__header">
          <div>
            <h2 id={`${id}.title`}>{title}</h2>
            <p>{description}</p>
          </div>
          {!layout.reading && entries.length > 0 && (
            <button type="button" aria-pressed={read} onClick={toggleReading}>
              {read ? labels.resume : labels.read}
            </button>
          )}
        </header>
        {spatial && (
          <div id={`${id}.viewport`} className="perspective-timeline__viewport">
            <TimelineScene
              key={`${layout.width}:${layout.height}`}
              id={id}
              progressKey={progressKey}
              stage={stage}
              panels={panels}
              viewport={layout}
              progress={store.source}
              onReady={setReady}
            />
          </div>
        )}
      </div>
      <div className="perspective-timeline__transcript">
        {entries.length ? (
          entries.map((entry) => (
            <article key={entry.id} data-timeline-entry={entry.id}>
              <h3>{entry.label}</h3>
              <p className="perspective-timeline__metadata">{entry.meta}</p>
              <p>{entry.body}</p>
            </article>
          ))
        ) : (
          <p role="status">{labels.empty}</p>
        )}
      </div>
    </section>
  );
}

function useTimelineLayout(root: React.RefObject<HTMLElement | null>) {
  const [layout, setLayout] = useState({
    width: 1440,
    height: 900,
    reading: true,
  });
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const preference = window.matchMedia(
      "(prefers-reduced-motion: reduce), (pointer: coarse)",
    );
    const update = () => {
      const width = Math.max(1, element.clientWidth);
      const height = Math.max(1, window.innerHeight);
      const reading = width < 900 || height < 560 || preference.matches;
      setLayout((current) =>
        current.width === width &&
        current.height === height &&
        current.reading === reading
          ? current
          : { width, height, reading },
      );
    };
    const observer = new ResizeObserver(update);
    observer.observe(element);
    window.addEventListener("resize", update, { passive: true });
    preference.addEventListener("change", update);
    update();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      preference.removeEventListener("change", update);
    };
  }, [root]);
  return layout;
}
