export const DELTA_TYPES = {
  INSERT: "insert",
  DELETE: "delete",
  REPLACE: "replace"
};

const VALID_DELTA_TYPES = new Set(Object.values(DELTA_TYPES));

const normalizeDocument = (document) =>
  typeof document === "string" ? document : "";

const normalizeInteger = (value, fallback = 0) => {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.trunc(numericValue);
};

const normalizeRequiredInteger = (value, label, { allowZero = true } = {}) => {
  if (value === undefined || value === null || value === "") {
    throw createDeltaError(`${label} is required`);
  }

  if (typeof value === "string" && value.trim() === "") {
    throw createDeltaError(`${label} is required`);
  }

  const numericValue = Number(value);

  if (!Number.isInteger(numericValue)) {
    throw createDeltaError(`${label} must be an integer`);
  }

  if (numericValue < 0 || (!allowZero && numericValue === 0)) {
    throw createDeltaError(
      allowZero ? `${label} cannot be negative` : `${label} must be a positive integer`
    );
  }

  return numericValue;
};

const clampPosition = (position, document) => {
  const safeDocument = normalizeDocument(document);
  const safePosition = normalizeInteger(position);

  return Math.min(Math.max(safePosition, 0), safeDocument.length);
};

const createDeltaError = (message) => new Error(message);

const assertDeltaObject = (delta) => {
  if (!delta || typeof delta !== "object" || Array.isArray(delta)) {
    throw createDeltaError("Delta must be an object");
  }
};

const normalizeDelta = (delta) => {
  assertDeltaObject(delta);

  const type = typeof delta.type === "string" ? delta.type.trim().toLowerCase() : "";
  const hasText = Object.prototype.hasOwnProperty.call(delta, "text");

  if (!VALID_DELTA_TYPES.has(type)) {
    throw createDeltaError("Delta type must be insert, delete, or replace");
  }

  return {
    type,
    position: normalizeRequiredInteger(delta.position, "Delta position"),
    text: hasText && typeof delta.text === "string" ? delta.text : null,
    length: type === DELTA_TYPES.INSERT
      ? 0
      : normalizeRequiredInteger(delta.length, "Delta length", { allowZero: false }),
    lineNumber: normalizeInteger(delta.lineNumber, 1)
  };
};

const validateDeltaForDocument = (document, delta) => {
  const safeDocument = normalizeDocument(document);
  const normalizedDelta = normalizeDelta(delta);
  const { position, length, text, type } = normalizedDelta;

  if (position < 0 || position > safeDocument.length) {
    throw createDeltaError("Delta position is outside document bounds");
  }

  if (type === DELTA_TYPES.INSERT) {
    if (!text) {
      throw createDeltaError("Insert delta requires text");
    }

    return normalizedDelta;
  }

  if (!Number.isInteger(length) || length <= 0) {
    throw createDeltaError("Delta length must be a positive integer");
  }

  if (position >= safeDocument.length || position + length > safeDocument.length) {
    throw createDeltaError("Delta length exceeds document bounds");
  }

  if (type === DELTA_TYPES.REPLACE && text === null) {
    throw createDeltaError("Replace delta requires text");
  }

  return normalizedDelta;
};

export const calculateLineNumber = (document, position) => {
  const safeDocument = normalizeDocument(document);
  const safePosition = clampPosition(position, safeDocument);
  let lineNumber = 1;

  for (let index = 0; index < safePosition; index += 1) {
    if (safeDocument[index] === "\n") {
      lineNumber += 1;
    }
  }

  return lineNumber;
};

export const createDeltaFromTextChange = (
  previousText,
  nextText,
  cursorPosition = null
) => {
  const previousDocument = normalizeDocument(previousText);
  const nextDocument = normalizeDocument(nextText);

  if (previousDocument === nextDocument) {
    return null;
  }

  let prefixLength = 0;

  while (
    prefixLength < previousDocument.length
    && prefixLength < nextDocument.length
    && previousDocument[prefixLength] === nextDocument[prefixLength]
  ) {
    prefixLength += 1;
  }

  let suffixLength = 0;

  while (
    suffixLength < previousDocument.length - prefixLength
    && suffixLength < nextDocument.length - prefixLength
    && previousDocument[previousDocument.length - 1 - suffixLength]
      === nextDocument[nextDocument.length - 1 - suffixLength]
  ) {
    suffixLength += 1;
  }

  const position = prefixLength;
  const removedText = previousDocument.slice(
    prefixLength,
    previousDocument.length - suffixLength
  );
  const insertedText = nextDocument.slice(prefixLength, nextDocument.length - suffixLength);
  const lineNumber = calculateLineNumber(previousDocument, position);

  if (!removedText && insertedText) {
    return {
      type: DELTA_TYPES.INSERT,
      position,
      text: insertedText,
      length: 0,
      lineNumber
    };
  }

  if (removedText && !insertedText) {
    return {
      type: DELTA_TYPES.DELETE,
      position,
      text: "",
      length: removedText.length,
      lineNumber
    };
  }

  return {
    type: DELTA_TYPES.REPLACE,
    position,
    text: insertedText,
    length: removedText.length,
    lineNumber
  };
};

export const applyRemoteDelta = (document, delta) => {
  const safeDocument = normalizeDocument(document);
  const normalizedDelta = validateDeltaForDocument(safeDocument, delta);
  const { type, position, text, length } = normalizedDelta;

  if (type === DELTA_TYPES.INSERT) {
    return `${safeDocument.slice(0, position)}${text}${safeDocument.slice(position)}`;
  }

  if (type === DELTA_TYPES.DELETE) {
    return `${safeDocument.slice(0, position)}${safeDocument.slice(position + length)}`;
  }

  return `${safeDocument.slice(0, position)}${text}${safeDocument.slice(position + length)}`;
};
