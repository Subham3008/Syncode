export const normalizeDocument = (document) =>
  typeof document === "string" ? document : "";

export const clampPosition = (position, document) => {
  const safeDocument = normalizeDocument(document);
  const numericPosition = Number(position);

  if (!Number.isFinite(numericPosition)) {
    return 0;
  }

  return Math.min(Math.max(Math.trunc(numericPosition), 0), safeDocument.length);
};

export const calculateLineNumber = (document, position) => {
  const safeDocument = normalizeDocument(document);
  const safePosition = clampPosition(position, safeDocument);

  if (safePosition === 0) {
    return 1;
  }

  let lineNumber = 1;

  for (let index = 0; index < safePosition; index += 1) {
    if (safeDocument[index] === "\n") {
      lineNumber += 1;
    }
  }

  return lineNumber;
};

export const getDocumentLength = (document) => normalizeDocument(document).length;
