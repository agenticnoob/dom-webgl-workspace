import { WebGLTarget, type WebGLRuntimeProps } from "@viselora/dom-webgl/react";
import { ScrollEffectSection, WebGLScrollRuntime } from "@viselora/scroll-adapters/react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";

import { BenchOverlay, useBenchAutomation } from "../bench/BenchApp";
import { createBenchController, type BenchController } from "../bench/benchController";
import { type BenchOptions } from "../bench/benchLayout";
import { BenchProbe } from "../bench/BenchScene";
import { exampleSmoothScrollOptions } from "../exampleSmoothScroll";
import { GlassTitle } from "../showcase/GlassTitle";
import { GlyphScatter } from "../showcase/GlyphScatter";
import { InkField, createInkStore, type InkStore } from "../showcase/InkField";

export type SpecimenOptions = BenchOptions & { readonly bench: boolean };

/** Page palette; `paper` and the grid must match `body` in specimen.css. */
const palette = {
  paper: "#e6eaed",
  ink: "#18203a",
  proof: "#d7263d",
  grid: { spacing: 32, color: "#18203a", opacity: 0.09 },
} as const;
const inkOpacity = 0.8;
const progressKey = "specimen";
const chapters = ["title", "glyphs", "specimen", "outro"] as const;

type Range = { readonly key: string; readonly from: number; readonly to: number };
type SpecimenLayout = { readonly starts: readonly number[]; readonly glyphs: Range };

const initialLayout: SpecimenLayout = {
  starts: [0, 0.2, 0.6, 0.9],
  glyphs: { key: progressKey, from: 0.1, to: 0.6 },
};

/**
 * Chapters start where their blocks reach the middle of the viewport. The
 * glyph heading assembles as its block arrives and dissolves before it leaves.
 */
export function measureSpecimenLayout(
  blocks: Readonly<Record<(typeof chapters)[number], { top: number; height: number }>>,
  scrollHeight: number,
  viewportHeight: number,
): SpecimenLayout {
  const scrollable = Math.max(1, scrollHeight - viewportHeight);
  const at = (offset: number) => Math.min(1, Math.max(0, offset / scrollable));
  const glyphs = blocks.glyphs;
  return {
    starts: chapters.map((name, index) =>
      index === 0 ? 0 : at(blocks[name].top - viewportHeight / 2),
    ),
    glyphs: {
      key: progressKey,
      from: at(glyphs.top - viewportHeight * 0.85),
      to: at(glyphs.top + glyphs.height - viewportHeight * 0.75),
    },
  };
}

export function Specimen({ options }: { readonly options: SpecimenOptions }) {
  const [ink] = useState<InkStore>(createInkStore);
  const [layout, setLayout] = useState(initialLayout);
  const latest = useRef(layout);
  useLayoutEffect(() => {
    latest.current = layout;
  }, [layout]);
  const [controller] = useState(() =>
    createBenchController(options, {
      chapters,
      chapterAt: (progress) => {
        let chapter = 0;
        latest.current.starts.forEach((start, index) => {
          if (progress >= start) chapter = index;
        });
        return chapter;
      },
      requiredAssets: [],
    }),
  );
  const canvas = useMemo(
    (): NonNullable<WebGLRuntimeProps["canvas"]> => ({
      camera: { fov: 40, position: [0, 0, 10] },
      dpr: options.maxDpr,
      gl: { alpha: true, antialias: true, powerPreference: options.gpu },
    }),
    [options],
  );
  return (
    <WebGLScrollRuntime
      className="specimen-runtime"
      smooth={exampleSmoothScrollOptions}
      canvas={canvas}
      diagnostics={options.diagnostics || undefined}
      scene={
        <>
          <InkField
            store={ink}
            ink={palette.ink}
            accent={palette.proof}
            opacity={inkOpacity}
          />
          <GlassTitle
            target="specimen-title"
            paper={palette.paper}
            grid={palette.grid}
            ink={{ store: ink, opacity: inkOpacity }}
          />
          <GlyphScatter
            target="specimen-pangram"
            progress={layout.glyphs}
            accent={palette.proof}
          />
          <GlassTitle
            target="specimen-signoff"
            paper={palette.paper}
            grid={palette.grid}
            ink={{ store: ink, opacity: inkOpacity }}
          />
          {options.bench ? <BenchProbe controller={controller} /> : null}
        </>
      }
    >
      <SpecimenPage onLayout={setLayout} />
      {options.bench ? <BenchTools controller={controller} options={options} /> : null}
    </WebGLScrollRuntime>
  );
}

