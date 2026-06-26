import * as React from "react";

type EffectDescriptionProps = {
  readonly children: React.ReactNode;
  readonly source: string;
  readonly title: string;
};

export function EffectDescription({ children, source, title }: EffectDescriptionProps) {
  const [expanded, setExpanded] = React.useState(false);
  const panelId = React.useId();

  const toggleExpanded = () => {
    setExpanded((current) => !current);
  };

  if (!expanded) {
    return (
      <button
        type="button"
        className="example-effect-pill"
        aria-expanded={false}
        aria-controls={panelId}
        aria-label={`展开 ${title} 说明`}
        onClick={toggleExpanded}
      >
        <span aria-hidden="true">i</span>
        <span>{source}</span>
      </button>
    );
  }

  return (
    <aside className="example-effect-panel" id={panelId} aria-label={`${title} 说明`}>
      <button
        type="button"
        className="example-effect-panel-header"
        aria-expanded={true}
        aria-controls={panelId}
        onClick={toggleExpanded}
      >
        <span>{source}</span>
        <span aria-hidden="true">-</span>
      </button>
      <h2>{title}</h2>
      <p>{children}</p>
    </aside>
  );
}
