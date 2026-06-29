const StatePanel = ({
  eyebrow,
  title,
  description,
  icon,
  actions,
  tone = "accent"
}) => {
  const toneClasses = {
    accent: "text-accent",
    danger: "text-danger",
    success: "text-success",
    warning: "text-warning"
  };

  return (
    <div className="w-full max-w-lg rounded-md border border-border bg-surface p-6 text-center shadow-2xl shadow-black/30">
      <div className={`mx-auto grid h-12 w-12 place-items-center rounded border border-border bg-elevated ${toneClasses[tone]}`}>
        {icon}
      </div>
      {eyebrow ? (
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.08em] text-muted">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="mt-2 text-xl font-semibold text-heading">{title}</h1>
      {description ? (
        <p className="mt-3 text-sm leading-6 text-muted">{description}</p>
      ) : null}
      {actions ? <div className="mt-6 flex justify-center gap-2">{actions}</div> : null}
    </div>
  );
};

export default StatePanel;
