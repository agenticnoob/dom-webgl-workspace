# Assets

Inventory the consumer's local assets before replacing them. Keep source,
author, license/deployment rights, changes, dimensions and fallback in an
[asset manifest](../templates/asset-manifest.json) when new reusable assets are
introduced. Preserve private assets outside Git unless explicitly approved.

Use app-owned local URLs for production visuals. Models and media use native
Three.js/R3F/Drei loaders. Confirm actual decode/render behavior in the browser;
a successful HTTP request is not proof of a usable GLB or video.
