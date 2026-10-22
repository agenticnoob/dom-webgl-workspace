/** One rendered frame. Renderer counters describe the previous render call. */
export type BenchFrameSample = {
  readonly deltaMs: number;
  readonly chapter: number;
  readonly calls: number;
  readonly triangles: number;
  readonly programs: number;
  readonly textures: number;
  readonly geometries: number;
};

export type BenchSummaryRow = {
  readonly label: string;
  readonly frames: number;
  readonly seconds: number;
  readonly fps: number;
  readonly p50Ms: number;
  readonly p95Ms: number;
  readonly maxMs: number;
  /** Frames slower than `longFrameMs`. */
  readonly longFrames: number;
  readonly maxCalls: number;
  readonly maxTriangles: number;
  /** Shader programs created while this chapter was current. */
  readonly programsAdded: number;
  /** GPU textures allocated while this chapter was current. */
  readonly texturesAdded: number;
  /** Long frames that also created a program or texture: compile/upload stalls. */
  readonly stallFrames: number;
  readonly longTasks: number;
};

export type BenchSummary = {
  readonly overall: BenchSummaryRow;
  readonly chapters: readonly BenchSummaryRow[];
};

export const longFrameMs = 50;

export type BenchRecorder = ReturnType<typeof createBenchRecorder>;

export function createBenchRecorder() {
  let samples: BenchFrameSample[] = [];
  let longTasks: Array<{ chapter: number; durationMs: number }> = [];

  return {
    record(sample: BenchFrameSample) {
      samples.push(sample);
    },
    longTask(chapter: number, durationMs: number) {
      longTasks.push({ chapter, durationMs });
    },
    get frameCount() {
      return samples.length;
    },
    reset() {
      samples = [];
      longTasks = [];
    },
    summarize(labels: readonly string[]): BenchSummary {
      const grown = attributeGrowth(samples);
      return {
        overall: summarizeRows(
          "overall",
          samples,
          grown,
          longTasks.length,
        ),
        chapters: labels.map((label, chapter) => {
          const indices = samples.flatMap((sample, index) =>
            sample.chapter === chapter ? [index] : [],
          );
          return summarizeRows(
            label,
            indices.map((index) => samples[index]),
            indices.map((index) => grown[index]),
            longTasks.filter((task) => task.chapter === chapter).length,
          );
        }),
      };
    },
  };
}

type Growth = { readonly programs: number; readonly textures: number };

// Counter increases are charged to the frame that observed them.
function attributeGrowth(samples: readonly BenchFrameSample[]): Growth[] {
  return samples.map((sample, index) => {
    const previous = samples[index - 1];
    if (!previous) return { programs: 0, textures: 0 };
    return {
      programs: Math.max(0, sample.programs - previous.programs),
      textures: Math.max(0, sample.textures - previous.textures),
    };
  });
}

function summarizeRows(
  label: string,
  samples: readonly BenchFrameSample[],
  growth: readonly Growth[],
  longTasks: number,
): BenchSummaryRow {
  const deltas = samples.map((sample) => sample.deltaMs);
  const totalMs = deltas.reduce((sum, value) => sum + value, 0);
  return {
    label,
    frames: samples.length,
    seconds: round(totalMs / 1000, 2),
    fps: totalMs > 0 ? round((samples.length * 1000) / totalMs, 1) : 0,
    p50Ms: round(percentile(deltas, 0.5), 1),
    p95Ms: round(percentile(deltas, 0.95), 1),
    maxMs: round(Math.max(0, ...deltas), 1),
    longFrames: deltas.filter((value) => value > longFrameMs).length,
    maxCalls: Math.max(0, ...samples.map((sample) => sample.calls)),
    maxTriangles: Math.max(0, ...samples.map((sample) => sample.triangles)),
    programsAdded: growth.reduce((sum, value) => sum + value.programs, 0),
    texturesAdded: growth.reduce((sum, value) => sum + value.textures, 0),
    stallFrames: samples.filter(
      (sample, index) =>
        sample.deltaMs > longFrameMs &&
        growth[index].programs + growth[index].textures > 0,
    ).length,
    longTasks,
  };
}

/** Nearest-rank percentile; 0 for an empty list. */
export function percentile(values: readonly number[], fraction: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil(fraction * sorted.length) - 1;
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank))];
}

function round(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
