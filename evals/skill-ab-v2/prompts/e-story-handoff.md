# Task E: Scroll story that hands the page back to the DOM

Build a page with a short intro section, then a scroll-driven 3D story of four
chapters, then an ordinary page section.

- The chapters are four `<section>` elements, each at least one viewport tall
  with a heading and a paragraph, marked `data-testid="chapter-1"` …
  `data-testid="chapter-4"`. One 3D scene stays fixed behind the chapter text
  while the story is on screen and changes in a clearly visible way at every
  chapter (for example camera position, object arrangement, colors), so all
  four chapters look different.
- The 3D state is fully determined by the scroll position: scrolling back to a
  chapter restores exactly the look it had when scrolling down, and there is no
  time-based idle animation. Resizing the window at any scroll position keeps
  the scene and progress correct.
- Hand-off: after chapter 4 the story ends and the page continues with a regular
  `<section data-testid="outro">` containing a heading, a paragraph and a link.
  While the outro is on screen no 3D content is drawn over it: it reads as a
  normal page and its link can be clicked. Scrolling back up re-enters the story
  in chapter 4's look.
