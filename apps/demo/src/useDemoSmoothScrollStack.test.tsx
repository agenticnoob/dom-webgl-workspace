import { act, createElement, StrictMode } from "react";
import type { LenisGsapScrollStack } from "@project/dom-webgl-scroll-adapters";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const lenisInstances: MockLenis[] = [];

type SmoothScrollHook = () => LenisGsapScrollStack | null;

class MockLenis {
  readonly scroll = 0;
  readonly limit = 1000;
  readonly raf = vi.fn();
  readonly destroy = vi.fn(() => {
    document.documentElement.classList.remove("lenis");
  });
  readonly on = vi.fn((_event: "scroll", _listener: () => void) => () => {});

  constructor(readonly options: unknown) {
    lenisInstances.push(this);
    document.documentElement.classList.add("lenis");
  }
}

vi.mock("lenis", () => ({
  default: MockLenis,
}));

function Harness({ useHook }: { useHook: SmoothScrollHook }) {
  const smoothScroll = useHook();

  return createElement("div", {
    "data-ready": smoothScroll ? "true" : "false",
  });
}

describe("useDemoSmoothScrollStack", () => {
  const roots: Root[] = [];

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterEach(() => {
    for (const root of roots.splice(0)) {
      act(() => {
        root.unmount();
      });
    }
    lenisInstances.length = 0;
    document.documentElement.className = "";
    document.body.replaceChildren();
  });

  test("keeps the final Lenis instance active under StrictMode", async () => {
    const { useDemoSmoothScrollStack } = await import("./useDemoSmoothScrollStack");
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    roots.push(root);

    await act(async () => {
      root.render(
        createElement(
          StrictMode,
          null,
          createElement(Harness, { useHook: useDemoSmoothScrollStack }),
        ),
      );
    });
    await flushFrame();

    expect(host.firstElementChild?.getAttribute("data-ready")).toBe("true");
    expect(document.documentElement.classList.contains("lenis")).toBe(true);
    expect(lenisInstances.at(-1)?.options).toMatchObject({
      autoRaf: false,
      lerp: 0.055,
      smoothWheel: true,
      touchMultiplier: 1,
      wheelMultiplier: 0.85,
    });
    expect(lenisInstances.at(-1)?.destroy).not.toHaveBeenCalled();
  });

  test("destroys the app-owned Lenis instance on unmount", async () => {
    const { useDemoSmoothScrollStack } = await import("./useDemoSmoothScrollStack");
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    roots.push(root);

    await act(async () => {
      root.render(createElement(Harness, { useHook: useDemoSmoothScrollStack }));
    });
    await flushFrame();

    const activeLenis = lenisInstances.at(-1);

    act(() => {
      root.unmount();
    });
    roots.pop();

    expect(activeLenis?.destroy).toHaveBeenCalledTimes(1);
    expect(document.documentElement.classList.contains("lenis")).toBe(false);
  });
});

async function flushFrame(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => window.requestAnimationFrame(resolve));
  });
}
