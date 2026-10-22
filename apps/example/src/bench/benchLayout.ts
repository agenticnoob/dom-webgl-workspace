import type { WebGLScrollMetrics } from "@viselora/dom-webgl";

export const benchChapters = [
  { key: "model", title: "动画模型", copy: "259 个网格、24 张贴图的 GLB，全部动画持续播放，旁边是一颗透射玻璃球。" },
  { key: "particles", title: "粒子场", copy: "10 万个点，在顶点着色器里逐帧计算噪声位移，叠加混合。" },
  { key: "text", title: "流动的文字", copy: "这一行标题被绘制成 DOM 文字纹理，在 3D 空间里随波起伏。" },
  { key: "sequence", title: "图片序列", copy: "114 帧 1600×900 序列帧，按滚动进度切换，每帧重新上传纹理。" },
  { key: "cards", title: "卡片墙", copy: "12 张带贴图的物理材质卡片，其中一张播放视频。" },
  { key: "raymarch", title: "光线步进", copy: "全屏片元着色器，每个像素 96 步光线步进叠加分形噪声。" },
] as const;

export const benchChapterCount = benchChapters.length;
/** World-space distance between consecutive chapters along the camera rail. */
export const benchChapterSpacing = 30;
/** Distance from the camera to the chapter it is passing. */
export const benchViewDistance = 12;

export type BenchVariant = "naive";
export type BenchGpu = "default" | "low-power" | "high-performance";

export type BenchOptions = {
  readonly variant: BenchVariant;
  readonly gpu: BenchGpu;
  readonly maxDpr: number;
  readonly autoplay: boolean;
  readonly durationSeconds: number;
};

export function readBenchOptions(search: string): BenchOptions {
  const params = new URLSearchParams(search);
  const gpu = params.get("gpu");
  const maxDpr = Number(params.get("maxDpr") ?? 2);
  const duration = Number(params.get("duration") ?? 60);
  return {
    variant: "naive",
    gpu: gpu === "low-power" || gpu === "high-performance" ? gpu : "default",
    maxDpr: Number.isFinite(maxDpr) ? Math.min(3, Math.max(0.5, maxDpr)) : 2,
    autoplay: params.get("autoplay") === "1",
    durationSeconds: Number.isFinite(duration)
      ? Math.min(600, Math.max(5, duration))
      : 60,
  };
}

/** Whole-page scroll progress, 0 at the top and 1 at the bottom. */
export function benchProgress(metrics: WebGLScrollMetrics) {
  const range = metrics.scrollHeight - metrics.viewportHeight;
  return range > 0 ? clamp01(metrics.scrollY / range) : 0;
}

/** Position inside chapter `index`: 0 when it starts, 1 when it ends. */
export function chapterLocal(progress: number, index: number) {
  return progress * benchChapterCount - index;
}

export function currentChapter(progress: number) {
  return Math.min(
    benchChapterCount - 1,
    Math.max(0, Math.floor(progress * benchChapterCount)),
  );
}

/** Fade weight of chapter `index`; neighbouring chapters overlap briefly. */
export function chapterWeight(progress: number, index: number) {
  const local = chapterLocal(progress, index);
  const fadeIn = index === 0 ? 1 : smoothstep(-0.15, 0.1, local);
  const fadeOut =
    index === benchChapterCount - 1 ? 1 : 1 - smoothstep(0.9, 1.15, local);
  return fadeIn * fadeOut;
}

export function chapterZ(index: number) {
  return -benchChapterSpacing * index;
}

/** The camera reaches each chapter's view distance halfway through it. */
export function cameraZ(progress: number) {
  return (
    benchViewDistance -
    benchChapterSpacing * (progress * benchChapterCount - 0.5)
  );
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}
