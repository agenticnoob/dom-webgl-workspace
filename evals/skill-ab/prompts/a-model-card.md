# Task A: 3D model that follows a DOM card

Build a product landing page with at least three full-height sections. In the
second section, place a product card (`data-testid="product-card"`) with a
title, a short description and a call-to-action link.

A 3D model, loaded from `/models/hero.glb` (already in `public/models/`), is
rendered in WebGL so that it sits inside the card and follows the card's
on-screen position and size while the page scrolls and when the window is
resized. A gentle idle rotation is welcome.

Inside the card, a DOM fallback (`data-testid="model-fallback"`, for example a
styled placeholder with descriptive text) must stay visible while the model is
loading, if the model fails to load, and if WebGL is unavailable. Once the model
is actually rendered you may visually hide the fallback, but it must remain in
the DOM.
