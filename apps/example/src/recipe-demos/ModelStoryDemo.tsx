import React from "react";

import {
  ModelStory,
  type ModelStoryModel,
  type ModelStorySection,
} from "../recipes/model-story";

const model = {
  src: "/models/hero.glb",
  description: "A standing figure, viewed from the front, side, and back.",
  framing: {
    center: [-0.8943670988082886, 12.65780508518219, -0.4819256067276001],
    size: [4.571339190006256, 23.218835592269897, 5.446040630340576],
  },
} satisfies ModelStoryModel;

const sections = [
  {
    id: "first-impression",
    heading: "Every angle tells a story.",
    side: "left",
    paragraphs: [
      "A familiar silhouette gives us a place to begin. From the front, the figure feels balanced and still. We notice its shape before we notice its details.",
      "Take your time with the page. The scene changes at the same pace as your reading, leaving room to pause wherever something catches your attention.",
    ],
  },
  {
    id: "side-view",
    heading: "A different perspective.",
    side: "right",
    paragraphs: [
      "Move around an object and its outline changes. What looked broad becomes narrow. A small surface reveals depth that was hidden a moment before.",
      "The words gather around the figure as you pass. Each line finds a little more room near the shoulders, and comes back toward the center below them.",
    ],
  },
  {
    id: "back-view",
    heading: "Notice what was hidden.",
    side: "left",
    paragraphs: [
      "The back is part of the same object, yet it offers another reading. Looking closely means making space for the things we did not see at first.",
      "Scroll back whenever you like. Nothing has to restart: the figure, the captions, and the surrounding words return along the same path.",
    ],
  },
  {
    id: "return",
    heading: "Back where we began.",
    side: "right",
    paragraphs: [
      "One complete turn brings us to the starting view. The object has not changed, but our sense of it has become a little more complete.",
      "This small journey works with any model whose form deserves a closer look: a crafted object, a character, or a piece of an imagined world.",
    ],
  },
] satisfies readonly ModelStorySection[];

const messages = {
  front: "A familiar place to begin.",
  side: "There is more to this shape.",
  back: "A view you have not seen yet.",
};

export function ModelStoryDemo() {
  return (
    <ModelStory
      id="demo.model-story"
      title="Around a single figure"
      model={model}
      sections={sections}
      messages={messages}
    />
  );
}

export default ModelStoryDemo;
