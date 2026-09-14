import React from "react";
import { ProjectRoom, type ProjectRoomItems } from "../recipes/project-room";

const items = [
  {
    id: "archive",
    label: "COLLECTION",
    title: "Field archive",
    description:
      "A living index of sketches, references and small observations. Four walls hold four viewpoints on the same body of work.",
    href: "https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API",
    linkLabel: "Explore Canvas",
  },
  {
    id: "instrument",
    label: "INTERACTION",
    title: "Quiet instruments",
    description:
      "Interfaces that invite careful movement. The pointer approaches a boundary, the room turns, and a new idea comes into view.",
    href: "https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events",
    linkLabel: "Explore pointer events",
  },
  {
    id: "material",
    label: "EXPERIMENT",
    title: "Material studies",
    description:
      "A room built from projected light and typography. The semantic links remain ordinary, readable and reachable from the keyboard.",
    href: "https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API",
    linkLabel: "Explore WebGL",
  },
  {
    id: "commons",
    label: "OPEN WORK",
    title: "Shared foundations",
    description:
      "Small parts become useful when their ownership is clear. Replace these four entries to make a spatial index for your own collection.",
    href: "https://developer.mozilla.org/en-US/docs/Web/Accessibility",
    linkLabel: "Explore accessibility",
  },
] satisfies ProjectRoomItems;

export default function ProjectRoomDemo() {
  return (
    <ProjectRoom id="demo.project-room" items={items} title="Four viewpoints" />
  );
}
