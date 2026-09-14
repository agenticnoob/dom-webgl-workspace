import React, { Fragment, useLayoutEffect, useRef, useState } from "react";
import {
  WebGLCamera,
  WebGLLight,
  WebGLModel,
  WebGLPassViewport,
  WebGLScene,
  type WebGLCameraProps,
  type WebGLModelProps,
  type WebGLSceneRenderOptions,
} from "@viselora/dom-webgl/react";
import { useScrollEffectProgressStore } from "@viselora/scroll-adapters/react";

import { createModelStoryController } from "./controller";
import {
  createModelStoryEffectDeclaration,
  type ModelStoryFraming,
  type ModelStoryVisualState,
} from "./effect";
import type { ModelStoryMessages } from "./frame";
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
  readonly loader?: WebGLModelProps["loader"];
  readonly framing?: ModelStoryFraming;
  /** Optional public image used until the managed model is ready or if loading fails. */
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

const cameraPosition = [0, 0, 4.5] satisfies WebGLCameraProps["position"];
const cameraTarget = [0, 0, 0] satisfies WebGLCameraProps["target"];
const lightPosition: [number, number, number] = [3, 4, 5];
const defaultFraming = {
  center: [0, 0, 0],
  size: [1, 1, 1],
} satisfies ModelStoryFraming;
const facings = ["front", "side", "back"] as const;

/** Mount inside WebGLScrollRuntime with modelStoryEffects. This component creates no runtime. */
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
  const [declaration] = useState(() => {
    if (!id.trim())
      throw new Error("ModelStory needs a nonempty, runtime-unique id.");
    const progressKey = `${id}.progress`;
    const visual: ModelStoryVisualState = {
      aspect: 1,
      reducedMotion: false,
      setModelReady(ready) {
        rootRef.current?.setAttribute("data-model-ready", String(ready));
      },
    };
    return {
      progressKey,
      visual,
      effects: createModelStoryEffectDeclaration(
        progressKey,
        model.framing ?? defaultFraming,
        visual,
      ),
      render: {
        id: `${id}.pass`,
        camera: `${id}.camera`,
        clearDepth: true,
        viewport: { mode: "dom-rect", scissor: true },
      } satisfies WebGLSceneRenderOptions,
    };
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
            <WebGLPassViewport
              id={`${id}.viewport`}
              className="model-story__viewport"
            >
              <WebGLScene
                id={`${id}.scene`}
                projection="perspective-stage"
                render={declaration.render}
              >
                <WebGLCamera
                  id={`${id}.camera`}
                  default
                  type="perspective"
                  mode="perspective-stage"
                  fov={35}
                  position={cameraPosition}
                  target={cameraTarget}
                />
                <WebGLModel
                  id={`${id}.model`}
                  src={model.src}
                  loader={model.loader}
                  effects={declaration.effects}
                />
                <WebGLLight
                  id={`${id}.ambient`}
                  kind="ambient"
                  intensity={1.2}
                />
                <WebGLLight
                  id={`${id}.key`}
                  kind="directional"
                  intensity={2.4}
                  position={lightPosition}
                />
              </WebGLScene>
            </WebGLPassViewport>
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
