// @vitest-environment node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, test } from "vitest";

import * as rootApi from "../src/index";
import { WebGLRuntime, WebGLTarget } from "../src/react";

describe("public entrypoints and SSR", () => {
  test("imports utilities and React components without browser globals", () => {
    expect(typeof window).toBe("undefined");
    expect(typeof document).toBe("undefined");
    expect(rootApi.measureDOMText).toBeTypeOf("function");
    expect(rootApi.createDOMTextTexture).toBeTypeOf("function");
    expect(WebGLRuntime).toBeTypeOf("function");
  });

  test("renders semantic targets on the server before WebGL exists", () => {
    const html = renderToString(
      createElement(WebGLRuntime, {
        children: createElement(WebGLTarget, {
          id: "headline",
          hideWhenReady: true,
          children: createElement(
            "h1",
            { id: "headline" },
            "Read before rendering",
          ),
        }),
      }),
    );
    expect(html).toContain('<h1 id="headline">Read before rendering</h1>');
    expect(html).not.toContain("opacity:0");
    expect(html).not.toContain("visibility:hidden");
  });

  test("exports only the root utilities and React subpath", () => {
    const pkg = JSON.parse(
      readFileSync(
        resolve(process.cwd(), "packages/dom-webgl-runtime/package.json"),
        "utf8",
      ),
    );
    expect(pkg.name).toBe("@viselora/dom-webgl");
    expect(pkg.exports).toEqual({
      ".": { types: "./dist/index.d.ts", import: "./dist/index.js" },
      "./react": { types: "./dist/react.d.ts", import: "./dist/react.js" },
    });
  });
});
