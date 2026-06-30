const normalizeLineOwnership = (lineOwnership) => {
  if (!lineOwnership || typeof lineOwnership !== "object" || Array.isArray(lineOwnership)) {
    return {};
  }

  return { ...lineOwnership };
};

const normalizeLineNumber = (lineNumber) => {
  const numericLineNumber = Number(lineNumber);

  return Number.isInteger(numericLineNumber) && numericLineNumber > 0
    ? numericLineNumber
    : 1;
};

const normalizeOwner = ({ userId, username, color }) => ({
  userId,
  username,
  color: typeof color === "string" ? color : "",
  updatedAt: new Date().toISOString()
});

const getChangedLineCount = (delta) => {
  if (typeof delta?.text !== "string" || delta.text.length === 0) {
    return 1;
  }

  return delta.text.split("\n").length;
};

export const updateLineOwnership = ({
  color = "",
  delta,
  lineOwnership,
  userId,
  username
}) => {
  const nextLineOwnership = normalizeLineOwnership(lineOwnership);
  const startLine = normalizeLineNumber(delta?.lineNumber);
  const changedLineCount = getChangedLineCount(delta);
  const owner = normalizeOwner({ userId, username, color });

  for (let offset = 0; offset < changedLineCount; offset += 1) {
    nextLineOwnership[String(startLine + offset)] = owner;
  }

  return nextLineOwnership;
};
