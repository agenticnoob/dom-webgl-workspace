# DOM WebGL Workspace Design System

## 1. Atmosphere & Identity

The workspace UI should feel like a technical field notebook for a visual
runtime: direct, inspectable, and built around large live specimens rather than
decorative chrome. The signature is full-width effect rows where explanatory
copy collapses into a debug-panel-style pill on the WebGL target surface and
expands on click when the user wants details.

## 2. Color

### Palette

| Role | Token | Light | Dark | Usage |
|------|-------|-------|------|-------|
| Surface/primary | --color-surface-primary | #e9e4d6 | #172124 | Page background |
| Surface/raised | --color-surface-raised | rgba(255, 255, 255, 0.34) | rgba(255, 255, 255, 0.12) | Neutral example panels |
| Surface/gold | --color-surface-gold | rgba(246, 196, 83, 0.24) | rgba(246, 196, 83, 0.18) | Element snapshot example |
| Surface/coral | --color-surface-coral | rgba(217, 95, 66, 0.18) | rgba(217, 95, 66, 0.16) | Pulse/text accent example |
| Surface/video-bg | --color-surface-video-bg | #172124 | #172124 | Element snapshot video background example |
| Surface/ghost | --color-surface-ghost | #07050c | #07050c | Ghost cursor element snapshot example |
| Surface/ghost border | --color-surface-ghost-border | rgba(92, 72, 118, 0.5) | rgba(92, 72, 118, 0.5) | Ghost cursor card edge |
| Text/ghost | --color-text-ghost | #05030a | #05030a | Ghost cursor Boo text |
| Surface/waves | --color-surface-waves | #dbe5df | #26342f | Waves element snapshot example |
| Surface/model | --color-surface-model | #d7e1d6 | #27362d | GLB spin panel |
| Surface/model-alt | --color-surface-model-alt | #cdd6e8 | #283447 | GLB float panel |
| Surface/media | --color-surface-media | #1d2a2e | #1d2a2e | Media fallback background |
| Overlay/background | --color-overlay-bg | rgba(0, 0, 0, 0.68) | rgba(0, 0, 0, 0.68) | Collapsed description pill |
| Overlay/panel | --color-overlay-panel-bg | rgba(0, 0, 0, 0.82) | rgba(0, 0, 0, 0.82) | Expanded description panel |
| Overlay/text | --color-overlay-text | #f4f4f5 | #f4f4f5 | Overlay panel copy |
| Overlay/muted | --color-overlay-muted | #a1a1aa | #a1a1aa | Overlay metadata |
| Text/primary | --color-text-primary | #172124 | #f4efe2 | Page text |
| Border/default | --color-border-default | rgba(23, 33, 36, 0.32) | rgba(244, 239, 226, 0.28) | Panel borders |
| Border/subtle | --color-border-subtle | rgba(23, 33, 36, 0.18) | rgba(244, 239, 226, 0.16) | Row separators |
| Border/overlay | --color-border-overlay | rgba(255, 255, 255, 0.12) | rgba(255, 255, 255, 0.12) | Expanded description divider |

### Rules

- Keep example UI neutral so the WebGL output is the focal point.
- Use source-kind colors only on example targets, not as generic decoration.
- Add colors here before introducing new CSS color values.

## 3. Typography

### Scale

| Level | Size | Weight | Line Height | Tracking | Usage |
|-------|------|--------|-------------|----------|-------|
| Display | clamp(42px, 7vw, 96px) | 700 | 0.92 | 0 | Example title |
| H2 | clamp(28px, 3vw, 48px) | 700 | 0.95 | 0 | Expanded description titles |
| Body/lg | 18px | 400 | 1.35 | 0 | Row explanation |
| Body | 16px | 400 | 1.5 | 0 | Default text |
| Caption | 12px | 700 | 1.2 | 0 | Source kind labels |
| Panel/title | 30px | 700 | 1 | 0 | Large panel copy |

### Font Stack

- Primary: Georgia, "Times New Roman", serif
- Mono: ui-monospace, "SFMono-Regular", Menlo, monospace

### Rules

- Keep source kind and effect kind tokens in monospace.
- Do not use negative letter spacing in this project.

## 4. Spacing & Layout

### Base Unit

All spacing derives from a base of 4px.

| Token | Value | Usage |
|-------|-------|-------|
| --space-2 | 8px | Tight copy padding |
| --space-3 | 12px | Compact inline groups |
| --space-4 | 16px | Mobile row padding |
| --space-5 | 20px | Reserved row rhythm |
| --space-6 | 24px | Expanded description padding |
| --space-8 | 32px | Mobile intro padding |
| --space-10 | 40px | Desktop intro padding |
| --space-14 | 56px | Top intro padding |

### Grid

- Max content width: none for `apps/example`; rows intentionally span the full viewport.
- Column system: effect rows are single-column target surfaces with collapsible overlay descriptions.
- Breakpoints: mobile layout stacks at 760px.

### Rules

- `apps/example` has no outer shell padding. Each row owns its own overlay control spacing.
- Each example effect occupies one full-width row.

## 5. Components

### Effect Row

- **Structure**: `section.example-row` with one `.example-effect-pill` or expanded `.example-effect-panel` over one WebGL target.
- **Variants**: media, text, surface panel, model panel.
- **Spacing**: expanded description uses `--space-6`; mobile uses `--space-4`.
- **States**: collapsed pill, expanded description panel, focus, hover.
- **Accessibility**: DOM copy stays readable and source targets keep alt text when media is meaningful.
- **Motion**: visual motion is effect-owned, not CSS animation-owned.

## 6. Motion & Interaction

### Timing

| Type | Duration | Easing | Usage |
|------|----------|--------|-------|
| Runtime | frame-driven | runtime-owned | WebGL effect motion |
| Micro | 150ms | ease-out | Future focus/hover states |

### Rules

- Prefer runtime/effect motion over CSS animation for example visuals.
- CSS layout must not animate width, height, top, left, margin, or padding.

## 7. Depth & Surface

### Strategy

Use borders-only. Panels and rows use subtle borders to keep WebGL content and
DOM explanation visibly aligned without card shadows.
