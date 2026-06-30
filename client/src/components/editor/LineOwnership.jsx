import { memo } from "react";

const normalizeOwnership = (lineOwnership) => {
  if (!lineOwnership || typeof lineOwnership !== "object" || Array.isArray(lineOwnership)) {
    return {};
  }

  return lineOwnership;
};

const LineOwnership = ({ lineCount = 1, lineOwnership = {}, scrollTop = 0 }) => {
  const ownership = normalizeOwnership(lineOwnership);
  const lines = Array.from({ length: Math.max(lineCount, 1) }, (_, index) => index + 1);

  return (
    <div
      aria-label="Line ownership"
      className="relative hidden w-3 shrink-0 overflow-hidden border-r border-border bg-[#0b1017] sm:block"
    >
      <div
        className="py-4"
        style={{ transform: `translateY(-${scrollTop}px)` }}
      >
        {lines.map((lineNumber) => {
          const owner = ownership[String(lineNumber)];
          const title = owner?.username
            ? `Line ${lineNumber} edited by ${owner.username}`
            : `Line ${lineNumber}`;

          return (
            <div className="grid h-6 place-items-center" key={lineNumber} title={title}>
              {owner ? (
                <div
                  aria-label={title}
                  className="h-4 w-1.5 rounded-full bg-accent"
                  style={owner.color ? { backgroundColor: owner.color } : undefined}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default memo(LineOwnership);
