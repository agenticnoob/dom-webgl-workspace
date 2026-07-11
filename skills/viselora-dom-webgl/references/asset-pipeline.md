# Asset Pipeline

Compatible package version: 0.1.0-alpha.0

## Contents

- [Inventory and freeze](#inventory-and-freeze)
- [Required provenance](#required-provenance)
- [Per-kind metadata](#per-kind-metadata)
- [Deployment gate](#deployment-gate)

## Inventory and freeze

Inventory existing project assets first. Generate or search for missing assets
only after their story-beat purpose is known. Save every production asset under
the consumer's public/static tree before implementation. Enforce a no production hotlink
rule: remote URLs may identify provenance, but `localPath` must be local and
stable.

## Required provenance

Record the asset id, kind, local path, story beat ids, purpose, source URL,
author, license, deployment rights, modifications, technical metadata,
fallback, and meaningful alt text or equivalent description. Use an asset only
when its rights cover the intended deployment.

User-provided assets without confirmed rights may be marked
`local-validation-only`. Do not ship or pass public-deployment verification
until the license is confirmed.

## Per-kind metadata

- Image: intrinsic width/height, optimized local format, DOM image fallback.
- Video: duration, dimensions, local poster, semantic fallback, autoplay
  rejection behavior, and network-error behavior.
- GLB: source, clips, compression, decoder path/assets, bounds or dimensions,
  and poster or text fallback. `ready`/`active` is not pixel evidence.
- Image sequence: frame count, naming pattern, dimensions, start frame,
  progress range, first-frame fallback, and bounded cache budget.
- Font: family, weights, formats, license, local files, and system fallback.

## Deployment gate

Before code completion, verify every manifest `localPath` exists, every source
and author is recorded, every license permits deployment, every asset has a
fallback, and every selected dynamic beat names direct browser evidence. Reject
`http://` or `https://` local paths and `local-validation-only` assets in public
deployment mode.
