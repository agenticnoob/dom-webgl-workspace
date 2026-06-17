import type { WebGLGateScrollBehavior, WebGLScrollBehavior } from "../types";

export function normalizeScrollBehavior(scroll?: unknown): WebGLScrollBehavior {
  if (scroll === undefined) {
    return { type: "page" };
  }

  if (!isRecord(scroll)) {
    throw new Error("WebGL scroll declaration must be an object.");
  }

  if (scroll.type === undefined || scroll.type === "page") {
    return { type: "page" };
  }

  if (scroll.type !== "gate") {
    throw new Error(`WebGL scroll declaration has an invalid type: ${String(scroll.type)}.`);
  }

  return normalizeGateScrollBehavior(scroll);
}

function normalizeGateScrollBehavior(
  scroll: Record<string, unknown>,
): WebGLGateScrollBehavior {
  const start = typeof scroll.start === "string" ? scroll.start.trim() : "";

  if (!start) {
    throw new Error("WebGL gate scroll declaration requires a non-empty start field.");
  }

  const duration = scroll.duration;

  if (typeof duration !== "number" || !Number.isFinite(duration) || duration <= 0) {
    throw new Error(
      "WebGL gate scroll declaration requires a positive finite duration field.",
    );
  }

  const release = scroll.release ?? "forward-complete";

  if (
    release !== "forward-complete" &&
    release !== "both-directions-complete"
  ) {
    throw new Error(
      `WebGL gate scroll declaration has an invalid release field: ${String(release)}.`,
    );
  }

  return {
    type: "gate",
    start,
    duration,
    release,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
