import { HTTP_STATUS } from "../../constants/httpStatus.js";
import { ApiError } from "../../utils/ApiError.js";
import { DELTA_TYPES, normalizeDelta } from "./delta.service.js";

const createConflictError = (message) => new ApiError(HTTP_STATUS.CONFLICT, message);
const createPayloadError = (message) => new ApiError(HTTP_STATUS.BAD_REQUEST, message);

const normalizeVersion = (value, label) => {
  if (value === undefined || value === null || value === "") {
    throw createPayloadError(`${label} is required`);
  }

  const numericVersion = Number(value);

  if (!Number.isInteger(numericVersion) || numericVersion < 0) {
    throw createPayloadError(`${label} must be a non-negative integer`);
  }

  return numericVersion;
};

const normalizeDocumentLength = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const numericLength = Number(value);

  return Number.isInteger(numericLength) && numericLength >= 0 ? numericLength : null;
};

const getPayloadDocumentLength = (deltaPayload) => {
  const explicitLength = normalizeDocumentLength(deltaPayload?.documentLength);

  if (explicitLength !== null) {
    return explicitLength;
  }

  if (typeof deltaPayload?.currentDocument === "string") {
    return deltaPayload.currentDocument.length;
  }

  if (typeof deltaPayload?.document === "string") {
    return deltaPayload.document.length;
  }

  return null;
};

const getRecentDeltaSource = (recentDelta) => {
  if (recentDelta?.delta && typeof recentDelta.delta === "object") {
    return {
      ...recentDelta.delta,
      version: recentDelta.version ?? recentDelta.delta.version
    };
  }

  return recentDelta;
};

const normalizeRecentDelta = (recentDelta) => {
  const source = getRecentDeltaSource(recentDelta);
  const version = normalizeVersion(source?.version, "Recent delta version");

  return {
    ...normalizeDelta(source),
    version
  };
};

const getBridgeDeltas = (recentDeltas, baseVersion, currentVersion) => {
  if (!Array.isArray(recentDeltas)) {
    throw createConflictError("Recent delta history is unavailable");
  }

  const deltasByVersion = new Map();

  try {
    for (const recentDelta of recentDeltas) {
      const normalizedDelta = normalizeRecentDelta(recentDelta);

      if (normalizedDelta.version > baseVersion && normalizedDelta.version <= currentVersion) {
        deltasByVersion.set(normalizedDelta.version, normalizedDelta);
      }
    }
  } catch {
    throw createConflictError("Recent delta history is invalid");
  }

  const requiredDeltaCount = currentVersion - baseVersion;

  if (deltasByVersion.size !== requiredDeltaCount) {
    throw createConflictError("Delta history is too old to resolve this edit");
  }

  return Array.from(deltasByVersion.values()).sort((left, right) => left.version - right.version);
};

const transformPositionForAcceptedDelta = (position, acceptedDelta) => {
  if (acceptedDelta.type === DELTA_TYPES.INSERT) {
    return acceptedDelta.position <= position
      ? position + acceptedDelta.text.length
      : position;
  }

  if (acceptedDelta.type === DELTA_TYPES.DELETE) {
    if (acceptedDelta.position >= position) {
      return position;
    }

    const removedBeforePosition = Math.min(
      acceptedDelta.length,
      position - acceptedDelta.position
    );

    return Math.max(acceptedDelta.position, position - removedBeforePosition);
  }

  if (acceptedDelta.type === DELTA_TYPES.REPLACE) {
    let nextPosition = position;

    if (acceptedDelta.position < nextPosition) {
      const removedBeforePosition = Math.min(
        acceptedDelta.length,
        nextPosition - acceptedDelta.position
      );
      nextPosition = Math.max(acceptedDelta.position, nextPosition - removedBeforePosition);
    }

    return acceptedDelta.position <= nextPosition
      ? nextPosition + acceptedDelta.text.length
      : nextPosition;
  }

  throw createConflictError("Unsupported recent delta type");
};

const clampTransformedDelta = (delta, documentLength) => {
  if (documentLength === null) {
    return {
      ...delta,
      position: Math.max(0, delta.position)
    };
  }

  const maxPosition = delta.type === DELTA_TYPES.INSERT
    ? documentLength
    : Math.max(documentLength - 1, 0);
  const position = Math.min(Math.max(delta.position, 0), maxPosition);
  const resolvedDelta = {
    ...delta,
    position
  };

  if (delta.type !== DELTA_TYPES.INSERT) {
    if (documentLength === 0 || position + delta.length > documentLength) {
      throw createConflictError("Resolved delta is outside document bounds");
    }
  }

  return resolvedDelta;
};

export const transformDeltaPosition = (
  delta,
  recentDeltas,
  baseVersion,
  currentVersion,
  documentLength = null
) => {
  const normalizedDelta = normalizeDelta(delta);
  const safeBaseVersion = normalizeVersion(baseVersion, "baseVersion");
  const safeCurrentVersion = normalizeVersion(currentVersion, "currentVersion");

  if (safeBaseVersion > safeCurrentVersion) {
    throw createConflictError("Delta baseVersion is ahead of the server version");
  }

  if (safeBaseVersion === safeCurrentVersion) {
    return normalizedDelta;
  }

  const bridgeDeltas = getBridgeDeltas(recentDeltas, safeBaseVersion, safeCurrentVersion);
  const safeDocumentLength = normalizeDocumentLength(documentLength);
  let transformedPosition = normalizedDelta.position;

  for (const acceptedDelta of bridgeDeltas) {
    transformedPosition = transformPositionForAcceptedDelta(transformedPosition, acceptedDelta);
  }

  if (!Number.isInteger(transformedPosition) || transformedPosition < 0) {
    throw createConflictError("Could not safely transform delta position");
  }

  return clampTransformedDelta(
    {
      ...normalizedDelta,
      position: transformedPosition
    },
    safeDocumentLength
  );
};

export const resolveDeltaConflict = (deltaPayload = {}, recentDeltas = [], currentVersion) => {
  if (!deltaPayload || typeof deltaPayload !== "object" || Array.isArray(deltaPayload)) {
    throw createPayloadError("Delta payload must be an object");
  }

  const baseVersion = normalizeVersion(deltaPayload.baseVersion, "baseVersion");
  const safeCurrentVersion = normalizeVersion(currentVersion, "currentVersion");
  const documentLength = getPayloadDocumentLength(deltaPayload);

  if (baseVersion > safeCurrentVersion) {
    throw createConflictError("Delta baseVersion is ahead of the server version");
  }

  if (baseVersion === safeCurrentVersion) {
    return {
      ...deltaPayload,
      baseVersion,
      currentVersion: safeCurrentVersion,
      delta: normalizeDelta(deltaPayload.delta),
      conflictResolved: false,
      transformedBy: 0
    };
  }

  const delta = transformDeltaPosition(
    deltaPayload.delta,
    recentDeltas,
    baseVersion,
    safeCurrentVersion,
    documentLength
  );

  return {
    ...deltaPayload,
    baseVersion,
    currentVersion: safeCurrentVersion,
    delta,
    conflictResolved: true,
    transformedBy: safeCurrentVersion - baseVersion
  };
};
