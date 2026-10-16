# Task C: DOM text rendered as a WebGL wave

Build a hero page whose main heading is
`<h1 data-testid="wave-text">Words that ripple through light</h1>`, followed by
a paragraph and at least one more full-height section below it.

Render the heading's text in WebGL from the DOM text itself (matching its font,
size, color, line wrapping and on-screen position) and animate it with a
continuous wave distortion. The WebGL text must stay aligned with the DOM
heading while scrolling and must re-layout correctly when the window is resized
(the line wrapping may change).

The DOM heading remains the accessible, semantic text. It stays visible until
the WebGL version is actually rendered and whenever WebGL is unavailable; you
may visually hide it only while the WebGL text is shown.
