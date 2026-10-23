import {
  benchChapterCount,
  benchProgress,
  cameraZ,
  chapterWeight,
  chapterZ,
  currentChapter,
  benchViewDistance,
  readBenchOptions,
} from "../src/bench/benchLayout";
import {
  createBenchRecorder,
  percentile,
  type BenchFrameSample,
} from "../src/bench/benchStats";

const frame = (overrides: Partial<BenchFrameSample>): BenchFrameSample => ({
  deltaMs: 16,
  chapter: 0,
  calls: 10,
  triangles: 1000,
  programs: 4,
  textures: 2,
  geometries: 3,
  ...overrides,
});

describe("benchmark statistics", () => {
  it("uses nearest-rank percentiles", () => {
    expect(percentile([], 0.95)).toBe(0);
    expect(percentile([30, 10, 20, 40], 0.5)).toBe(20);
    expect(percentile([30, 10, 20, 40], 0.95)).toBe(40);
    expect(percentile([5], 0.95)).toBe(5);
  });

  it("summarizes frames overall and per chapter", () => {
    const recorder = createBenchRecorder();
    recorder.record(frame({ deltaMs: 16, chapter: 0, calls: 12 }));
    recorder.record(frame({ deltaMs: 20, chapter: 0, programs: 6 }));
    recorder.record(frame({ deltaMs: 80, chapter: 1, textures: 5, calls: 40 }));
    recorder.record(frame({ deltaMs: 24, chapter: 1, textures: 5 }));
    recorder.longTask(1, 120);

    const summary = recorder.summarize(["a", "b"]);

    expect(summary.overall.frames).toBe(4);
    expect(summary.overall.seconds).toBe(0.14);
    expect(summary.overall.fps).toBe(28.6);
    expect(summary.overall.maxMs).toBe(80);
    expect(summary.overall.longFrames).toBe(1);
    expect(summary.overall.maxCalls).toBe(40);
    expect(summary.overall.longTasks).toBe(1);
    expect(summary.overall.stallFrames).toBe(1);
    expect(summary.chapters[0]).toMatchObject({
      label: "a",
      frames: 2,
      p95Ms: 20,
      programsAdded: 2,
      texturesAdded: 0,
      longTasks: 0,
    });
    expect(summary.chapters[1]).toMatchObject({
      label: "b",
      frames: 2,
      maxMs: 80,
      programsAdded: 0,
      texturesAdded: 3,
      longTasks: 1,
    });
  });

  it("charges counter growth to the frame that observed it", () => {
    const recorder = createBenchRecorder();
    recorder.record(frame({ chapter: 0, programs: 4 }));
    recorder.record(frame({ chapter: 1, programs: 9 }));
    recorder.record(frame({ chapter: 1, programs: 7 }));

    const summary = recorder.summarize(["a", "b"]);

    expect(summary.chapters[0].programsAdded).toBe(0);
    expect(summary.chapters[1].programsAdded).toBe(5);
    expect(summary.overall.programsAdded).toBe(5);
  });

  it("reports empty chapters without NaN", () => {
    const summary = createBenchRecorder().summarize(["a"]);
    expect(summary.chapters[0]).toMatchObject({
      frames: 0,
      fps: 0,
      p95Ms: 0,
      maxMs: 0,
      maxCalls: 0,
    });
  });

  it("forgets samples on reset", () => {
    const recorder = createBenchRecorder();
    recorder.record(frame({}));
    recorder.longTask(0, 60);
    recorder.reset();
    expect(recorder.frameCount).toBe(0);
    expect(recorder.summarize(["a"]).overall.longTasks).toBe(0);
  });
});

describe("benchmark layout", () => {
  it("maps scroll metrics to clamped page progress", () => {
    expect(benchProgress({ scrollY: 0, scrollHeight: 2000, viewportHeight: 1000 })).toBe(0);
    expect(benchProgress({ scrollY: 500, scrollHeight: 2000, viewportHeight: 1000 })).toBe(0.5);
    expect(benchProgress({ scrollY: 5000, scrollHeight: 2000, viewportHeight: 1000 })).toBe(1);
    expect(benchProgress({ scrollY: 0, scrollHeight: 800, viewportHeight: 1000 })).toBe(0);
  });

  it("assigns every progress value to one chapter", () => {
    expect(currentChapter(0)).toBe(0);
    expect(currentChapter(1 / benchChapterCount)).toBe(1);
    expect(currentChapter(0.999)).toBe(benchChapterCount - 1);
    expect(currentChapter(1)).toBe(benchChapterCount - 1);
  });

  it("fades chapters in and out around their own range", () => {
    const middle = (index: number) => (index + 0.5) / benchChapterCount;
    for (let index = 0; index < benchChapterCount; index += 1)
      expect(chapterWeight(middle(index), index)).toBe(1);
    expect(chapterWeight(0, 0)).toBe(1);
    expect(chapterWeight(1, benchChapterCount - 1)).toBe(1);
    expect(chapterWeight(middle(3), 1)).toBe(0);
    expect(chapterWeight(middle(0), 2)).toBe(0);
    const boundary = 2 / benchChapterCount;
    expect(chapterWeight(boundary, 1)).toBeGreaterThan(0);
    expect(chapterWeight(boundary, 2)).toBeGreaterThan(0);
  });

  it("passes each chapter at the view distance halfway through it", () => {
    for (let index = 0; index < benchChapterCount; index += 1) {
      const progress = (index + 0.5) / benchChapterCount;
      expect(cameraZ(progress) - chapterZ(index)).toBeCloseTo(benchViewDistance);
    }
  });

  it("reads and bounds URL options", () => {
    expect(readBenchOptions("")).toEqual({
      variant: "naive",
      diagnostics: false,
      fixture: "none",
      sequence: "every-frame",
      gpu: "default",
      maxDpr: 2,
      autoplay: false,
      durationSeconds: 60,
    });
    expect(
      readBenchOptions("?variant=sections&gpu=low-power&maxDpr=9&autoplay=1&duration=2"),
    ).toEqual({
      variant: "sections",
      diagnostics: false,
      fixture: "none",
      sequence: "every-frame",
      gpu: "low-power",
      maxDpr: 3,
      autoplay: true,
      durationSeconds: 5,
    });
    expect(readBenchOptions("?variant=managed").variant).toBe("managed");
    expect(readBenchOptions("?diagnostics=1&fixture=ready-without-pixels")).toMatchObject({
      diagnostics: true,
      fixture: "ready-without-pixels",
    });
    expect(readBenchOptions("?sequence=bitmap-half").sequence).toBe("bitmap-half");
    expect(readBenchOptions("?sequence=nope").sequence).toBe("every-frame");
    expect(readBenchOptions("?variant=x&gpu=fast&maxDpr=abc&duration=x")).toMatchObject({
      variant: "naive",
      gpu: "default",
      maxDpr: 2,
      durationSeconds: 60,
    });
  });
});
