import type { WebGLProgressSignalSource } from "@viselora/dom-webgl";
import {
  WebGLRuntime,
  WebGLTarget,
  type WebGLRuntimeProps,
} from "@viselora/dom-webgl/react";
import { useEffect, useMemo, useState } from "react";

import {
  createBenchController,
  type BenchController,
  type BenchResult,
  type BenchSnapshot,
} from "./benchController";
import { benchTitleTargetId } from "./benchChapters";
import { BenchScene } from "./BenchScene";
import {
  benchChapters,
  benchProgress,
  benchProgressKey,
  cameraZ,
  type BenchOptions,
} from "./benchLayout";

declare global {
  interface Window {
    /** Automation hook used by `scripts/bench-one-take.mjs`. */
    __vbench?: {
      snapshot(): BenchSnapshot;
      start(durationSeconds?: number): boolean;
    };
  }
}

const assetTimeoutMs = 45_000;
const autoplaySettleMs = 3_000;

export function BenchApp({ options }: { readonly options: BenchOptions }) {
  const [controller] = useState(() => createBenchController(options));
  const canvas = useMemo(
    (): NonNullable<WebGLRuntimeProps["canvas"]> => ({
      camera: { fov: 50, near: 0.1, far: 400, position: [0, 0, cameraZ(0)] },
      dpr: options.maxDpr,
      gl: { alpha: true, antialias: false, powerPreference: options.gpu },
    }),
    [options],
  );

  // Page progress as a signal, so sections can use progress ranges.
  const progressSignals = useMemo(
    (): WebGLProgressSignalSource => ({
      get: (key) =>
        key === benchProgressKey
          ? benchProgress({
              scrollY: window.scrollY,
              scrollHeight: document.documentElement.scrollHeight,
              viewportHeight: window.innerHeight,
            })
          : 0,
    }),
    [],
  );

  useEffect(() => {
    window.__vbench = {
      snapshot: () => controller.snapshot(),
      start: (durationSeconds) => controller.start(durationSeconds),
    };
    const timeout = window.setTimeout(
      () => controller.assetTimeout(),
      assetTimeoutMs,
    );
    return () => {
      window.clearTimeout(timeout);
      delete window.__vbench;
    };
  }, [controller]);

  useEffect(() => {
    if (!options.autoplay) return;
    let settle: number | undefined;
    const poll = window.setInterval(() => {
      if (settle !== undefined || controller.snapshot().phase !== "ready")
        return;
      settle = window.setTimeout(() => controller.start(), autoplaySettleMs);
    }, 250);
    return () => {
      window.clearInterval(poll);
      window.clearTimeout(settle);
    };
  }, [controller, options.autoplay]);

  return (
    <WebGLRuntime
      className="bench-runtime"
      canvas={canvas}
      progressSignals={progressSignals}
      quality={options.variant === "managed" ? undefined : false}
      scene={<BenchScene controller={controller} variant={options.variant} />}
    >
      <BenchPage />
      <BenchOverlay controller={controller} />
    </WebGLRuntime>
  );
}

function BenchPage() {
  return (
    <main className="bench-page">
      {benchChapters.map((chapter, index) => (
        <section className="bench-chapter" key={chapter.key}>
          <div className="bench-chapter__copy">
            <p className="bench-chapter__index">
              {String(index + 1).padStart(2, "0")} / {chapter.key}
            </p>
            {chapter.key === "text" ? (
              <WebGLTarget id={benchTitleTargetId}>
                <h2 className="bench-chapter__title">{chapter.title}</h2>
              </WebGLTarget>
            ) : (
              <h2 className="bench-chapter__title">{chapter.title}</h2>
            )}
            <p className="bench-chapter__text">{chapter.copy}</p>
          </div>
        </section>
      ))}
      <section className="bench-end">
        <p>基准结束</p>
      </section>
    </main>
  );
}

const phaseLabels = {
  loading: "加载资源",
  ready: "就绪",
  running: "测试中",
  done: "完成",
} satisfies Record<BenchSnapshot["phase"], string>;

function BenchOverlay({ controller }: { readonly controller: BenchController }) {
  const [snapshot, setSnapshot] = useState(() => controller.snapshot());
  useEffect(() => {
    const poll = window.setInterval(() => setSnapshot(controller.snapshot()), 250);
    return () => window.clearInterval(poll);
  }, [controller]);
  const { live, phase, result } = snapshot;
  const busy = phase === "loading" || phase === "running";

  return (
    <aside className="bench-overlay" aria-label="性能基准">
      <header className="bench-overlay__header">
        <strong>一镜到底基准</strong>
        <span>
          {phaseLabels[phase]}
          {phase === "loading"
            ? ` ${snapshot.loadedAssets}/${snapshot.totalAssets}`
            : ""}
        </span>
      </header>
      <dl className="bench-overlay__stats">
        <dt>FPS</dt>
        <dd>{live.fps}</dd>
        <dt>p95</dt>
        <dd>{live.p95Ms} ms</dd>
        <dt>draw calls</dt>
        <dd>{live.calls}</dd>
        <dt>三角形</dt>
        <dd>{live.triangles.toLocaleString()}</dd>
        <dt>程序 / 纹理</dt>
        <dd>
          {live.programs} / {live.textures}
        </dd>
        <dt>DPR / 档位</dt>
        <dd>
          {live.dpr} / {live.tier}
        </dd>
        <dt>章节</dt>
        <dd>{benchChapters[live.chapter].key}</dd>
      </dl>
      <p className="bench-overlay__renderer">{snapshot.renderer}</p>
      <button
        type="button"
        className="bench-overlay__button"
        disabled={busy}
        onClick={() => controller.start()}
      >
        {phase === "done" ? "重新测试" : "开始测试"}
      </button>
      {result ? <BenchResultTable result={result} /> : null}
    </aside>
  );
}

function BenchResultTable({ result }: { readonly result: BenchResult }) {
  const rows = [result.summary.overall, ...result.summary.chapters];
  return (
    <div className="bench-overlay__result">
      <table>
        <thead>
          <tr>
            <th scope="col">段</th>
            <th scope="col">fps</th>
            <th scope="col">p95</th>
            <th scope="col">最长</th>
            <th scope="col">长帧</th>
            <th scope="col">新程序</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              <td>{row.fps}</td>
              <td>{row.p95Ms}</td>
              <td>{row.maxMs}</td>
              <td>{row.longFrames}</td>
              <td>{row.programsAdded}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <details>
        <summary>完整结果（JSON）</summary>
        <textarea readOnly rows={6} value={JSON.stringify(result)} />
      </details>
    </div>
  );
}
