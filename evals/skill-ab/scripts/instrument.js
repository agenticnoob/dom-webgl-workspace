// Injected before any page script by grade.mjs (Playwright addInitScript).
// Counts WebGL contexts, window/document listeners, observers and rAF calls,
// forces preserveDrawingBuffer so the grader can read canvas pixels, and can
// simulate "WebGL unavailable" when window.__evalDisableWebGL is set, and can
// lose/restore the page's WebGL context.
(() => {
  const stats = {
    contextsCreated: 0,
    contextsLost: 0,
    raf: 0,
    glCanvases: new Set(),
    listeners: new Set(),
    observers: new Map(),
  };
  window.__evalStats = stats;

  const getContext = HTMLCanvasElement.prototype.getContext;
  const seen = new WeakSet();
  HTMLCanvasElement.prototype.getContext = function (type, attributes) {
    const isGL = /webgl/i.test(String(type));
    if (isGL && window.__evalDisableWebGL) return null;
    const context = getContext.call(
      this,
      type,
      isGL ? { ...(attributes ?? {}), preserveDrawingBuffer: true } : attributes,
    );
    if (isGL && context && !seen.has(context)) {
      seen.add(context);
      if (!attributes?.preserveDrawingBuffer) context.__evalEmulateClear = true;
      this.__evalContext = context;
      stats.contextsCreated += 1;
      stats.glCanvases.add(this);
      this.addEventListener("webglcontextlost", () => {
        stats.contextsLost += 1;
      });
    }
    return context;
  };

  const add = EventTarget.prototype.addEventListener;
  const remove = EventTarget.prototype.removeEventListener;
  const tracked = (target) => target === window || target === document;
  const keyOf = (target, type, listener, options) => {
    const capture =
      typeof options === "boolean" ? options : Boolean(options?.capture);
    for (const entry of stats.listeners)
      if (
        entry.target === target &&
        entry.type === type &&
        entry.listener === listener &&
        entry.capture === capture
      )
        return entry;
    return { target, type, listener, capture };
  };
  EventTarget.prototype.addEventListener = function (type, listener, options) {
    if (tracked(this) && listener) {
      const entry = keyOf(this, type, listener, options);
      if (!stats.listeners.has(entry)) {
        stats.listeners.add(entry);
        options?.signal?.addEventListener?.("abort", () =>
          stats.listeners.delete(entry),
        );
      }
      if (typeof options === "object" && options?.once) entry.once = true;
    }
    return add.call(this, type, listener, options);
  };
  EventTarget.prototype.removeEventListener = function (
    type,
    listener,
    options,
  ) {
    if (tracked(this) && listener)
      stats.listeners.delete(keyOf(this, type, listener, options));
    return remove.call(this, type, listener, options);
  };

  for (const name of ["ResizeObserver", "IntersectionObserver"]) {
    const Native = window[name];
    if (!Native) continue;
    window[name] = class extends Native {
      constructor(...rest) {
        super(...rest);
        stats.observers.set(this, new Set());
      }
      observe(target, ...rest) {
        stats.observers.get(this)?.add(target);
        return super.observe(target, ...rest);
      }
      unobserve(target) {
        stats.observers.get(this)?.delete(target);
        return super.unobserve(target);
      }
      disconnect() {
        stats.observers.get(this)?.clear();
        return super.disconnect();
      }
    };
  }

  // preserveDrawingBuffer keeps last frame's pixels, while a normal canvas
  // starts every presented frame cleared. Pages that clear only part of the
  // canvas (scissored views such as drei <View>) would otherwise show stale
  // pixels to the grader, so the first draw to the default framebuffer in each
  // animation frame first clears the whole buffer, as the browser would.
  let frameTime = -1;
  const fullClear = (gl, clear) => {
    const scissor = gl.isEnabled(gl.SCISSOR_TEST);
    const color = gl.getParameter(gl.COLOR_CLEAR_VALUE);
    const colorMask = gl.getParameter(gl.COLOR_WRITEMASK);
    const depth = gl.getParameter(gl.DEPTH_CLEAR_VALUE);
    const depthMask = gl.getParameter(gl.DEPTH_WRITEMASK);
    const stencil = gl.getParameter(gl.STENCIL_CLEAR_VALUE);
    const stencilMask = gl.getParameter(gl.STENCIL_WRITEMASK);
    if (scissor) gl.disable(gl.SCISSOR_TEST);
    gl.colorMask(true, true, true, true);
    gl.depthMask(true);
    gl.stencilMask(0xffffffff);
    gl.clearColor(0, 0, 0, 0);
    gl.clearDepth(1);
    gl.clearStencil(0);
    clear.call(gl, gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
    gl.clearColor(color[0], color[1], color[2], color[3]);
    gl.clearDepth(depth);
    gl.clearStencil(stencil);
    gl.colorMask(colorMask[0], colorMask[1], colorMask[2], colorMask[3]);
    gl.depthMask(depthMask);
    gl.stencilMask(stencilMask);
    if (scissor) gl.enable(gl.SCISSOR_TEST);
  };
  for (const Context of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
    if (!Context) continue;
    const clear = Context.prototype.clear;
    for (const name of ["clear", "drawArrays", "drawElements", "drawArraysInstanced", "drawElementsInstanced", "drawRangeElements"]) {
      const original = Context.prototype[name];
      if (!original) continue;
      Context.prototype[name] = function (...rest) {
        if (
          this.__evalEmulateClear &&
          this.__evalClearedAt !== frameTime &&
          !this.isContextLost() &&
          this.getParameter(this.FRAMEBUFFER_BINDING) === null
        ) {
          this.__evalClearedAt = frameTime;
          fullClear(this, clear);
        }
        return original.apply(this, rest);
      };
    }
  }

  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (callback) => {
    stats.raf += 1;
    return raf((time) => {
      frameTime = time;
      callback(time);
    });
  };

  window.__evalSnapshot = () => {
    let observed = 0;
    for (const targets of stats.observers.values()) observed += targets.size;
    const canvases = [...document.querySelectorAll("canvas")];
    return {
      canvasCount: canvases.length,
      glCanvasesConnected: [...stats.glCanvases].filter((c) => c.isConnected)
        .length,
      liveContexts: stats.contextsCreated - stats.contextsLost,
      contextsCreated: stats.contextsCreated,
      contextsLost: stats.contextsLost,
      listeners: [...stats.listeners].filter((entry) => !entry.once).length,
      listenerTypes: [...stats.listeners]
        .filter((entry) => !entry.once)
        .map((entry) => `${entry.target === window ? "window" : "document"}:${entry.type}`),
      observed,
      raf: stats.raf,
      bodyTextLength: document.body?.innerText.trim().length ?? 0,
    };
  };

  // Downsampled RGBA grid of the largest connected WebGL canvas, in viewport
  // coordinates (one cell = `cell` CSS pixels).
  window.__evalGrid = (cell = 2) => {
    const canvases = [...stats.glCanvases].filter((c) => c.isConnected);
    if (!canvases.length) return null;
    const canvas = canvases
      .map((c) => ({ c, r: c.getBoundingClientRect() }))
      .sort((x, y) => y.r.width * y.r.height - x.r.width * x.r.height)[0];
    const cols = Math.ceil(innerWidth / cell);
    const rows = Math.ceil(innerHeight / cell);
    const scratch = document.createElement("canvas");
    scratch.width = cols;
    scratch.height = rows;
    const context = scratch.getContext("2d", { willReadFrequently: true });
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    const { r } = canvas;
    try {
      context.drawImage(
        canvas.c,
        r.left / cell,
        r.top / cell,
        r.width / cell,
        r.height / cell,
      );
    } catch {
      return null;
    }
    return {
      cell,
      cols,
      rows,
      data: Array.from(context.getImageData(0, 0, cols, rows).data),
    };
  };

  // Simulate a GPU reset on the largest connected WebGL canvas
  // (WEBGL_lose_context), then restore it.
  window.__evalLoseContext = () => {
    const canvas = [...stats.glCanvases]
      .filter((c) => c.isConnected)
      .sort((x, y) => y.width * y.height - x.width * x.height)[0];
    const extension = canvas?.__evalContext?.getExtension("WEBGL_lose_context");
    if (!extension) return false;
    window.__evalLoseExtension = extension;
    extension.loseContext();
    return true;
  };
  window.__evalRestoreContext = () => {
    const extension = window.__evalLoseExtension;
    if (!extension) return false;
    try {
      extension.restoreContext();
      return true;
    } catch {
      return false;
    }
  };

  window.__evalVisible = (selector) => {
    const element = document.querySelector(selector);
    if (!element) return { exists: false, visible: false };
    const rect = element.getBoundingClientRect();
    let opacity = 1;
    let hidden = false;
    let ariaHidden = false;
    for (let node = element; node && node.nodeType === 1; node = node.parentElement) {
      const style = getComputedStyle(node);
      opacity *= Number(style.opacity);
      if (style.display === "none" || style.visibility === "hidden") hidden = true;
      if (node.getAttribute("aria-hidden") === "true") ariaHidden = true;
    }
    return {
      exists: true,
      visible: !hidden && opacity > 0.05 && rect.width > 0 && rect.height > 0,
      displayed: !hidden && rect.width > 0 && rect.height > 0,
      opacity,
      ariaHidden,
      text: element.textContent?.trim().slice(0, 200) ?? "",
      // Text nodes joined by spaces, so adjacent elements do not merge words.
      words: (() => {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        const parts = [];
        while (walker.nextNode()) parts.push(walker.currentNode.nodeValue);
        return parts.join(" ").replace(/\s+/g, " ").trim().slice(0, 400);
      })(),
      rect: {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      },
    };
  };
})();
