import type { WebGLProgressSignalSource } from "@project/dom-webgl-runtime";
import { describe, expect, test } from "vitest";

import { createScrollEffectProgressStore } from "./scrollEffectProgress";

describe("createScrollEffectProgressStore", () => {
  test("returns zero for missing keys and satisfies the runtime progress source", () => {
    const store = createScrollEffectProgressStore();
    const source = store.source satisfies WebGLProgressSignalSource;

    expect(source.get("missing")).toBe(0);
  });

  test("clamps finite values to the runtime progress range", () => {
    const store = createScrollEffectProgressStore();

    store.set("intro", -0.25);
    expect(store.source.get("intro")).toBe(0);

    store.set("intro", 0.4);
    expect(store.source.get("intro")).toBe(0.4);

    store.set("intro", 1.25);
    expect(store.source.get("intro")).toBe(1);
  });

  test("treats non-finite values defensibly as zero", () => {
    const store = createScrollEffectProgressStore();

    store.set("intro", Number.NaN);
    expect(store.source.get("intro")).toBe(0);

    store.set("intro", Number.POSITIVE_INFINITY);
    expect(store.source.get("intro")).toBe(0);

    store.set("intro", Number.NEGATIVE_INFINITY);
    expect(store.source.get("intro")).toBe(0);
  });

  test("keeps each progress store instance isolated", () => {
    const first = createScrollEffectProgressStore();
    const second = createScrollEffectProgressStore();

    first.set("shared", 0.8);
    second.set("shared", 0.2);

    expect(first.source.get("shared")).toBe(0.8);
    expect(second.source.get("shared")).toBe(0.2);
  });

  test("resets and clears a key back to zero", () => {
    const store = createScrollEffectProgressStore();

    store.set("intro", 0.7);
    store.reset("intro");
    expect(store.source.get("intro")).toBe(0);

    store.set("intro", 0.9);
    store.clear("intro");
    expect(store.source.get("intro")).toBe(0);
  });
});
