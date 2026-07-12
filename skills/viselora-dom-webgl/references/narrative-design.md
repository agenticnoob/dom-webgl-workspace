# Narrative Design

Compatible package version: 0.1.0-alpha.1

## Contents

- [Establish the brief](#establish-the-brief)
- [Compare directions](#compare-directions)
- [Define story beats](#define-story-beats)
- [Review the complete narrative](#review-the-complete-narrative)

## Establish the brief

Collect or infer the audience, core message, desired outcome, tone and visual
direction, expected page length, interaction density, and existing assets.
Record accessibility, mobile, performance, and reduced motion constraints
before choosing an effect or API.

## Compare directions

When the direction is ambiguous, propose 2–3 materially different narrative
directions and recommend one. Compare message clarity, asset needs, capability
risk, interaction density, mobile behavior, and production effort. Stop for
direction confirmation only when the choice materially changes scope; otherwise
state the recommendation and continue.

Useful planning patterns include chronology, journey, problem-to-solution,
layered product reveal, state transformation, comparison, and spatial
exploration. They structure the story; they are not runtime exports.

## Define story beats

Create 4–8 beats unless the brief clearly requires a different size. For every
beat record:

- the message advance and semantic DOM/fallback;
- entrance, active, and exit states;
- media or managed-scene owner;
- scroll owner and progress range;
- at most one primary interaction by default;
- mobile and reduced motion behavior;
- selected capability id and versioned status;
- local asset ids;
- a direct browser assertion, using final-canvas pixels for dynamic WebGL.

Hover must never carry unique meaning. Add touch or scroll parity. Keep buttons,
links, inputs, and navigation as accessible DOM controls.

## Review the complete narrative

Before implementation, read the beats in page order and confirm that each one
advances the core message. Check pacing, legibility, interaction clarity,
fallback continuity, mobile layout, reduced motion, asset readiness, and
capability status. After implementation, repeat the review in real browsers at
desktop and mobile widths rather than judging isolated components only.
