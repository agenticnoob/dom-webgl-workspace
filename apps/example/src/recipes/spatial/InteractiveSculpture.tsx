import React from "react";
import { useEffect, useMemo, useRef } from "react";
import { defaultSpatialPalette } from "./config";
import { SpatialScene } from "./SpatialScene";
import { useSpatialStage } from "./stage";
import type { SpatialEffectParams } from "./effects";
import type { SpatialMotion, SpatialPalette } from "./types";
import "./spatial.css";

const defaultMotion: SpatialMotion = {};
export type InteractiveSculptureProps = {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly palette?: SpatialPalette;
  readonly motion?: SpatialMotion;
  /** Omit to disable theme switching. Positive duration in milliseconds. */
  readonly holdMs?: number;
  readonly height?: number | string;
  readonly onSchemeChange?: (scheme: 0 | 1) => void;
};

export function InteractiveSculpture({
  id,
  title,
  description,
  palette = defaultSpatialPalette,
  motion = defaultMotion,
  holdMs,
  height = "min(900px, 100svh)",
  onSchemeChange,
}: InteractiveSculptureProps) {
  if (!id.trim())
    throw new Error("InteractiveSculpture requires a nonempty, unique id.");
  if (holdMs !== undefined && (!Number.isFinite(holdMs) || holdMs <= 0))
    throw new RangeError("holdMs must be a positive duration.");
  const { root, viewport, stage, ready, scheme } = useSpatialStage(id, false);
  const onSchemeChangeRef = useRef(onSchemeChange);
  const params = useMemo(
    () =>
      ({
        kind: "recipe.spatial.mesh",
        stage,
        palette,
        motion,
        holdMs,
      }) satisfies SpatialEffectParams,
    [stage, palette, motion, holdMs],
  );
  useEffect(() => {
    onSchemeChangeRef.current = onSchemeChange;
  }, [onSchemeChange]);
  useEffect(() => {
    onSchemeChangeRef.current?.(scheme);
  }, [scheme]);
  const background = scheme ? palette.foreground : palette.background;
  const foreground = scheme ? palette.background : palette.foreground;
  return (
    <section
      ref={root}
      className="spatial-sculpture"
      data-ready={ready}
      data-scheme={scheme}
      style={{
        height,
        background: ready ? "transparent" : background,
        color: foreground,
      }}
      aria-label={title}
    >
      <div ref={viewport} className="spatial-viewport">
        <SpatialScene id={id} params={params} />
      </div>
      <div className="spatial-caption">
        <h2>{title}</h2>
        {description && <p>{description}</p>}
        {holdMs && (
          <button
            type="button"
            onClick={() => {
              if (ready) stage.keyboardToggle = true;
              else {
                stage.hold = { ...stage.hold, scheme: scheme ? 0 : 1 };
                stage.publishScheme(stage.hold.scheme);
              }
            }}
          >
            切换配色
          </button>
        )}
      </div>
      {!ready && (
        <p className="spatial-fallback" role="status">
          交互雕塑正在加载；说明和配色按钮仍可使用。
        </p>
      )}
    </section>
  );
}
