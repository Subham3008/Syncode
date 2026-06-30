import { HTTP_STATUS } from "../../constants/httpStatus.js";
import { ApiError } from "../../utils/ApiError.js";
import {
  getCharOwnership,
  getCachedDocument,
  getCachedVersion,
  getLineOwnership,
  getRecentDeltas,
  incrementCachedVersion,
  markDocumentDirty,
  pushRecentDelta,
  setCachedDocument,
  setCharOwnership,
  setLineOwnership
} from "./document.cache.js";
import { resolveDeltaConflict } from "./conflict.service.js";
import { applyDeltaToDocument, validateDelta } from "./delta.service.js";
import { scheduleDocumentSave } from "./document.persistence.js";
import {
  normalizeCharOwnership,
  updateCharOwnership
} from "./charOwnership.service.js";
import { updateLineOwnership } from "./lineOwnership.service.js";

const roomQueues = new Map();

const createPayloadError = (message) => new ApiError(HTTP_STATUS.BAD_REQUEST, message);

const normalizeRoomCode = (roomCode) => {
  if (typeof roomCode !== "string") {
    return "";
  }

  return roomCode.trim().toUpperCase();
};

const assertRoomCode = (roomCode) => {
  const normalizedRoomCode = normalizeRoomCode(roomCode);

  if (!normalizedRoomCode) {
    throw createPayloadError("roomCode is required");
  }

  return normalizedRoomCode;
};

const assertString = (value, label) => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw createPayloadError(`${label} is required`);
  }

  return value.trim();
};

const assertObject = (value, label) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw createPayloadError(`${label} must be an object`);
  }

  return value;
};

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

const runRoomOperation = async (roomCode, operation) => {
  const normalizedRoomCode = assertRoomCode(roomCode);
  const previousOperation = roomQueues.get(normalizedRoomCode) ?? Promise.resolve();
  const currentOperation = previousOperation
    .catch(() => undefined)
    .then(() => operation(normalizedRoomCode));

  roomQueues.set(normalizedRoomCode, currentOperation);

  try {
    return await currentOperation;
  } finally {
    if (roomQueues.get(normalizedRoomCode) === currentOperation) {
      roomQueues.delete(normalizedRoomCode);
    }
  }
};

const toDeltaRecord = ({ delta, version, userId, username }) => ({
  version,
  userId,
  username,
  type: delta.type,
  position: delta.position,
  text: delta.text,
  length: delta.length,
  lineNumber: delta.lineNumber,
  timestamp: new Date().toISOString()
});

const toClientDelta = (deltaRecord) => ({
  type: deltaRecord.type,
  position: deltaRecord.position,
  text: deltaRecord.text,
  length: deltaRecord.length,
  lineNumber: deltaRecord.lineNumber
});

const applyEditorDeltaForRoom = async (payload, normalizedRoomCode) => {
  const userId = assertString(payload.userId, "userId");
  const username = assertString(payload.username, "username");
  const color = typeof payload.color === "string" ? payload.color.trim() : "";
  const baseVersion = normalizeVersion(payload.baseVersion, "baseVersion");
  const currentDocument = await getCachedDocument(normalizedRoomCode);
  const currentVersion = await getCachedVersion(normalizedRoomCode);
  const recentDeltas = await getRecentDeltas(normalizedRoomCode);
  const resolvedPayload = resolveDeltaConflict(
    {
      roomCode: normalizedRoomCode,
      userId,
      username,
      baseVersion,
      documentLength: currentDocument.length,
      delta: payload.delta
    },
    recentDeltas,
    currentVersion
  );
  const acceptedDelta = validateDelta(resolvedPayload.delta, currentDocument);
  const nextDocument = applyDeltaToDocument(currentDocument, acceptedDelta);
  const nextVersion = await incrementCachedVersion(normalizedRoomCode);
  const deltaRecord = toDeltaRecord({
    delta: acceptedDelta,
    version: nextVersion,
    userId,
    username
  });
  const currentLineOwnership = await getLineOwnership(normalizedRoomCode);
  const currentCharOwnership = await getCharOwnership(normalizedRoomCode);
  const charOwnership = updateCharOwnership({
    color,
    charOwnership: currentCharOwnership,
    document: currentDocument,
    lineOwnership: currentLineOwnership,
    delta: acceptedDelta,
    userId,
    username
  });
  const lineOwnership = updateLineOwnership({
    color,
    lineOwnership: currentLineOwnership,
    delta: acceptedDelta,
    userId,
    username
  });

  await setCachedDocument(normalizedRoomCode, nextDocument);
  await pushRecentDelta(normalizedRoomCode, deltaRecord);
  await setLineOwnership(normalizedRoomCode, lineOwnership);
  await setCharOwnership(normalizedRoomCode, charOwnership);
  await markDocumentDirty(normalizedRoomCode);
  scheduleDocumentSave(normalizedRoomCode);

  return {
    roomCode: normalizedRoomCode,
    userId,
    username,
    version: nextVersion,
    delta: toClientDelta(deltaRecord),
    lineNumber: deltaRecord.lineNumber,
    lineOwnership,
    charOwnership,
    conflictResolved: resolvedPayload.conflictResolved,
    transformedBy: resolvedPayload.transformedBy,
    timestamp: deltaRecord.timestamp
  };
};

export const getDocumentState = async (roomCode) => {
  const normalizedRoomCode = assertRoomCode(roomCode);
  const document = await getCachedDocument(normalizedRoomCode);
  const version = await getCachedVersion(normalizedRoomCode);
  const recentDeltas = await getRecentDeltas(normalizedRoomCode);
  const lineOwnership = await getLineOwnership(normalizedRoomCode);
  const cachedCharOwnership = await getCharOwnership(normalizedRoomCode);
  const charOwnership = normalizeCharOwnership({
    charOwnership: cachedCharOwnership,
    document,
    lineOwnership
  });

  return {
    roomCode: normalizedRoomCode,
    document,
    version,
    recentDeltas,
    lineOwnership,
    charOwnership
  };
};

export const applyEditorDelta = async (payload = {}) => {
  const safePayload = assertObject(payload, "Delta payload");
  const normalizedRoomCode = assertRoomCode(safePayload.roomCode);

  return runRoomOperation(normalizedRoomCode, (roomCode) =>
    applyEditorDeltaForRoom(safePayload, roomCode)
  );
};

export { flushDocumentToMongo } from "./document.persistence.js";
