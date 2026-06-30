import { memo } from "react";

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

const isOwner = (owner) =>
  Boolean(
    owner
      && typeof owner === "object"
      && !Array.isArray(owner)
      && typeof owner.userId === "string"
      && typeof owner.username === "string"
  );

const getOwnerKey = (owner) => (isOwner(owner) ? owner.userId : "unowned");

const getLineChunks = ({ charOwnership = [], line, startIndex }) => {
  if (!line) {
    return [];
  }

  const chunks = [];

  line.split("").forEach((character, offset) => {
    const owner = charOwnership[startIndex + offset];
    const previousChunk = chunks[chunks.length - 1];

    if (previousChunk && getOwnerKey(previousChunk.owner) === getOwnerKey(owner)) {
      previousChunk.text += character;
      return;
    }

    chunks.push({
      owner: isOwner(owner) ? owner : null,
      text: character
    });
  });

  return chunks;
};

const ColoredDocumentOverlay = ({
  charOwnership = [],
  document = "",
  lineOwnership = {},
  scrollLeft = 0,
  scrollTop = 0
}) => {
  const ownership = normalizeOwnership(lineOwnership);
  const lines = getLines(document);
  let startIndex = 0;

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
          const lineOwner = ownership[String(lineNumber)];
          const chunks = getLineChunks({
            charOwnership,
            line,
            startIndex
          });

          startIndex += line.length + 1;

          return (
            <span
              className="block h-6"
              key={lineNumber}
              title={
                lineOwner?.username
                  ? `Line ${lineNumber} last edited by ${lineOwner.username}`
                  : `Line ${lineNumber}`
              }
            >
              {chunks.length
                ? chunks.map((chunk, chunkIndex) => (
                    <span
                      key={`${lineNumber}-${chunkIndex}-${getOwnerKey(chunk.owner)}`}
                      title={
                        chunk.owner?.username
                          ? `${chunk.owner.username}'s characters`
                          : "Unassigned characters"
                      }
                    >
                      {chunk.text}
                    </span>
                  ))
                : " "}
            </span>
          );
        })}
      </code>
    </pre>
  );
};

export default memo(ColoredDocumentOverlay);
