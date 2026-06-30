const normalizeOwnership = (lineOwnership) => {
  if (!lineOwnership || typeof lineOwnership !== "object" || Array.isArray(lineOwnership)) {
    return {};
  }

  return lineOwnership;
};

const getLines = (document = "") => {
  if (typeof document !== "string" || document.length === 0) {
    return [""];
  }

  return document.split("\n");
};

const ColoredDocumentOverlay = ({
  document = "",
  lineOwnership = {},
  scrollLeft = 0,
  scrollTop = 0
}) => {
  const ownership = normalizeOwnership(lineOwnership);
  const lines = getLines(document);

  return (
    <pre
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden px-4 py-4 font-mono text-sm leading-6 text-heading"
    >
      <code
        className="block min-h-full min-w-full whitespace-pre"
        style={{ transform: `translate(${-scrollLeft}px, ${-scrollTop}px)` }}
      >
        {lines.map((line, index) => {
          const lineNumber = index + 1;
          const owner = ownership[String(lineNumber)];
          const color = owner?.color || "inherit";

          return (
            <span
              className="block h-6"
              key={`${lineNumber}-${owner?.userId || "unowned"}`}
              style={{ color }}
              title={
                owner?.username
                  ? `Line ${lineNumber} by ${owner.username}`
                  : `Line ${lineNumber}`
              }
            >
              {line || " "}
            </span>
          );
        })}
      </code>
    </pre>
  );
};

export default ColoredDocumentOverlay;
