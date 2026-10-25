import type { RuntimeDebugState } from "@viselora/dom-webgl";
import { describe, expect, it } from "vitest";

import { effectGroups } from "../src/EffectsGroup";
import { recipeCatalog } from "../src/recipes/catalog";
import { createStackGeometry, stackSeparation } from "../src/site/LayerStack";
import { cssRGB, misregistration } from "../src/site/RegisterTitle";
import { createRuntimeFeed, summarizeSections } from "../src/site/RuntimeReadout";
import { catalogCount, siteCatalog } from "../src/site/siteCatalog";
import { measureSiteLayout } from "../src/site/siteLayout";

const debugState = (phases: RuntimeDebugState["sections"][number]["phase"][]): RuntimeDebugState => ({
  ready: true,
  targetCount: 0,
  targets: [],
  sections: phases.map((phase, index) => ({ label: `s${index}`, phase, warmed: true })),
  warnings: [],
});

describe("site layout", () => {
  it("derives every range from the measured blocks", () => {
    const layout = measureSiteLayout(
      {
        hero: { top: 0, height: 1000 },
        layers: { top: 1000, height: 3000 },
        glyphs: { top: 4000, height: 2600 },
        glass: { top: 6600, height: 1300 },
        budget: { top: 7900, height: 1000 },
        catalog: { top: 8900, height: 1600 },
        install: { top: 10500, height: 1000 },
      },
      11500,
      1000,
    );
    const scrollable = 10500;
    expect(layout.starts[0]).toBe(0);
    expect(layout.starts[1]).toBeCloseTo(500 / scrollable);
    expect(layout.register).toEqual({ key: "site", from: 0, to: 450 / scrollable });
    // Pinned for the block's height minus one viewport.
    expect(layout.layers.from).toBeCloseTo(1000 / scrollable);
    expect(layout.layers.to).toBeCloseTo(3000 / scrollable);
    expect(layout.glyphs.from).toBeCloseTo(3150 / scrollable);
    expect(layout.glyphs.to).toBeCloseTo(5850 / scrollable);
    expect(layout.ink.from).toBeCloseTo(5600 / scrollable);
    expect(layout.ink.to).toBeCloseTo(7900 / scrollable);
  });

  it("keeps ranges non-empty when blocks collapse", () => {
    const empty = { top: 0, height: 0 };
    const layout = measureSiteLayout(
      { hero: empty, layers: empty, glyphs: empty, glass: empty, budget: empty, catalog: empty, install: empty },
      800,
      800,
    );
    for (const range of [layout.register, layout.layers, layout.glyphs, layout.ink])
      expect(range.to).toBeGreaterThan(range.from);
  });
});

describe("register title", () => {
  it("is fully out of register at the start and in register at the end", () => {
    expect(misregistration(0)).toBe(1);
    expect(misregistration(1)).toBe(0);
    expect(misregistration(1.5)).toBe(0);
    expect(misregistration(-1)).toBe(1);
    expect(misregistration(0.25)).toBeGreaterThan(misregistration(0.75));
  });

  it("reads CSS hex colours without colour management", () => {
    const blue = cssRGB("#2433c8");
    expect(blue.x).toBeCloseTo(0x24 / 255);
    expect(blue.y).toBeCloseTo(0x33 / 255);
    expect(blue.z).toBeCloseTo(0xc8 / 255);
  });
});

describe("layer stack", () => {
  it("opens, holds and closes back into register", () => {
    expect(stackSeparation(0)).toBe(0);
    expect(stackSeparation(0.5)).toBe(1);
    expect(stackSeparation(1)).toBe(0);
    expect(stackSeparation(0.2)).toBeGreaterThan(0);
    expect(stackSeparation(0.2)).toBeLessThan(1);
  });

  it("builds line pairs and triangles inside the unit plate", () => {
    const shapes = createStackGeometry(4 / 3);
    const ticks = shapes.ticks.getAttribute("position");
    const fills = shapes.fills.getAttribute("position");
    expect(ticks.count % 2).toBe(0);
    expect(fills.count % 3).toBe(0);
    expect(shapes.fills.getAttribute("aDensity").count).toBe(fills.count);
    for (let index = 0; index < fills.count; index += 1) {
      expect(Math.abs(fills.getX(index))).toBeLessThanOrEqual(0.5);
      expect(Math.abs(fills.getY(index))).toBeLessThanOrEqual(0.5);
    }
    expect(() => shapes.dispose()).not.toThrow();
  });
});

describe("runtime readout", () => {
  it("counts sections by phase", () => {
    expect(summarizeSections(undefined)).toEqual({ active: 0, warm: 0, sleep: 0 });
    expect(summarizeSections(debugState(["active", "sleep", "warm", "sleep"]))).toEqual({
      active: 1,
      warm: 1,
      sleep: 2,
    });
  });

  it("republishes at most once per interval", () => {
    const feed = createRuntimeFeed(250);
    let notified = 0;
    const stop = feed.subscribe(() => {
      notified += 1;
    });
    const first = debugState(["active"]);
    feed.push(first, 0);
    feed.push(debugState(["sleep"]), 100);
    expect(feed.get()).toBe(first);
    feed.push(debugState(["warm"]), 300);
    expect(feed.get()?.sections[0].phase).toBe("warm");
    expect(notified).toBe(2);
    stop();
    feed.push(debugState(["active"]), 600);
    expect(notified).toBe(2);
  });
});

describe("site catalog", () => {
  it("links every entry to an anchor that exists", () => {
    const effectAnchors = new Set<string>([
      ...effectGroups.map((group) => group.id),
      ...recipeCatalog.map((recipe) => recipe.id),
    ]);
    const pages = new Set(["/showcase.html", "/specimen.html"]);
    const homeAnchors = new Set(["#glyphs", "#glass"]);
    for (const group of siteCatalog)
      for (const entry of group.entries) {
        const [page, anchor] = entry.href.split("#");
        if (page === "/effects.html") expect(effectAnchors).toContain(anchor);
        else if (page === "") expect(homeAnchors).toContain(entry.href);
        else expect(pages).toContain(entry.href);
      }
  });

  it("counts every entry once", () => {
    expect(catalogCount).toBe(siteCatalog.reduce((sum, group) => sum + group.entries.length, 0));
    expect(siteCatalog.find((group) => group.id === "site")?.entries).toHaveLength(recipeCatalog.length);
  });
});
