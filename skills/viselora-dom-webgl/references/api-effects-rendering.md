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

Known issue in 0.2.0-alpha.0: `drawDOMText` (and therefore
`createDOMTextTexture`) draws each line at the top of its line box with
`textBaseline = "top"` and ignores CSS half-leading. The texture sits higher
than the DOM glyphs by roughly `(lineHeight - contentHeight) / 2` (about 11px
at 72px with `line-height: normal`, 22px with `1.5`). Use
`createAlignedTextTexture` from [TextWave.tsx](../recipes/TextWave.tsx), which
draws `measureDOMText` lines on the CSS baseline, and set an explicit
line-height. The repository source contains an unreleased fix (alphabetic
baseline with half-leading; `glyph.baseline` becomes the real baseline while
`glyph.y` stays the line-box top); the published alpha still has the offset.

`target.revision` is a mutable counter, not React state. Poll it in `useFrame`,
copy changes into state and rebuild the texture in an effect; dispose the old
texture after the new one is committed.

## Native effects

Use mesh/material refs and `useFrame` directly. R3F delta is in seconds.
Recent R3F 9 releases copy `uniforms` prop values into the ShaderMaterial's own uniforms, so
animate `materialRef.current.uniforms`, not the object passed as a prop. Use
`invalidate()` for external updates under demand rendering. Canvas, clearing
and texture uploads remain explicit Three.js/R3F operations; after drawing a
custom canvas set its texture's `needsUpdate` to true.
