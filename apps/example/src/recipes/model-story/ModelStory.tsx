import React, { Fragment, useLayoutEffect, useRef, useState } from "react";
import { PerspectiveCamera, View } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Suspense, useEffect } from "react";
import { ErrorBoundary } from "react-error-boundary";
import type { WebGLProgressSignalSource } from "@viselora/dom-webgl";
import { useClonedModel } from "../../useClonedModel";
import { useRuntimeReady } from "../../useRuntimeReady";
import { useScrollEffectProgressStore } from "@viselora/scroll-adapters/react";

import { createModelStoryController } from "./controller";
import {
  validateModelStoryFraming,
  resolveModelStoryTransform,
  type ModelStoryFraming,
  type ModelStoryVisualState,
} from "./effect";
import { resolveModelStoryFrame, type ModelStoryMessages } from "./frame";
import { splitStoryText, type StoryWrapSide } from "./wrap";
import "./model-story.css";

export type ModelStorySection = {
  readonly id: string;
  readonly heading: string;
  readonly paragraphs: readonly string[];
  readonly side: StoryWrapSide;
};

export type ModelStoryModel = {
  readonly src: string;
  readonly description: string;
  readonly dracoPath?: string;
  readonly framing?: ModelStoryFraming;
  /** Optional public image used until the GLB is ready or if loading fails. */
  readonly poster?: string;
};

export type ModelStoryProps = {
  /** Unique within the existing runtime. Remount with a new React key to change declarations. */
  readonly id: string;
  readonly title: string;
  readonly model: ModelStoryModel;
  readonly sections: readonly ModelStorySection[];
  readonly messages: ModelStoryMessages;
  readonly className?: string;
};

const cameraPosition: [number, number, number] = [0, 0, 4.5];
const lightPosition: [number, number, number] = [3, 4, 5];
const defaultFraming = {
  center: [0, 0, 0],
  size: [1, 1, 1],
} satisfies ModelStoryFraming;
const facings = ["front", "side", "back"] as const;

/** Mount inside a shared WebGLScrollRuntime whose scene contains View.Port. */
export function ModelStory({
  id,
  title,
  model,
  sections,
  messages,
  className,
}: ModelStoryProps) {
  const rootRef = useRef<HTMLElement | null>(null);
  const flowRef = useRef<HTMLDivElement | null>(null);
  const modelBoxRef = useRef<HTMLDivElement | null>(null);
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const store = useScrollEffectProgressStore();
  const runtimeReady = useRuntimeReady();
  const [modelReady, setModelReady] = useState(false);
  const [declaration] = useState(() => {
    if (!id.trim())
      throw new Error("ModelStory needs a nonempty, runtime-unique id.");
    const progressKey = `${id}.progress`;
    const visual: ModelStoryVisualState = {
      aspect: 1,
      reducedMotion: false,
      setModelReady,
    };
    const framing = model.framing ?? defaultFraming;
    validateModelStoryFraming(framing);
    return { progressKey, visual, framing };
  });

  useLayoutEffect(() => {
    const root = rootRef.current;
    const flow = flowRef.current;
    const modelBox = modelBoxRef.current;
    const bubble = bubbleRef.current;
    if (!root || !flow || !modelBox || !bubble) return;
    const controller = createModelStoryController({
      root,
      flow,
      modelBox,
      bubble,
      progressKey: declaration.progressKey,
      visual: declaration.visual,
      store,
    });
    return () => controller.dispose();
  }, [declaration, store]);

  return (
    <section
      ref={rootRef}
      className={`model-story${className ? ` ${className}` : ""}`}
      data-model-ready={modelReady && runtimeReady}
      aria-labelledby={`${id}.title`}
    >
      <header className="model-story__intro">
        <h2 id={`${id}.title`}>{title}</h2>
        <p>{model.description}</p>
      </header>
      <div className="model-story__stage" aria-hidden="true">
        <div className="model-story__composition">
          <div ref={bubbleRef} className="model-story__bubble">
            {facings.map((facing) => (
              <span
                key={facing}
                className="model-story__message"
                data-story-message={facing}
              >
                {Array.from(messages[facing]).map((character, index) => (
                  <span key={index} data-story-character="">
                    {character}
                  </span>
                ))}
              </span>
            ))}
          </div>
          <div ref={modelBoxRef} className="model-story__model-box">
            <div className="model-story__fallback">
              {model.poster ? (
                <img src={model.poster} alt="" />
              ) : (
                <span className="model-story__placeholder">3D</span>
              )}
              <span>{model.description}</span>
            </div>
            <View id={`${id}.viewport`} className="model-story__viewport">
              <PerspectiveCamera
                makeDefault
                fov={35}
                position={cameraPosition}
              />
              <ErrorBoundary
                fallback={null}
                onError={() => declaration.visual.setModelReady(false)}
              >
                <Suspense fallback={null}>
                  <StoryModel
                    model={model}
                    progress={store.source}
                    progressKey={declaration.progressKey}
                    visual={declaration.visual}
                    framing={declaration.framing}
                  />
                </Suspense>
              </ErrorBoundary>
              <ambientLight intensity={1.2} />
              <directionalLight intensity={2.4} position={lightPosition} />
              <ambientLight intensity={0.45} />
              <directionalLight intensity={1} position={[1, 1.5, 2]} />
            </View>
          </div>
        </div>
      </div>
      <div ref={flowRef} className="model-story__flow">
        {sections.map((section) => (
          <article
            key={section.id}
            className={`model-story__section model-story__section--${section.side}`}
          >
            <h3>
              <StoryText side={section.side} text={section.heading} />
            </h3>
            {section.paragraphs.map((paragraph, index) => (
              <p key={index}>
                <StoryText side={section.side} text={paragraph} />
              </p>
            ))}
          </article>
        ))}
      </div>
      <details className="model-story__transcript">
        <summary>Model captions</summary>
        <ul>
          {facings.map((facing) => (
            <li key={facing}>{messages[facing]}</li>
          ))}
        </ul>
      </details>
    </section>
  );
}

function StoryText({
  side,
  text,
}: {
  readonly side: StoryWrapSide;
  readonly text: string;
}) {
  return (
    <>
      <span className="model-story__sr-only">{text}</span>
      <span
        data-story-wrap-text=""
        data-story-wrap-side={side}
        aria-hidden="true"
      >
        {splitStoryText(text).map((segment, index) =>
          /^\s+$/.test(segment) ? (
            <Fragment key={index}>{segment}</Fragment>
          ) : (
            <span
              key={index}
              className="model-story__token"
              data-story-wrap-token=""
            >
              {segment}
            </span>
          ),
        )}
      </span>
    </>
  );
}

function StoryModel({
  model,
  progress,
  progressKey,
  visual,
  framing,
}: {
  readonly model: ModelStoryModel;
  readonly progress: WebGLProgressSignalSource;
  readonly progressKey: string;
  readonly visual: ModelStoryVisualState;
  readonly framing: ModelStoryFraming;
}) {
  const { scene } = useClonedModel(model.src, model.dracoPath);
  useEffect(() => {
    visual.setModelReady(true);
    return () => visual.setModelReady(false);
  }, [visual]);
  useFrame(() => {
    const { rotationY } = resolveModelStoryFrame(
      progress.get(progressKey),
      visual.reducedMotion,
    );
    const transform = resolveModelStoryTransform(
      rotationY,
      framing,
      visual.aspect,
    );
    scene.rotation.set(0, rotationY, 0);
    scene.scale.setScalar(transform.scale);
    scene.position.set(...transform.position);
  });
  return <primitive object={scene} dispose={null} />;
}
