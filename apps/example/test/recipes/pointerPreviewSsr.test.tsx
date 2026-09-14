// @vitest-environment node
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { PointerPreviewDirectory } from "../../src/recipes/pointer-preview";

test("renders a complete linked directory without window, WebGL, or hydration", () => {
  const html = renderToStaticMarkup(
    createElement(PointerPreviewDirectory, {
      title: "Collection",
      items: [
        {
          id: "one",
          title: "First",
          description: "Full reading text",
          href: "/first",
          image: {
            src: "/first.png",
            alt: "First diagram",
            width: 800,
            height: 600,
          },
        },
      ],
    }),
  );
  expect(html).toContain("Collection");
  expect(html).toContain("Full reading text");
  expect(html).toContain('href="/first"');
  expect(html).toContain('alt="First diagram"');
  expect(html).not.toContain("recipe-preview__floating");
});
