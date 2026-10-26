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
import { LayerStack } from "./LayerStack";
import { RegisterTitle, createRegisterStore, type RegisterStore } from "./RegisterTitle";
import { RuntimeReadout, SectionChip, createRuntimeFeed, type RuntimeFeed } from "./RuntimeReadout";
import { catalogCount, siteCatalog } from "./siteCatalog";
import {
  initialSiteLayout,
  measureSiteLayout,
  siteChapters,
  siteProgressKey,
  type SiteLayout,
} from "./siteLayout";

export type SiteOptions = BenchOptions & { readonly bench: boolean };

/** Page palette; `paper` must match `body` in site.css. */
export const sitePalette = {
  paper: "#eceef4",
  blue: "#2433c8",
  violet: "#3b1d8f",
  pink: "#ff3e8f",
} as const;
const inkOpacity = 0.78;
const repository = "https://github.com/agenticnoob/dom-webgl-workspace";
const installCommand = "npm install @viselora/dom-webgl@alpha";
const skillCommand = "npx skills add agenticnoob/viselora-skills --skill viselora-dom-webgl";

export function Site({ options }: { readonly options: SiteOptions }) {
  const [ink] = useState<InkStore>(createInkStore);
  const [register] = useState<RegisterStore>(createRegisterStore);
  const [feed] = useState<RuntimeFeed>(() => createRuntimeFeed());
  const [layout, setLayout] = useState(initialSiteLayout);
  const latest = useRef(layout);
  useLayoutEffect(() => {
    latest.current = layout;
  }, [layout]);
  const [controller] = useState(() =>
    createBenchController(options, {
      chapters: siteChapters,
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
      className="site-runtime"
      smooth={exampleSmoothScrollOptions}
      canvas={canvas}
      diagnostics={options.diagnostics || undefined}
      onDebugStateChange={(state) => feed.push(state, performance.now())}
      scene={
        <>
          <RegisterTitle
            target="site-title"
            progress={layout.register}
            paper={sitePalette.paper}
            blue={sitePalette.blue}
            pink={sitePalette.pink}
            store={register}
          />
          <LayerStack
            target="site-layers-stage"
            progress={layout.layers}
            paper={sitePalette.paper}
            colors={{ dom: sitePalette.blue, runtime: sitePalette.violet, webgl: sitePalette.pink }}
            labels={["WEBGL · three.js", "RUNTIME · Viselora", "DOM · 页面"]}
          />
          <GlyphScatter
            target="site-glyphs"
            progress={layout.glyphs}
            accent={sitePalette.pink}
            spread={0.8}
          />
          <InkField
            store={ink}
            progress={layout.ink}
            ink={sitePalette.blue}
            accent={sitePalette.pink}
            opacity={inkOpacity}
          />
          <GlassTitle
            target="site-glass"
            paper={sitePalette.paper}
            ink={{ store: ink, opacity: inkOpacity }}
            tint="#c8cdf5"
          />
          {options.bench ? <BenchProbe controller={controller} /> : null}
        </>
      }
    >
      <SitePage register={register} feed={feed} onLayout={setLayout} />
      {options.bench ? <BenchTools controller={controller} options={options} /> : null}
    </WebGLScrollRuntime>
  );
}

function BenchTools({
  controller,
  options,
}: {
  readonly controller: BenchController;
  readonly options: SiteOptions;
}) {
  useBenchAutomation(controller, options.autoplay);
  return <BenchOverlay controller={controller} />;
}

function CopyCommand({ command }: { readonly command: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="site-command">
      <code>{command}</code>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(command).then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1600);
          });
        }}
      >
        {copied ? "已复制" : "复制"}
      </button>
    </div>
  );
}

const measurements = [
  { device: "Huawei P30 · Mali-G76", page: "一镜到底页，五个组件", fps: "58.0", p95: "23.5 ms" },
  { device: "Huawei P30", page: "基准页，章节离屏休眠前 → 后", fps: "25.0 → 47.7", p95: "42.7 ms" },
  { device: "Intel UHD 630 · CPU 降速 4×", page: "字体样张，墨迹 + 玻璃 + 逐字", fps: "60", p95: "18.0 ms" },
  { device: "Intel UHD 630 · DPR 2", page: "基准页，章节离屏休眠前 → 后", fps: "5.3 → 35.1", p95: "53.0 ms" },
] as const;

