import React from "react";
import { PaperReader, type PaperReaderArticle } from "../recipes/paper-reader";

const articles = [
  {
    id: "observe",
    label: "01 / FIELD NOTE",
    title: "Begin with observation",
    body: "A useful question begins with something concrete. Watch how a person reaches for a tool, where they pause, and what they do next. Record the sequence before interpreting it. A small observation can reveal a larger problem, but it needs context before it becomes a conclusion.",
    paper: { width: 0.96, height: 0.8 },
  },
  {
    id: "make",
    label: "02 / STUDIO NOTE",
    title: "Make one thing tangible",
    body: "Turn the question into an object that can be used. A sketch, a small prototype, or a written example gives everyone the same thing to discuss. Keep the first version small enough that changing it still feels easy.",
    paper: { width: 1, height: 0.7 },
  },
  {
    id: "read",
    label: "03 / READING NOTE",
    title: "Leave room for the whole story",
    body: "Some ideas fit on one sheet. Others need more room. This article deliberately contains more text than its visible paper can hold. Its reading segment moves the text inside the perforated edges before the next sheet begins to arrive.\n\nA good reading experience respects the order of an argument. An observation becomes a question; a question invites an experiment; an experiment produces evidence. None of these steps needs to happen quickly.\n\nScrolling backward returns to the same words and the same arrangement of paper. The earlier sheets keep their original size beneath the current one. Nothing is discarded when another thought comes into view.\n\nThe full text also remains available as ordinary HTML below the animated reader. It can be selected, copied, searched, and read with assistive technology.",
    paper: { width: 0.88, height: 0.72 },
  },
  {
    id: "return",
    label: "04 / NEXT EDITION",
    title: "Return with better questions",
    body: "A finished version is a useful place to pause. Keep what worked, name what remains uncertain, and decide what deserves another attempt. The next edition begins with a better question.",
    paper: { width: 0.97, height: 0.78 },
  },
] satisfies readonly PaperReaderArticle[];

export default function PaperReaderDemo() {
  return (
    <PaperReader
      id="demo.field-notes"
      title="Notes from a working studio"
      description="A circular index and a reversible stack of postage-edged papers. Scroll to read; scroll back to retrace."
      articles={articles}
    />
  );
}
