import { DELTA_TYPES } from "./delta.service.js";

const normalizeOwner = ({ userId, username, color }) => ({
  userId,
  username,
  color: typeof color === "string" ? color : "",
  updatedAt: new Date().toISOString()
});

const isOwner = (owner) =>
  Boolean(
    owner
      && typeof owner === "object"
      && !Array.isArray(owner)
      && typeof owner.userId === "string"
      && typeof owner.username === "string"
  );

const normalizeLineOwnership = (lineOwnership) => {
  if (!lineOwnership || typeof lineOwnership !== "object" || Array.isArray(lineOwnership)) {
    return {};
  }

  return { ...lineOwnership };
};

const buildOwnershipFromLines = (document, lineOwnership) => {
  const ownership = normalizeLineOwnership(lineOwnership);
  let lineNumber = 1;

  return document.split("").map((character) => {
    const owner = ownership[String(lineNumber)];

    if (character === "\n") {
      lineNumber += 1;
    }

    return isOwner(owner) ? owner : null;
  });
};

export const normalizeCharOwnership = ({
  charOwnership,
  document = "",
  lineOwnership = {}
} = {}) => {
  const safeDocument = typeof document === "string" ? document : "";
  const source = Array.isArray(charOwnership) && charOwnership.length > 0
    ? charOwnership.map((owner) => (isOwner(owner) ? owner : null))
    : buildOwnershipFromLines(safeDocument, lineOwnership);
  const nextOwnership = source.slice(0, safeDocument.length);

  while (nextOwnership.length < safeDocument.length) {
    nextOwnership.push(null);
  }

  return nextOwnership;
};

export const updateCharOwnership = ({
  charOwnership,
  document = "",
  lineOwnership = {},
  delta,
  userId,
  username,
  color = ""
}) => {
  const safeDocument = typeof document === "string" ? document : "";
  const nextOwnership = normalizeCharOwnership({
    charOwnership,
    document: safeDocument,
    lineOwnership
  });
  const owner = normalizeOwner({ userId, username, color });
  const position = Number.isInteger(delta?.position) ? delta.position : 0;
  const length = Number.isInteger(delta?.length) ? delta.length : 0;
  const text = typeof delta?.text === "string" ? delta.text : "";
  const insertedOwnership = text.split("").map(() => owner);

  if (delta?.type === DELTA_TYPES.INSERT) {
    nextOwnership.splice(position, 0, ...insertedOwnership);
    return nextOwnership;
  }

  if (delta?.type === DELTA_TYPES.DELETE) {
    nextOwnership.splice(position, length);
    return nextOwnership;
  }

  nextOwnership.splice(position, length, ...insertedOwnership);
  return nextOwnership;
};
