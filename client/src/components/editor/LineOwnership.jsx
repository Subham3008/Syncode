const normalizeOwnership = (lineOwnership) => {
  if (!lineOwnership || typeof lineOwnership !== "object" || Array.isArray(lineOwnership)) {
    return {};
  }

  return lineOwnership;
};

const getOwnerInitials = (username = "") => {
  const cleanName = typeof username === "string" ? username.trim() : "";

  if (!cleanName) {
    return "";
  }

  return cleanName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
};

const LineOwnership = ({ lineCount = 1, lineOwnership = {}, scrollTop = 0 }) => {
  const ownership = normalizeOwnership(lineOwnership);
  const lines = Array.from({ length: Math.max(lineCount, 1) }, (_, index) => index + 1);

  return (
    <div
      aria-label="Line ownership"
      className="relative w-9 shrink-0 overflow-hidden border-r border-border bg-canvas/60"
    >
      <div
        className="px-1 py-4"
        style={{ transform: `translateY(-${scrollTop}px)` }}
      >
        {lines.map((lineNumber) => {
          const owner = ownership[String(lineNumber)];
          const initials = getOwnerInitials(owner?.username);
          const title = owner?.username
            ? `Line ${lineNumber} edited by ${owner.username}`
            : `Line ${lineNumber}`;

          return (
            <div className="grid h-6 place-items-center" key={lineNumber} title={title}>
              {owner ? (
                <span
                  aria-label={title}
                  className="grid h-4 min-w-4 place-items-center rounded-sm border border-accent/40 bg-accent/15 px-1 font-mono text-[10px] font-semibold leading-none text-accent shadow-sm"
                  style={
                    owner.color
                      ? {
                          backgroundColor: `${owner.color}22`,
                          borderColor: owner.color,
                          color: owner.color
                        }
                      : undefined
                  }
                >
                  {initials || "*"}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LineOwnership;
