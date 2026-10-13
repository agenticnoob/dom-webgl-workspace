import type { SpatialStage } from "./stage";
import type {
  FourFaces,
  PortalChapter,
  ReliefModel,
  SpatialMotion,
  SpatialPalette,
} from "./types";

export type SpatialEffectParams = {
  readonly stage: SpatialStage;
  readonly palette: SpatialPalette;
  readonly motion: SpatialMotion;
  readonly chapters?: FourFaces<PortalChapter>;
  readonly relief?: ReliefModel;
  readonly holdMs?: number;
};
