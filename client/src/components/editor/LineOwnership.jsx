import { memo } from "react";

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
      className="relative hidden w-36 shrink-0 overflow-hidden border-r border-border bg-canvas/60 sm:block"
    >
      <div
        className="py-4"
        style={{ transform: `translateY(-${scrollTop}px)` }}
      >
        {lines.map((lineNumber) => {
          const owner = ownership[String(lineNumber)];
          const initials = getOwnerInitials(owner?.username);
          const title = owner?.username
            ? `Line ${lineNumber} edited by ${owner.username}`
            : `Line ${lineNumber}`;

          return (
            <div className="flex h-6 items-center px-2" key={lineNumber} title={title}>
              {owner ? (
                <div
                  aria-label={title}
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-sm border border-accent/30 bg-accent/10 px-2 py-0.5 shadow-sm"
                  style={
                    owner.color
                      ? {
                          backgroundColor: `${owner.color}22`,
                          borderColor: `${owner.color}88`
                        }
                      : undefined
                  }
                >
                  <span
                    className="grid h-4 w-4 shrink-0 place-items-center rounded-sm bg-accent/20 font-mono text-[10px] font-bold leading-none text-accent"
                    style={
                      owner.color
                        ? {
                            backgroundColor: `${owner.color}33`,
                            color: owner.color
                          }
                        : undefined
                    }
                  >
                    {initials || "*"}
                  </span>
                  <span className="min-w-0 truncate text-[11px] font-medium text-body">
                    {owner.username}
                  </span>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default memo(LineOwnership);
