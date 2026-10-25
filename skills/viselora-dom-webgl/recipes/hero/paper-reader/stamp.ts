import { paperReaderConfig } from "./config";

export function resolvePaperReaderStamp(width: number, height: number) {
  const config = paperReaderConfig.stamp;
  const scale = Math.max(
    config.minimumScale,
    Math.min(1, width / config.referenceWidth),
  );
  const columns = Math.max(1, Math.round(width / (config.pitch * scale)));
  const rows = Math.max(1, Math.round(height / (config.pitch * scale)));
  return {
    columns,
    rows,
    pitchX: width / columns,
    pitchY: height / rows,
    radius: Math.min(
      config.radius * scale,
      width / columns / 3,
      height / rows / 3,
    ),
  };
}
