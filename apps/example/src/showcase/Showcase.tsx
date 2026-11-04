import { useThree } from "@react-three/fiber";
import { WebGLTarget, type WebGLRuntimeProps } from "@viselora/dom-webgl/react";
import { ScrollEffectSection, WebGLScrollRuntime } from "@viselora/scroll-adapters/react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { PMREMGenerator } from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

import { BenchOverlay, useBenchAutomation } from "../bench/BenchApp";
import {
  createBenchController,
  type BenchController,
} from "../bench/benchController";
import { type BenchOptions } from "../bench/benchLayout";
import { BenchProbe } from "../bench/BenchScene";
import { exampleSmoothScrollOptions } from "../exampleSmoothScroll";
import {
  GalleryGrid,
  GalleryPlanes,
  createGalleryHoverStore,
  type GalleryHoverStore,
} from "./GalleryReveal";
import { IntroReveal } from "./IntroReveal";
import { ChapterVeil, OneTakeRail } from "./OneTakeRail";
import {
  ParticleForm,
  sphereShape,
  textShape,
  torusKnotShape,
} from "./ParticleForm";
import {
  ProductHotspot,
  ProductTurntable,
  createHotspotStore,
  type HotspotStore,
} from "./ProductTurntable";
import {
  galleryItems,
  galleryTargetId,
  initialShowcaseLayout,
  measureShowcaseLayout,
  productHotspots,
  productPosition,
  showcaseBlocks,
  showcaseChapterAt,
  showcaseChapters,
  showcaseColors,
  showcaseLook,
  showcasePath,
  showcaseProgressKey,
  type ShowcaseLayout,
  wordTargetId,
} from "./showcaseLayout";

const particleShapes = [
  sphereShape(),
  torusKnotShape(),
  textShape(wordTargetId),
];
const productStops = [0, 0.18, 0.5, 0.82, 1];

export type ShowcaseOptions = BenchOptions & { readonly bench: boolean };

export function Showcase({ options }: { readonly options: ShowcaseOptions }) {
  const [hover] = useState(createGalleryHoverStore);
  const [hotspots] = useState(createHotspotStore);
  const [layout, setLayout] = useState(initialShowcaseLayout);
  const latestLayout = useRef(layout);
  useLayoutEffect(() => {
    latestLayout.current = layout;
  }, [layout]);
  const [controller] = useState(() =>
    createBenchController(options, {
      chapters: showcaseChapters,
      chapterAt: (progress) =>
        showcaseChapterAt(latestLayout.current, progress),
      requiredAssets: ["intro"],
    }),
  );
  const canvas = useMemo(
    (): NonNullable<WebGLRuntimeProps["canvas"]> => ({
      camera: { fov: 45, near: 0.1, far: 200, position: showcasePath[0] },
      // ACES tone mapping keeps the lit product from clipping to white.
      flat: false,
      dpr: options.maxDpr,
      gl: { alpha: true, antialias: true, powerPreference: options.gpu },
    }),
    [options],
  );
  return (
    <WebGLScrollRuntime
      className="showcase-runtime"
      smooth={exampleSmoothScrollOptions}
      canvas={canvas}
      diagnostics={options.diagnostics || undefined}
      scene={
        <ShowcaseScene
          layout={layout}
          hover={hover}
          hotspots={hotspots}
          controller={options.bench ? controller : undefined}
        />
      }
    >
      <ShowcasePage hover={hover} hotspots={hotspots} onLayout={setLayout} />
      {options.bench ? (
        <BenchTools controller={controller} options={options} />
      ) : null}
    </WebGLScrollRuntime>
  );
}

function BenchTools({
  controller,
  options,
}: {
  readonly controller: BenchController;
  readonly options: ShowcaseOptions;
}) {
  useBenchAutomation(controller, options.autoplay);
  return <BenchOverlay controller={controller} />;
}