const mechanisms = [
  { name: "离屏休眠", text: "WebGLSection 外的章节不更新、不绘制；内容和状态保留，回来时不重新加载。" },
  { name: "提前预热", text: "接近视口的章节先编译着色器、上传纹理，进入时不卡顿。" },
  { name: "按设备降档", text: "按帧时间在 high / medium / low 之间切换，并按档位设定像素预算；组件读取 useRenderQuality() 缩放自己的工作量。" },
  { name: "开发诊断", text: "超出绘制预算、进入时才编译、目标就绪却没画出像素，都会在控制台给出 [viselora] 警告。" },
] as const;

function SitePage({
  register,
  feed,
  onLayout,
}: {
  readonly register: RegisterStore;
  readonly feed: RuntimeFeed;
  readonly onLayout: (layout: SiteLayout) => void;
}) {
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
        measureSiteLayout(
          {
            hero: box("hero"),
            layers: box("layers"),
            glyphs: box("glyphs"),
            glass: box("glass"),
            budget: box("budget"),
            catalog: box("catalog"),
            install: box("install"),
          },
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
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [onLayout]);

  return (
    // Lenis smooths the page scroll; the page trigger writes whole-page
    // progress (0 at the top, 1 at the bottom) to `siteProgressKey`.
    <ScrollEffectSection as="div" progressKey={siteProgressKey} start="top top" end="bottom bottom">
      <header className="site-nav">
        <a className="site-brand" href="/">
          <span className="site-brand-mark" aria-hidden="true" />
          Viselora
        </a>
        <RuntimeReadout feed={feed} />
        <nav aria-label="站点">
          <a href="/effects.html">效果库</a>
          <a href="/showcase.html">一镜到底</a>
          <a href="/specimen.html">字体样张</a>
          <a href={repository}>GitHub</a>
        </nav>
      </header>

      <main className="site" id="top" ref={main}>
        <section className="site-hero" data-chapter="hero">
          <p className="site-label">React · three.js · 0.3.0-alpha.1</p>
          <WebGLTarget id="site-title" hideWhenReady>
            <h1 className="site-title">Viselora</h1>
          </WebGLTarget>
          <p className="site-register" aria-live="off">
            <span ref={(node) => void (register.status = node)}>套准偏差</span>
            <strong ref={(node) => void (register.readout = node)}>— px</strong>
            <span className="site-register-hint">粉色是 WebGL，蓝色是 DOM 的位置；向下滚动，两版对齐</span>
          </p>
          <div className="site-hero-foot">
            <p className="site-lead">
              在普通的 React 页面上叠加 three.js 特效。内容仍然是 DOM；Viselora
              测量它们的位置，让 WebGL 画在同一个地方，并替你管住性能：离屏的部分休眠，慢设备自动降档。
            </p>
            <div className="site-hero-actions">
              <CopyCommand command={installCommand} />
              <a className="site-link" href="#catalog">
                看全部 {catalogCount} 个效果
              </a>
            </div>
          </div>
        </section>

        <section className="site-layers" data-chapter="layers">
          <div className="site-layers-pin">
            <div className="site-layers-copy">
              <p className="site-label">原理</p>
              <h2>三层叠印成一页。</h2>
              <dl className="site-plates">
                <div data-plate="dom">
                  <dt>DOM · 你写的页面</dt>
                  <dd>标题、段落、图片都是普通元素，可选中、可读屏；WebGL 不可用时，它们照常显示。</dd>
                </div>
                <div data-plate="runtime">
                  <dt>Runtime · Viselora</dt>
                  <dd>测量每个目标的位置和滚动进度，让离屏章节休眠，按帧时间调整像素比和质量档位。</dd>
                </div>
                <div data-plate="webgl">
                  <dt>WebGL · 你的 three.js</dt>
                  <dd>一个 Canvas、一个场景。组件用原生 R3F 和着色器，画在 DOM 测出的位置上。</dd>
                </div>
              </dl>
              <SectionChip feed={feed} name="layer-stack" />
            </div>
            <WebGLTarget id="site-layers-stage" hideWhenReady>
              <div className="site-stage" aria-hidden="true">
                <span data-plate="webgl" />
                <span data-plate="runtime" />
                <span data-plate="dom" />
              </div>
            </WebGLTarget>
          </div>
        </section>

        <section className="site-glyphs" data-chapter="glyphs" id="glyphs">
          <div className="site-glyphs-pin">
            <p className="site-label">逐字 · GlyphScatter</p>
            <WebGLTarget id="site-glyphs" hideWhenReady>
              <h2 className="site-glyphs-title">每个字都从 DOM 量出来。</h2>
            </WebGLTarget>
            <p className="site-note">
              标题的字形由 measureDOMText 量出位置，画进一张图集，一次绘制完成。滚动时它们归位、停留，再从左到右碎成颗粒；指针靠近会把字推开。文字本身仍可选中、可读屏。
            </p>
            <SectionChip feed={feed} name="glyph-scatter" />
          </div>
        </section>

        <section className="site-glass" data-chapter="glass" id="glass">
          <p className="site-label">材质 · InkField + GlassTitle</p>
          <WebGLTarget id="site-glass" hideWhenReady>
            <p className="site-glass-title">Glass</p>
          </WebGLTarget>
          <div className="site-glass-foot">
            <p className="site-note">
              在纸面上划动指针，墨会跟着流动，甩得快时带出粉色。标题像一块铸玻璃，折射背后的纸色和墨迹；背景在着色器里重建，不需要把场景再渲染一遍。墨停下约 6 秒后，模拟也停止。
            </p>
            <div className="site-chips">
              <SectionChip feed={feed} name="ink-field" />
              <SectionChip feed={feed} name="glass-title" />
            </div>
          </div>
        </section>

        <section className="site-budget" data-chapter="budget">
          <p className="site-label">性能</p>
          <h2>特效可以叠，帧率由运行时守住。</h2>
          <ul className="site-mechanisms">
            {mechanisms.map((item) => (
              <li key={item.name}>
                <h3>{item.name}</h3>
                <p>{item.text}</p>
              </li>
            ))}
          </ul>
          <table className="site-measurements">
            <caption>实测记录，60 秒滚动，详见仓库里的基准说明。页面顶部是本页此刻的数据。</caption>
            <thead>
              <tr>
                <th scope="col">设备</th>
                <th scope="col">页面</th>
                <th scope="col">fps</th>
                <th scope="col">p95 帧时间</th>
              </tr>
            </thead>
            <tbody>
              {measurements.map((row) => (
                <tr key={`${row.device}${row.page}`}>
                  <td>{row.device}</td>
                  <td>{row.page}</td>
                  <td>{row.fps}</td>
                  <td>{row.p95}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="site-catalog" data-chapter="catalog" id="catalog">
          <p className="site-label">效果目录</p>
          <h2>{catalogCount} 个效果，都有可运行的示例。</h2>
          <div className="site-catalog-groups">
            {siteCatalog.map((group) => (
              <section key={group.id} className="site-catalog-group" aria-labelledby={`catalog-${group.id}`}>
                <h3 id={`catalog-${group.id}`}>
                  {group.title}
                  <span>{group.entries.length}</span>
                </h3>
                <p>{group.note}</p>
                <ul>
                  {group.entries.map((entry) => (
                    <li key={`${entry.source}${entry.name}`}>
                      <a href={entry.href}>
                        <span className="site-catalog-name">{entry.name}</span>
                        <code>{entry.source}</code>
                        <span className="site-catalog-kind" data-rendering={entry.rendering}>
                          {entry.rendering}
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </section>

        <section className="site-install" data-chapter="install">
          <p className="site-label">开始</p>
          <h2>装上运行时，或者让 agent 来装。</h2>
          <div className="site-install-steps">
            <div>
              <h3>手动安装</h3>
              <p>需要 React 19.2、R3F 9 和 three 0.184–0.186。</p>
              <CopyCommand command={installCommand} />
            </div>
            <div>
              <h3>给 agent 装 skill</h3>
              <p>skill 带着上面的组件源码和接入规则，agent 按页面需要挑选、复制。</p>
              <CopyCommand command={skillCommand} />
            </div>
          </div>
          <footer className="site-footer">
            <span>Viselora · MIT</span>
            <a href={repository}>源码与文档</a>
            <a href="#top">回到顶部</a>
          </footer>
        </section>
      </main>
    </ScrollEffectSection>
  );
}
