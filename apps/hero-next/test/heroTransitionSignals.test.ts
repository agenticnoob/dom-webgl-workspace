import { describe, expect, test, vi } from "vitest";

import { heroTransitionConfig } from "../src/heroTransitionConfig";
import {
  publishHeroTransitionSignals,
  readHeroTransitionSignals,
  type HeroTransitionSignalReader,
  type HeroTransitionSignalWriter,
} from "../src/heroTransitionSignals";

describe("hero transition signals", () => {
  test("publishes exactly six normalized signal values", () => {
    const set = vi.fn();

    publishHeroTransitionSignals({ set }, {
      committedScheme: "initial",
      targetScheme: "inverted",
      coverage: 0.5,
      origin: { x: 0.25, y: 0.75 },
      phase: "retracting",
    });

    expect(set.mock.calls).toEqual([
      [heroTransitionConfig.signalKeys.committedScheme, 0],
      [heroTransitionConfig.signalKeys.targetScheme, 1],
      [heroTransitionConfig.signalKeys.coverage, 0.5],
      [heroTransitionConfig.signalKeys.originX, 0.25],
      [heroTransitionConfig.signalKeys.originY, 0.75],
      [heroTransitionConfig.signalKeys.phase, 2 / 3],
    ]);
  });

  test("round-trips both schemes and every phase through a minimal store", () => {
    for (const committedScheme of ["initial", "inverted"] as const) {
      for (const targetScheme of ["initial", "inverted"] as const) {
        for (const phase of [
          "idle",
          "expanding",
          "retracting",
          "awaiting-release",
        ] as const) {
          const values = new Map<string, number>();
          const writer = {
            set(key: string, value: number) {
              values.set(key, value);
            },
          } satisfies HeroTransitionSignalWriter;
          const reader = {
            get(key: string) {
              return values.get(key) ?? 0;
            },
          } satisfies HeroTransitionSignalReader;

          publishHeroTransitionSignals(writer, {
            committedScheme,
            targetScheme,
            coverage: 0.625,
            origin: { x: 0.2, y: 0.8 },
            phase,
          });

          expect(readHeroTransitionSignals(reader)).toEqual({
            committedScheme,
            targetScheme,
            coverage: 0.625,
            origin: { x: 0.2, y: 0.8 },
            phase,
          });
        }
      }
    }
  });

  test("sanitizes non-finite values and clamps normalized fields", () => {
    const invalid = {
      get() {
        return Number.NaN;
      },
    } satisfies HeroTransitionSignalReader;

    expect(readHeroTransitionSignals(invalid)).toEqual({
      committedScheme: "initial",
      targetScheme: "initial",
      coverage: 0,
      origin: { x: 0.5, y: 0.5 },
      phase: "idle",
    });

    const values = new Map<string, number>([
      [heroTransitionConfig.signalKeys.committedScheme, -10],
      [heroTransitionConfig.signalKeys.targetScheme, 10],
      [heroTransitionConfig.signalKeys.coverage, 2],
      [heroTransitionConfig.signalKeys.originX, -1],
      [heroTransitionConfig.signalKeys.originY, 3],
      [heroTransitionConfig.signalKeys.phase, 0.7],
    ]);
    expect(
      readHeroTransitionSignals({ get: (key) => values.get(key) ?? 0 }),
    ).toEqual({
      committedScheme: "initial",
      targetScheme: "inverted",
      coverage: 1,
      origin: { x: 0, y: 1 },
      phase: "retracting",
    });
  });
});
