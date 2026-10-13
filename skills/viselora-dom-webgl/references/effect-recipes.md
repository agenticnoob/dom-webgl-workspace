# Native visual recipes

Use the [runnable template](../templates/react-vite/) for DOM-to-scene placement
with one Canvas. Useful building blocks are native R3F mesh/material components,
`useFrame`, `useThree`, `useLoader`, and Drei helpers selected for the task.

For text waves/scramble/pressure, measure indexed glyphs with `measureDOMText`,
draw transformed commands with `drawDOMText`, and mark the native texture dirty.
For images/video use native textures, preserving DOM fallback while loading.
For GLB animation use native model instances and animation mixers/helpers.

Keep application visual math and shaders in the consumer. Avoid wrapping every
native object in a new generic facade or recovering retired 0.1.x declarations.
