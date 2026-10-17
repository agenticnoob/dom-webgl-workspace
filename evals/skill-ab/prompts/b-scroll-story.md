# Task B: Scroll-driven 3D story

Build a scroll-driven 3D narrative page with three chapters. Each chapter is a
`<section>` at least one viewport tall with a heading and a paragraph, marked
`data-testid="chapter-1"`, `data-testid="chapter-2"` and
`data-testid="chapter-3"`.

A single 3D scene stays fixed behind the text. As the reader scrolls through
the chapters, the scene changes in a clearly visible way (for example camera
position, object arrangement, colors), so each chapter looks different.

The 3D state must be fully determined by the scroll position: scrolling back up
to a chapter must restore exactly the look it had when scrolling down, and there
must be no time-based idle animation. Resizing the window at any scroll
position must keep the scene and progress correct.
