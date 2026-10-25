import type { RuntimeDebugState } from "@viselora/dom-webgl";
import { useState, useSyncExternalStore } from "react";

/**
 * The runtime's debug state, republished at most every `intervalMs` so the
 * readout re-renders a few times a second instead of with every report.
 */
export type RuntimeFeed = {
  get(): RuntimeDebugState | undefined;
  push(state: RuntimeDebugState, now: number): void;
  subscribe(listener: () => void): () => void;
};

export function createRuntimeFeed(intervalMs = 500): RuntimeFeed {
  let current: RuntimeDebugState | undefined;
  let last = -Infinity;
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    push(state, now) {
      if (now - last < intervalMs) return;
      last = now;
      current = state;
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

type Phase = RuntimeDebugState["sections"][number]["phase"];

const phaseLabel = { active: "绘制中", warm: "预热", sleep: "休眠" } satisfies Record<Phase, string>;

export function summarizeSections(state: RuntimeDebugState | undefined) {
  const counts = { active: 0, warm: 0, sleep: 0 } satisfies Record<Phase, number>;
  for (const section of state?.sections ?? []) counts[section.phase] += 1;
  return counts;
}

function useFeed(feed: RuntimeFeed) {
  return useSyncExternalStore(feed.subscribe, feed.get, () => undefined);
}

/** The phase of one named section on this page, as the runtime reports it. */
export function SectionChip({ feed, name }: { readonly feed: RuntimeFeed; readonly name: string }) {
  const state = useFeed(feed);
  const phase = state?.sections.find((section) => section.label === name)?.phase;
  return (
    <span className="site-chip" data-phase={phase ?? "none"}>
      <span className="site-chip-dot" aria-hidden="true" />
      <code>{name}</code>
      <span>{phase ? phaseLabel[phase] : "未挂载"}</span>
    </span>
  );
}

/** Fixed readout of this page's own frame rate, tier and sections. */
export function RuntimeReadout({ feed }: { readonly feed: RuntimeFeed }) {
  const state = useFeed(feed);
  const [open, setOpen] = useState(false);
  const frame = state?.frame;
  const counts = summarizeSections(state);
  return (
    <aside className="site-readout" aria-label="本页运行状态" data-open={open}>
      <button
        type="button"
        className="site-readout-bar"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="site-readout-live" aria-hidden="true" />
        <span>{frame ? `${frame.fps} fps` : "— fps"}</span>
        <span className="site-readout-wide">p90 {frame ? `${frame.p90Ms} ms` : "—"}</span>
        <span>{frame?.tier ?? "—"}</span>
        <span className="site-readout-wide">dpr {frame ? frame.dpr.toFixed(2) : "—"}</span>
        <span>
          {counts.active}/{counts.active + counts.warm + counts.sleep} 章节在画
        </span>
      </button>
      {open ? (
        <div className="site-readout-panel">
          <p>
            这是本页自己的运行数据，每秒更新两次。离开视口的章节休眠，不更新也不绘制；接近时预热，先编译着色器、上传纹理。
          </p>
          <ul>
            {(state?.sections ?? []).map((section) => (
              <li key={section.label} data-phase={section.phase}>
                <span className="site-chip-dot" aria-hidden="true" />
                <code>{section.label}</code>
                <span>{phaseLabel[section.phase]}</span>
              </li>
            ))}
          </ul>
          {frame ? (
            <p className="site-readout-cost">
              上一帧 {frame.calls} 次绘制 · {frame.triangles.toLocaleString("zh-CN")} 个三角形 · {frame.programs} 个着色器程序
            </p>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}
