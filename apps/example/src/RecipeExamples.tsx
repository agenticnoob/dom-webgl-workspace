import React, { type ComponentType } from "react";
import { EffectDescription } from "./EffectDescription";
import PaperReaderDemo from "./recipe-demos/PaperReaderDemo";
import ProjectRoomDemo from "./recipe-demos/ProjectRoomDemo";
import ModelStoryDemo from "./recipe-demos/ModelStoryDemo";
import PointerPreviewDemo from "./recipe-demos/PointerPreviewDemo";
import PerspectiveTimelineDemo from "./recipe-demos/PerspectiveTimelineDemo";
import {
  SculptureDemo,
  RadialThemeDemo,
  FacePortalDemo,
  ReliefPortalDemo,
} from "./recipe-demos/SpatialDemos";
import { paperReaderEffects } from "./recipes/paper-reader";
import { projectRoomEffects } from "./recipes/project-room";
import { modelStoryEffects } from "./recipes/model-story";
import { spatialEffects } from "./recipes/spatial";
import { perspectiveTimelineEffects } from "./recipes/perspective-timeline";
import { recipeCatalog, type RecipeId } from "./recipes/catalog";
import "./recipe-examples.css";

/** Register once in the same runtime that owns the basic examples. */
export const recipeEffects = [
  ...paperReaderEffects,
  ...projectRoomEffects,
  ...modelStoryEffects,
  ...spatialEffects,
  ...perspectiveTimelineEffects,
];

const demos = {
  "paper-reader": PaperReaderDemo,
  "project-room": ProjectRoomDemo,
  sculpture: SculptureDemo,
  "radial-theme": RadialThemeDemo,
  "model-story": ModelStoryDemo,
  "face-portal": FacePortalDemo,
  "relief-portal": ReliefPortalDemo,
  "pointer-preview": PointerPreviewDemo,
  "perspective-timeline": PerspectiveTimelineDemo,
} satisfies Record<RecipeId, ComponentType>;

export function RecipeExamples() {
  return (
    <>
      {recipeCatalog.map((recipe) => {
        const Demo = demos[recipe.id];
        return (
          <section
            key={recipe.id}
            id={recipe.id}
            className="example-row recipe-example"
            aria-label={recipe.title}
          >
            <div className="recipe-example-description">
              <EffectDescription source={recipe.title} title={recipe.component}>
                {recipe.description}
                <br />
                源码与接入说明：
                <code>apps/example/src/recipes/{recipe.module}/README.md</code>
                {recipe.effects && (
                  <>
                    <br />
                    在共享 runtime 注册 <code>{recipe.effects}</code>。
                  </>
                )}
              </EffectDescription>
            </div>
            <Demo />
          </section>
        );
      })}
    </>
  );
}
