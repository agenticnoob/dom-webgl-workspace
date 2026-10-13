import { vi } from "vitest";

export function createCanvasContext() {
  return {
    canvas: document.createElement("canvas"),
    font: "16px sans-serif",
    letterSpacing: "0px",
    measureText: vi.fn((text: string) => ({
      width: Array.from(text).length * 8,
      actualBoundingBoxAscent: 12,
      actualBoundingBoxDescent: 4,
    })),
    setTransform: vi.fn(),
    scale: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    strokeText: vi.fn(),
    drawImage: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    arc: vi.fn(),
    arcTo: vi.fn(),
    roundRect: vi.fn(),
    quadraticCurveTo: vi.fn(),
    bezierCurveTo: vi.fn(),
    clip: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    fillStyle: "",
    strokeStyle: "",
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    shadowBlur: 0,
  };
}

export function installCanvasContext() {
  const context = createCanvasContext();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    function (this: HTMLCanvasElement, id: string) {
      if (id !== "2d") return null;
      context.canvas = this;
      return context as unknown as CanvasRenderingContext2D;
    },
  );
  return context;
}
