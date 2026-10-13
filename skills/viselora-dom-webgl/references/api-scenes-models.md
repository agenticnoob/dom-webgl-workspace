# Native scenes and models

Use native `<mesh>`, geometry, material, light and camera elements in the
runtime's `scene`. Use R3F `useLoader` or Drei `useGLTF`/`useAnimations` when they
fit the actual dependency set. There is no Viselora scene-object registry.

Cache entries can be shared. Use independent Object3D instances when one model
appears in multiple places. Share geometry/materials deliberately and avoid
disposing a cache entry while another instance uses it. Externally created
`<primitive>` objects and custom CanvasTextures are not automatically owned by
other components.

Use native R3F events and ecosystem controls. Add postprocessing or physics
only for a demonstrated consumer need; they are not runtime core features.
