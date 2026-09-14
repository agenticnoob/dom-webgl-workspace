import React from "react";
import {
  FacePortal,
  InteractiveSculpture,
  type FourFaces,
  type PortalChapter,
  type ReliefModel,
} from "../recipes/spatial";

const chapters = [
  {
    id: "observe",
    entry: {
      label: "01 / OBSERVE",
      title: "Start with a closer look.",
      description:
        "A surface can hold an idea. Scroll toward it and the idea becomes a place you can read.",
    },
    paragraphs: [
      "A familiar shape becomes an entrance. Its typography stays attached to the face while the object moves through space.",
      "At the end of the approach, the same composition becomes ordinary HTML. You can select these words, pause, and follow a link.",
    ],
    exit: {
      label: "01 / CONTINUE",
      title: "Take the observation with you.",
      description:
        "Reverse the scroll to follow the same path back through the surface.",
    },
    link: {
      href: "https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API",
      label: "Explore WebGL",
    },
  },
  {
    id: "question",
    entry: {
      label: "02 / QUESTION",
      title: "Give a question some space.",
      description:
        "Each face carries its own content, drawn from the same data as the semantic document.",
    },
    paragraphs: [
      "The geometry, camera, texture, and scrolling progress have separate responsibilities. Their shared boundary is the point where the screen composition matches the document.",
    ],
    exit: {
      label: "02 / REFLECT",
      title: "Keep the useful questions.",
      description:
        "The exit carries the end of this chapter back onto the object.",
    },
  },
  {
    id: "make",
    entry: {
      label: "03 / MAKE",
      title: "Make something tangible.",
      description:
        "A sketch or a small prototype turns an abstract question into something people can examine.",
    },
    paragraphs: [
      "Small components are easier to understand when their inputs are explicit. Replace this chapter's content without changing its transition or shader.",
    ],
    exit: {
      label: "03 / REFINE",
      title: "Leave room for another version.",
      description:
        "Forward and backward movement use the same geometric mapping.",
    },
  },
  {
    id: "share",
    entry: {
      label: "04 / SHARE",
      title: "Let the work travel.",
      description:
        "Four faces, one managed scene, and a document that remains readable on its own.",
    },
    paragraphs: [
      "Use the complete-text control at any point to read the semantic document without the long spatial transitions.",
    ],
    exit: {
      label: "04 / RETURN",
      title: "There is always another viewpoint.",
      description:
        "The object returns with all four chapters still on its faces.",
    },
  },
] satisfies FourFaces<PortalChapter>;
const model = {
  src: "/models/hero.glb",
  center: [-0.8943670988082886, 12.65780508518219, -0.4819256067276001],
  size: 23.218835592269897,
  bodyScale: 1.3,
} satisfies ReliefModel;

export function SculptureDemo() {
  return (
    <InteractiveSculpture
      id="demo.sculpture"
      title="A small object, alive with light."
      description="Move the pointer to explore damped parallax and a local light. Breathing and floating share the managed render loop."
    />
  );
}
export function RadialThemeDemo() {
  return (
    <InteractiveSculpture
      id="demo.radial"
      title="Hold to change the atmosphere."
      description="Press and hold the actual tetrahedron. Release early to reverse the circle; keep holding to commit one colour change."
      holdMs={1000}
    />
  );
}
export function FacePortalDemo() {
  return <FacePortal id="demo.portal" chapters={chapters} />;
}
export function ReliefPortalDemo() {
  return <FacePortal id="demo.relief" chapters={chapters} model={model} />;
}