function BenchTools({
  controller,
  options,
}: {
  readonly controller: BenchController;
  readonly options: SpecimenOptions;
}) {
  useBenchAutomation(controller, options.autoplay);
  return <BenchOverlay controller={controller} />;
}

const weights = [
  { name: "Light", value: 300 },
  { name: "Medium", value: 500 },
  { name: "Bold", value: 700 },
  { name: "Black", value: 900 },
] as const;
const sizes = [96, 64, 40, 24, 16] as const;

function SpecimenPage({ onLayout }: { readonly onLayout: (layout: SpecimenLayout) => void }) {
  const main = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const root = main.current;
    if (!root) return;
    const measure = () => {
      const box = (name: string) => {
        const element = root.querySelector<HTMLElement>(`[data-chapter="${name}"]`);
        const rect = element?.getBoundingClientRect();
        return { top: (rect?.top ?? 0) + window.scrollY, height: rect?.height ?? 0 };
      };
      onLayout(
        measureSpecimenLayout(
          { title: box("title"), glyphs: box("glyphs"), specimen: box("specimen"), outro: box("outro") },
          document.documentElement.scrollHeight,
          window.innerHeight,
        ),
      );
    };
    measure();
    // Chapter heights settle after fonts and textures; keep the page trigger in step.
    const observer = new ResizeObserver(() => {
      measure();
      exampleSmoothScrollOptions.ScrollTrigger.refresh();
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, [onLayout]);

  return (
    // Lenis smooths the page scroll; this trigger writes whole-page progress
    // (0 at the top, 1 at the bottom) to `progressKey`.
    <ScrollEffectSection as="div" progressKey={progressKey} start="top top" end="bottom bottom">
      <main className="specimen" id="top" ref={main}>
        <a className="specimen-home" href="/">
          ← Viselora
        </a>
        <section className="specimen-title-block" data-chapter="title">
          <p className="specimen-label">Halden 字体工坊 · 新字体</p>
          <WebGLTarget id="specimen-title" hideWhenReady>
            <h1 className="specimen-title">Meridian</h1>
          </WebGLTarget>
          <p className="specimen-lead">
            为大标题而切的宽体无衬线，九百字重的笔画厚到可以透光。把指针划过纸面，墨会跟着流动。
          </p>
        </section>

        <section className="specimen-glyphs" data-chapter="glyphs">
          <div className="specimen-glyphs-sticky">
            <p className="specimen-label">在运动中保持字形</p>
            <WebGLTarget id="specimen-pangram" hideWhenReady>
              <h2 className="specimen-pangram">Sphinx of black quartz, judge my vow.</h2>
            </WebGLTarget>
            <p className="specimen-note">
              每个字母都是从 DOM 里量出来的字形：滚动时它们从四处归位，再从左到右碎成颗粒。文字本身仍可选中、可被读屏。
            </p>
          </div>
        </section>

        <section className="specimen-sheet" data-chapter="specimen">
          <div className="specimen-weights" aria-label="字重">
            {weights.map((weight) => (
              <figure key={weight.value} className="specimen-weight">
                <span style={{ fontWeight: weight.value }}>Meridian</span>
                <figcaption>
                  {weight.name} {weight.value}
                </figcaption>
              </figure>
            ))}
          </div>
          <div className="specimen-sizes" aria-label="字号">
            {sizes.map((size) => (
              <p key={size} className="specimen-size">
                <span className="specimen-size-label">{size}px</span>
                <span style={{ fontSize: size }}>Quartz grids judge vows</span>
              </p>
            ))}
          </div>
          <p className="specimen-charset">
            ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789 &amp;?!@#
          </p>
        </section>

        <section className="specimen-outro" data-chapter="outro">
          <WebGLTarget id="specimen-signoff" hideWhenReady>
            <p className="specimen-signoff">Halden</p>
          </WebGLTarget>
          <a className="specimen-download" href="#top">
            下载试用字体
          </a>
        </section>
      </main>
    </ScrollEffectSection>
  );
}
