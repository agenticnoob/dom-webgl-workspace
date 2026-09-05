import type {
  WebGLEffectMaterialProgram,
  WebGLEffectUniformValue,
} from "@viselora/dom-webgl";
import type { AxiomsArtwork } from "./artwork";
import type { AxiomsTexture } from "./texture";
import { axiomsReaderConfig } from "./config";
import type { AxiomsFrame, AxiomsSheetFrame } from "./frame";
import { heroTransitionConfig } from "../transition/transitionConfig";
import { resolveAxiomsStamp } from "./stamp";

export function createAxiomsProgram(
  artwork: AxiomsArtwork,
  texture: AxiomsTexture,
  frame: AxiomsFrame,
): WebGLEffectMaterialProgram {
  const articleCount = artwork.papers.length;
  const sheetCount = Math.max(1, articleCount * 2);
  const stamps = artwork.layout.papers.map((paper) =>
    resolveAxiomsStamp(paper.width, paper.height),
  );
  return {
    blend: "normal",
    uniforms: {
      ...createAxiomsUniforms(artwork, frame, false),
      inkAtlas: { kind: "canvas-texture", source: texture.canvas },
      atlasSize: [
        texture.cellWidth * texture.columns,
        texture.cellHeight * texture.rows,
      ],
      tileOrigins: texture.tileOrigins,
      tileSizes: texture.tiles.map((tile) => [tile.width, tile.height]),
      stampPitches: stamps.length
        ? stamps.map((stamp) => [stamp.pitchX, stamp.pitchY])
        : [[1, 1]],
      stampRadii: stamps.length
        ? stamps.map((stamp) => [stamp.radius, 0])
        : [[0, 0]],
    },
    fragmentShader: `
      uniform sampler2D inkAtlas;
      uniform vec2 atlasSize;
      uniform vec2 tileOrigins[${texture.tiles.length}];
      uniform vec2 tileSizes[${texture.tiles.length}];
      uniform vec2 viewport;
      uniform vec4 headerRect;
      uniform vec2 origins[${sheetCount}];
      uniform vec2 sizes[${sheetCount}];
      uniform vec2 motions[${sheetCount}];
      uniform vec2 scrolls[${sheetCount}];
      uniform vec2 stampPitches[${Math.max(1, articleCount)}];
      uniform vec2 stampRadii[${Math.max(1, articleCount)}];
      uniform vec3 backgroundColor;
      uniform vec3 foregroundColor;
      uniform float fanTop;
      varying vec2 vUv;

      float ink(int index, vec2 p) {
        if (p.x < 0.0 || p.y < 0.0 || p.x >= tileSizes[index].x || p.y >= tileSizes[index].y) return 0.0;
        vec2 uv = (tileOrigins[index] + p) / atlasSize;
        return texture2D(inkAtlas, vec2(uv.x, 1.0 - uv.y)).a;
      }

      vec3 sheet(vec3 underneath, vec2 pixel, int index, vec3 background, vec3 foreground) {
        vec4 box = vec4(origins[index], sizes[index]);
        vec4 state = vec4(motions[index], scrolls[index]);
        if (state.y < 0.5) return underneath;
        float c = cos(state.x), s = sin(state.x);
        vec2 delta = pixel - box.xy - box.zw * 0.5;
        vec2 p = vec2(c * delta.x + s * delta.y, -s * delta.x + c * delta.y) + box.zw * 0.5;
        float edge = min(min(p.x, p.y), min(box.z - p.x, box.w - p.y));
        bool fan = index < ${articleCount};
        if (!fan) {
          vec3 stamp = vec3(stampPitches[index - ${articleCount}], stampRadii[index - ${articleCount}].x);
          vec2 centers = mod(p, stamp.xy) - stamp.xy * 0.5;
          float horizontalHole = length(vec2(centers.x, min(p.y, box.w - p.y)));
          float verticalHole = length(vec2(min(p.x, box.z - p.x), centers.y));
          edge = min(edge, min(horizontalHole, verticalHole) - stamp.z);
        }
        float coverage = smoothstep(-0.65, 0.65, edge);
        if (coverage <= 0.0) return underneath;
        float fill = fan ? state.w : 1.0;
        vec3 paper = mix(background, foreground, fill);
        vec3 pen = mix(foreground, background, fill);
        vec2 textPoint = fan ? p * tileSizes[index + 1] / box.zw : p + vec2(0.0, state.z);
        float glyph = ink(index + 1, textPoint);
        vec3 color = mix(paper, pen, glyph);
        color = mix(fan ? foreground : background, color, smoothstep(0.8, 1.8, edge));
        return mix(underneath, color, coverage);
      }

      void main() {
        vec2 pixel = vec2(vUv.x, 1.0 - vUv.y) * viewport;
        vec3 background = backgroundColor;
        vec3 foreground = foregroundColor;
        vec3 color = background;
        if (pixel.y >= fanTop) {
          for (int i = 0; i < ${articleCount}; i++) color = sheet(color, pixel, i, background, foreground);
        }
        // Later articles arrive above the full-sized earlier papers.
        for (int i = ${articleCount}; i < ${articleCount * 2}; i++) color = sheet(color, pixel, i, background, foreground);
        float heading = ink(0, pixel - headerRect.xy);
        color = mix(color, foreground, heading);
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  };
}

export function createAxiomsUniforms(
  artwork: AxiomsArtwork,
  frame: AxiomsFrame,
  inverted: boolean,
): Record<string, WebGLEffectUniformValue> {
  const sheets = [...frame.fans, ...frame.papers];
  const origin = ({ rect: r }: AxiomsSheetFrame): [number, number] => [
    r.x,
    r.y,
  ];
  const size = ({ rect: r }: AxiomsSheetFrame): [number, number] => [
    r.width,
    r.height,
  ];
  const scrolls = sheets.map((sheet, i): [number, number] => {
    const paperIndex = i - frame.fans.length;
    const overflow =
      paperIndex < 0
        ? 0
        : Math.max(
            0,
            artwork.papers[paperIndex].height -
              artwork.layout.papers[paperIndex].height,
          );
    return [
      overflow * sheet.scroll,
      paperIndex < 0 && i === frame.selected ? 1 : 0,
    ];
  });
  const header = artwork.layout.header;
  return {
    viewport: [artwork.layout.viewport.width, artwork.layout.viewport.height],
    headerRect: [header.x, header.y, header.width, header.height],
    origins: sheets.length ? sheets.map(origin) : [[0, 0]],
    sizes: sheets.length ? sheets.map(size) : [[0, 0]],
    motions: sheets.length
      ? sheets.map((sheet): [number, number] => [
          sheet.angle,
          Number(sheet.visible),
        ])
      : [[0, 0]],
    scrolls: sheets.length ? scrolls : [[0, 0]],
    backgroundColor: color(
      inverted
        ? heroTransitionConfig.colors.light
        : heroTransitionConfig.colors.dark,
    ),
    foregroundColor: color(
      inverted
        ? heroTransitionConfig.colors.dark
        : heroTransitionConfig.colors.light,
    ),
    fanTop: artwork.layout.paperArea.y - axiomsReaderConfig.fan.clipInset,
  };
}

function color(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [
    ((value >> 16) & 255) / 255,
    ((value >> 8) & 255) / 255,
    (value & 255) / 255,
  ];
}