function ShowcaseScene({
  layout,
  hover,
  hotspots,
  controller,
}: {
  readonly layout: ShowcaseLayout;
  readonly hover: GalleryHoverStore;
  readonly hotspots: HotspotStore;
  readonly controller?: BenchController;
}) {
  const [revealing, setRevealing] = useState(false);
  useEffect(() => {
    // The first scene is particles sampled on mount; give it a frame to draw.
    const timer = window.setTimeout(() => setRevealing(true), 300);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <>
      <OneTakeRail
        progressKey={showcaseProgressKey}
        path={showcasePath}
        look={showcaseLook}
      />
      <Environment />
      <ambientLight intensity={0.35} />
      <directionalLight position={[4, 6, 6]} intensity={1.6} />
      <ParticleForm
        progress={layout.form}
        shapes={particleShapes}
        color={showcaseColors.particles}
        accent={showcaseColors.accent}
      />
      <GalleryPlanes
        id={galleryTargetId}
        items={galleryItems}
        hover={hover}
        mount="eager"
      />
      <ProductTurntable
        src="/models/4.glb"
        dracoPath="/draco/gltf/"
        progress={layout.product}
        position={productPosition}
        size={2.4}
        stops={productStops}
        hotspots={productHotspots}
        store={hotspots}
        finish="studio"
        studioColor="#c9c0b2"
      />
      <ChapterVeil
        progressKey={showcaseProgressKey}
        boundaries={layout.boundaries}
        width={0.04}
        color={showcaseColors.background}
        accent={showcaseColors.accent}
      />
      <IntroReveal
        start={revealing}
        color={showcaseColors.background}
        accent={showcaseColors.accent}
        onDone={() => controller?.assetReady("intro")}
      />
      {controller ? <BenchProbe controller={controller} /> : null}
    </>
  );
}

function Environment() {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  useEffect(() => {
    const generator = new PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const environment = generator.fromScene(room, 0.04).texture;
    room.dispose();
    generator.dispose();
    scene.environment = environment;
    return () => {
      if (scene.environment === environment) scene.environment = null;
      environment.dispose();
    };
  }, [gl, scene]);
  return null;
}

function ShowcasePage({
  hover,
  hotspots,
  onLayout,
}: {
  readonly hover: GalleryHoverStore;
  readonly hotspots: HotspotStore;
  readonly onLayout: (layout: ShowcaseLayout) => void;
}) {
  const height = (value: number) => ({ minHeight: `${value}vh` });
  const main = useRef<HTMLElement>(null);
  // Chapter progress comes from where the blocks actually are.
  useLayoutEffect(() => {
    const root = main.current;
    if (!root) return;
    const measure = () => {
      const blocks = Array.from(
        root.querySelectorAll<HTMLElement>("[data-chapter]"),
      );
      const top = (element: HTMLElement) =>
        element.getBoundingClientRect().top + window.scrollY;
      const find = (name: string) =>
        blocks.find((block) => block.dataset.chapter === name);
      const tops = {
        intro: 0,
        form: top(find("form") ?? root),
        gallery: top(find("gallery") ?? root),
        product: top(find("product") ?? root),
        outro: top(find("outro") ?? root),
      };
      const product = find("product");
      onLayout(
        measureShowcaseLayout(
          tops,
          product ? top(product) + product.offsetHeight : tops.outro,
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
    // Lenis smooths the page scroll; this trigger writes whole-page progress
    // (0 at the top, 1 at the bottom) to `showcaseProgressKey`.
    <ScrollEffectSection as="div" progressKey={showcaseProgressKey} start="top top" end="bottom bottom">
      <main className="showcase-page" ref={main}>
        <a className="showcase-home" href="/">
          ← Viselora
        </a>
        <section
          className="showcase-block showcase-intro"
          data-chapter="intro"
          style={height(showcaseBlocks.intro)}
        >
          <p className="showcase-kicker">VISELORA / 一镜到底示例</p>
          <h1 className="showcase-title">让页面成为一次连续的镜头。</h1>
          <p className="showcase-lead">
            五个可复制的特效组件拼成这一页：镜头轨道与章节转场、开场转入、粒子形体、网格画廊和产品转台。
            离屏的部分会暂停，质量随设备调整。
          </p>
        </section>
        <section
          className="showcase-block"
          data-chapter="form"
          style={height(showcaseBlocks.form)}
        >
          <div className="showcase-sticky">
            <p className="showcase-kicker">01 / 形体</p>
            <h2>十万个点，跟着滚动换形状。</h2>
            <p>从球体到扭结，最后拼成下面这个词。把指针移过去，粒子会让开。</p>
            <WebGLTarget id={wordTargetId}>
              <p className="showcase-word">VISELORA</p>
            </WebGLTarget>
          </div>
        </section>
        <section
          className="showcase-block showcase-gallery"
          data-chapter="gallery"
          style={height(showcaseBlocks.gallery)}
        >
          <div className="showcase-copy">
            <p className="showcase-kicker">02 / 画廊</p>
            <h2>网格仍是 DOM，图片换成了 WebGL。</h2>
            <p>悬停时第二张图从中心逐格出现；滚动得越快，卡片弯得越明显。</p>
          </div>
          <GalleryGrid id={galleryTargetId} items={galleryItems} hover={hover} />
        </section>
        <section
          className="showcase-block"
          data-chapter="product"
          style={height(showcaseBlocks.product)}
        >
          <div className="showcase-sticky showcase-product-copy">
            <p className="showcase-kicker">03 / 产品</p>
            <h2>滚动转动它，标签始终是文字。</h2>
            <p>每个角度停一会儿；标签由 3D 位置投影到屏幕，仍可选中、可读屏。</p>
          </div>
          <div className="product-hotspots" aria-label="产品标注">
            <ProductHotspot store={hotspots} id="apex">
              顶点 · 单块铸造
            </ProductHotspot>
            <ProductHotspot store={hotspots} id="facet">
              棱面 · 漆面清漆
            </ProductHotspot>
            <ProductHotspot store={hotspots} id="base">
              底座 · 磨砂处理
            </ProductHotspot>
          </div>
        </section>
        <section
          className="showcase-block showcase-outro"
          data-chapter="outro"
          style={height(showcaseBlocks.outro)}
        >
          <h2>镜头结束。</h2>
          <p>每个组件都可以单独复制使用，规则写在各自的文件头。</p>
        </section>
      </main>
    </ScrollEffectSection>
  );
}
