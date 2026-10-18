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

Glyph `y` is the top of its line box and `baseline` is the CSS alphabetic
baseline, including half-leading. Since 0.2.0-alpha.1 both helpers draw on that
baseline, so textures line up with the DOM text; 0.2.0-alpha.0 drew text
about half the leading too high.

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
