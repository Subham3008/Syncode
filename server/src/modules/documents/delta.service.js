import { HTTP_STATUS } from "../../constants/httpStatus.js";
import { ApiError } from "../../utils/ApiError.js";
import {
  calculateLineNumber,
  getDocumentLength,
  normalizeDocument
} from "./document.utils.js";

export const DELTA_TYPES = {
  INSERT: "insert",
  DELETE: "delete",
  REPLACE: "replace"
};

const VALID_DELTA_TYPES = new Set(Object.values(DELTA_TYPES));

const normalizeInteger = (value, label, { allowZero = true } = {}) => {
  if (value === undefined || value === null || value === "") {
    throw createDeltaError(`${label} is required`);
  }

  if (typeof value === "string" && value.trim() === "") {
    throw createDeltaError(`${label} is required`);
  }

  if (typeof value !== "number" && typeof value !== "string") {
    throw createDeltaError(`${label} must be an integer`);
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

const createDeltaError = (message) => new ApiError(HTTP_STATUS.BAD_REQUEST, message);

const assertText = (text, label, { allowEmpty = false } = {}) => {
  if (typeof text !== "string") {
    throw createDeltaError(`${label} must be a string`);
  }

  if (!allowEmpty && text.length === 0) {
    throw createDeltaError(`${label} cannot be empty`);
  }
};

const assertLength = (length) => {
  if (!Number.isInteger(length) || length <= 0) {
    throw createDeltaError("Delta length must be a positive integer");
  }
};

const assertPosition = (position, documentLength, allowEndPosition = true) => {
  const maxPosition = allowEndPosition ? documentLength : documentLength - 1;

  if (!Number.isInteger(position) || position < 0 || position > maxPosition) {
    throw createDeltaError("Delta position is outside document bounds");
  }
};

export const normalizeDelta = (delta = {}) => {
  if (!delta || typeof delta !== "object" || Array.isArray(delta)) {
    throw createDeltaError("Delta payload must be an object");
  }

  const type = typeof delta.type === "string" ? delta.type.trim().toLowerCase() : "";

  if (!VALID_DELTA_TYPES.has(type)) {
    throw createDeltaError("Delta type must be insert, delete, or replace");
  }

  const normalizedDelta = {
    type,
    position: normalizeInteger(delta.position, "Delta position"),
    text: "",
    length: 0
  };

  if (type === DELTA_TYPES.INSERT) {
    assertText(delta.text, "Insert text");
    normalizedDelta.text = delta.text;
  }

  if (type === DELTA_TYPES.DELETE || type === DELTA_TYPES.REPLACE) {
    normalizedDelta.length = normalizeInteger(delta.length, "Delta length", {
      allowZero: false
    });
  }

  if (type === DELTA_TYPES.REPLACE) {
    assertText(delta.text, "Replace text", { allowEmpty: true });
    normalizedDelta.text = delta.text;
  }

  if (delta.lineNumber !== undefined && delta.lineNumber !== null && delta.lineNumber !== "") {
    normalizedDelta.lineNumber = normalizeInteger(delta.lineNumber, "Delta line number", {
      allowZero: false
    });
  }

  return normalizedDelta;
};

export const validateDelta = (delta, document = "") => {
  const normalizedDelta = normalizeDelta(delta);
  const safeDocument = normalizeDocument(document);
  const documentLength = getDocumentLength(safeDocument);
  const resolvedDelta = {
    ...normalizedDelta,
    lineNumber: calculateLineNumber(safeDocument, normalizedDelta.position)
  };

  if (normalizedDelta.type === DELTA_TYPES.INSERT) {
    assertText(normalizedDelta.text, "Insert text");
    assertPosition(normalizedDelta.position, documentLength, true);

    return resolvedDelta;
  }

  assertLength(normalizedDelta.length);
  assertPosition(normalizedDelta.position, documentLength, false);

  if (normalizedDelta.position + normalizedDelta.length > documentLength) {
    throw createDeltaError("Delta length exceeds document bounds");
  }

  if (normalizedDelta.type === DELTA_TYPES.REPLACE) {
    assertText(normalizedDelta.text, "Replace text", { allowEmpty: true });
  }

  return resolvedDelta;
};

export const applyDeltaToDocument = (document, delta) => {
  const safeDocument = normalizeDocument(document);
  const normalizedDelta = validateDelta(delta, safeDocument);
  const { position, text, length, type } = normalizedDelta;

  if (type === DELTA_TYPES.INSERT) {
    return `${safeDocument.slice(0, position)}${text}${safeDocument.slice(position)}`;
  }

  if (type === DELTA_TYPES.DELETE) {
    return `${safeDocument.slice(0, position)}${safeDocument.slice(position + length)}`;
  }

  return `${safeDocument.slice(0, position)}${text}${safeDocument.slice(position + length)}`;
};

export { calculateLineNumber };
