import type { WebGLScrollMetrics } from "@viselora/dom-webgl";

import {
  benchChapters,
  benchProgress,
  currentChapter,
  type BenchOptions,
} from "./benchLayout";
import {
  createBenchRecorder,
  percentile,
  type BenchFrameSample,
  type BenchSummary,
} from "./benchStats";

export const benchAssets = ["model", "text", "sequence", "cards"] as const;
export type BenchAsset = (typeof benchAssets)[number];

/** Sections mount later chapters only on approach, so only the first must load. */
export function requiredBenchAssets(
  variant: BenchOptions["variant"],
): readonly BenchAsset[] {
  switch (variant) {
    case "naive":
      return benchAssets;
    case "sections":
    case "managed":
      return ["model"];
  }
}

export type BenchPhase = "loading" | "ready" | "running" | "done";

export type BenchFrameInput = Omit<BenchFrameSample, "chapter"> & {
  readonly dpr: number;
  readonly tier: string;
};

export type BenchLiveStats = {
  readonly fps: number;
  readonly p95Ms: number;
  readonly calls: number;
  readonly triangles: number;
  readonly programs: number;
  readonly textures: number;
  readonly dpr: number;
  readonly tier: string;
  readonly chapter: number;
};

export type BenchResult = {
  readonly variant: BenchOptions["variant"];
  readonly gpuPreference: BenchOptions["gpu"];
  readonly renderer: string;
  readonly maxDpr: number;
  readonly dpr: number;
  /** Render quality tier at the end of the run. */
  readonly tier: string;
  /** Tier changes during the run, as `seconds:tier`. */
  readonly tierChanges: readonly string[];
  readonly devicePixelRatio: number;
  readonly viewport: { readonly width: number; readonly height: number };
  readonly userAgent: string;
  readonly durationSeconds: number;
  /** True when the run started before every asset reported ready. */
  readonly assetsTimedOut: boolean;
  readonly summary: BenchSummary;
};

export type BenchSnapshot = {
  readonly phase: BenchPhase;
  readonly loadedAssets: number;
  readonly totalAssets: number;
  readonly renderer: string;
  readonly live: BenchLiveStats;
  readonly result?: BenchResult;
};

export type BenchController = ReturnType<typeof createBenchController>;

/** What a measured page reports: its chapters and the assets a run waits for. */
export type BenchPageConfig = {
  readonly chapters: readonly string[];
  /** Chapter index for a page progress value. */
  chapterAt(progress: number): number;
  readonly requiredAssets: readonly string[];
};

export function oneTakeBenchConfig(variant: BenchOptions["variant"]): BenchPageConfig {
  return {
    chapters: benchChapters.map((chapter) => chapter.key),
    chapterAt: currentChapter,
    requiredAssets: requiredBenchAssets(variant),
  };
}

const liveWindow = 120;

export function createBenchController(
  options: BenchOptions,
  config: BenchPageConfig = oneTakeBenchConfig(options.variant),
) {
  const recorder = createBenchRecorder();
  const required = config.requiredAssets;
  const loaded = new Set<string>();
  const recent: number[] = [];
  // A page without required assets is ready as soon as it mounts.
  let phase: BenchPhase = required.length === 0 ? "ready" : "loading";
  let renderer = "unknown";
  let assetsTimedOut = false;
  let run: { startedAt: number; durationMs: number } | undefined;
  let tierChanges: string[] = [];
  let result: BenchResult | undefined;
  let live: BenchLiveStats = {
    fps: 0,
    p95Ms: 0,
    calls: 0,
    triangles: 0,
    programs: 0,
    textures: 0,
    dpr: 1,
    tier: "high",
    chapter: 0,
  };

  function finish() {
    if (!run) return;
    result = {
      variant: options.variant,
      gpuPreference: options.gpu,
      renderer,
      maxDpr: options.maxDpr,
      dpr: live.dpr,
      tier: live.tier,
      tierChanges,
      devicePixelRatio: window.devicePixelRatio,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      userAgent: navigator.userAgent,
      durationSeconds: run.durationMs / 1000,
      assetsTimedOut,
      summary: recorder.summarize(config.chapters),
    };
    run = undefined;
    phase = "done";
  }

  return {
    snapshot(): BenchSnapshot {
      return {
        phase,
        loadedAssets: required.filter((asset) => loaded.has(asset)).length,
        totalAssets: required.length,
        renderer,
        live,
        ...(result ? { result } : {}),
      };
    },
    chapters: config.chapters,
    assetReady(asset: string) {
      loaded.add(asset);
      if (phase === "loading" && required.every((item) => loaded.has(item)))
        phase = "ready";
    },
    /** Allows a run on a device that cannot load every asset in time. */
    assetTimeout() {
      if (phase !== "loading") return;
      assetsTimedOut = true;
      phase = "ready";
    },
    setRenderer(name: string) {
      renderer = name;
    },
    start(durationSeconds = options.durationSeconds) {
      if (phase !== "ready" && phase !== "done") return false;
      recorder.reset();
      result = undefined;
      tierChanges = [];
      window.scrollTo(0, 0);
      run = { startedAt: performance.now(), durationMs: durationSeconds * 1000 };
      phase = "running";
      return true;
    },
    /** Called once per R3F frame; drives the scripted scroll while running. */
    frame(sample: BenchFrameInput, scroll: WebGLScrollMetrics) {
      const chapter = config.chapterAt(benchProgress(scroll));
      const previousTier = live.tier;
      recent.push(sample.deltaMs);
      if (recent.length > liveWindow) recent.shift();
      const totalMs = recent.reduce((sum, value) => sum + value, 0);
      live = {
        fps: totalMs > 0 ? Math.round((recent.length * 1000) / totalMs) : 0,
        p95Ms: Math.round(percentile(recent, 0.95) * 10) / 10,
        calls: sample.calls,
        triangles: sample.triangles,
        programs: sample.programs,
        textures: sample.textures,
        dpr: sample.dpr,
        tier: sample.tier,
        chapter,
      };
      if (!run) return;
      if (sample.tier !== previousTier) {
        const seconds = (performance.now() - run.startedAt) / 1000;
        tierChanges.push(`${seconds.toFixed(1)}:${sample.tier}`);
      }
      const { dpr: _dpr, tier: _tier, ...frame } = sample;
      recorder.record({ ...frame, chapter });
      const fraction = Math.min(
        1,
        (performance.now() - run.startedAt) / run.durationMs,
      );
      window.scrollTo(0, fraction * (scroll.scrollHeight - scroll.viewportHeight));
      if (fraction >= 1) finish();
    },
    longTask(durationMs: number, scroll: WebGLScrollMetrics) {
      if (run)
        recorder.longTask(config.chapterAt(benchProgress(scroll)), durationMs);
    },
  };
}
