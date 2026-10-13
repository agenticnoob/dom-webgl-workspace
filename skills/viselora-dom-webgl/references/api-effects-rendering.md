# Effects and text

## DOM text tools

`measureDOMText(element, options?)` returns CSS dimensions, typography, wrapped
lines and indexed glyphs. `drawDOMText(context, layout, commands?)` draws in CSS
pixels, with glyph substitution, displacement, opacity, scale, rotation and
color. Glyph y is its top, not its baseline.

`createDOMTextTexture(element, { devicePixelRatio? })` returns a native
CanvasTexture, CSS width/height and `dispose()`. The raster is capped at 2x DPR,
sRGB, linearly filtered, without mipmaps. Own its disposal and recreate it when
content or target revision changes.

## Native effects

Use mesh/material refs and `useFrame` directly. R3F delta is in seconds. Use
`invalidate()` for external updates under demand rendering. Canvas, clearing
and texture uploads remain explicit Three.js/R3F operations; after drawing a
custom canvas set its texture's `needsUpdate` to true.
