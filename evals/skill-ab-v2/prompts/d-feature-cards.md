# Task D: Interactive 3D feature cards

Build a features page: a heading, an intro paragraph and a grid of four feature
cards, followed by at least one more full-height section. Each card is marked
`data-testid="feature-card-1"` … `data-testid="feature-card-4"` and contains a
title, a one-sentence description and a "Learn more" link. The cards stay
ordinary DOM elements.

Each card shows its own small 3D object (all four different, for example
different shapes or colors) rendered in WebGL so that it sits inside its card
and follows the card's on-screen position and size when the page scrolls and
when the window is resized (the grid may reflow into fewer columns).

When a card is hovered with the mouse, or when the card or its link receives
keyboard focus, that card's 3D object reacts in a clearly visible way (for
example it scales up, changes color or tilts) and returns to its resting look
when the pointer leaves or focus moves away. The other cards' objects do not
react. Apart from this reaction and its transition the objects stay still: no
idle animation.
