export const heroChapterFaces = [
  { id: "chapter-1", number: "01", label: "FIELD NOTES" },
  { id: "chapter-2", number: "02", label: "INDEX" },
  { id: "chapter-3", number: "03", label: "STUDIO" },
  { id: "chapter-4", number: "04", label: "CONTACT" },
] as const;

export const heroChapterOneContent = {
  eyebrow: "PROTOTYPE / 01",
  title: "FIELD NOTES",
  summary:
    "A temporary chapter surface for proving one continuous, reversible spatial handoff.",
  cards: [
    ["01A", "Face space"],
    ["01B", "Screen space"],
  ],
} as const;
