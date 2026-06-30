import { HTTP_STATUS } from "../../constants/httpStatus.js";
import { ApiError } from "../../utils/ApiError.js";
import { logger } from "../../utils/logger.js";
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
import { scheduleDocumentFlush } from "./document.persistence.js";
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

const normalizeClientDeltaId = (payload = {}) => {
  if (typeof payload.clientDeltaId === "string" && payload.clientDeltaId.trim()) {
    return payload.clientDeltaId.trim();
  }

  if (typeof payload.clientMutationId === "string" && payload.clientMutationId.trim()) {
    return payload.clientMutationId.trim();
  }

  throw createPayloadError("clientDeltaId is required");
};

const normalizeTimestamp = (value) => {
  const numericValue = Number(value);

  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : Date.now();
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

const toDeltaRecord = ({
  baseVersion,
  clientDeltaId,
  deletedText = "",
  delta,
  version,
  userId,
  username
}) => ({
  baseVersion,
  clientDeltaId,
  clientMutationId: clientDeltaId,
  deletedText,
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

const getRecentDeltaClientId = (deltaRecord = {}) => {
  if (typeof deltaRecord.clientDeltaId === "string" && deltaRecord.clientDeltaId.trim()) {
    return deltaRecord.clientDeltaId.trim();
  }

  if (typeof deltaRecord.clientMutationId === "string" && deltaRecord.clientMutationId.trim()) {
    return deltaRecord.clientMutationId.trim();
  }

  return "";
};

const findRecentDeltaByClientId = (recentDeltas = [], clientDeltaId = "", userId = "") => {
  if (!clientDeltaId) {
    return null;
  }

  return recentDeltas.find((deltaRecord) =>
    getRecentDeltaClientId(deltaRecord) === clientDeltaId
    && (!userId || deltaRecord.userId === userId)
  ) ?? null;
};

const toAppliedPayload = ({
  charOwnership,
  clientDeltaId,
  clientSentAt,
  deltaRecord,
  duplicate = false,
  lineOwnership,
  redisAppliedAt = Date.now(),
  redisApplyDurationMs = 0,
  resolvedPayload,
  roomCode,
  serverReceivedAt,
  userId,
  username
}) => ({
  baseVersion: deltaRecord.baseVersion,
  charOwnership,
  clientDeltaId,
  clientMutationId: clientDeltaId,
  clientSentAt,
  conflictResolved: Boolean(resolvedPayload?.conflictResolved),
  deletedText: deltaRecord.deletedText || "",
  delta: toClientDelta(deltaRecord),
  duplicate,
  length: deltaRecord.length,
  lineNumber: deltaRecord.lineNumber,
  lineOwnership,
  operation: deltaRecord.type,
  position: deltaRecord.position,
  redisAppliedAt,
  redisApplyDurationMs,
  roomCode,
  serverReceivedAt,
  serverVersion: deltaRecord.version,
  text: deltaRecord.text,
  timestamp: deltaRecord.timestamp,
  transformedBy: resolvedPayload?.transformedBy || 0,
  userId,
  username,
  version: deltaRecord.version
});

const applyEditorDeltaForRoom = async (payload, normalizedRoomCode) => {
  const startedAt = Date.now();
  const userId = assertString(payload.userId, "userId");
  const username = assertString(payload.username, "username");
  const color = typeof payload.color === "string" ? payload.color.trim() : "";
  const clientDeltaId = normalizeClientDeltaId(payload);
  const clientSentAt = normalizeTimestamp(payload.clientSentAt);
  const serverReceivedAt = normalizeTimestamp(payload.serverReceivedAt);
  const baseVersion = normalizeVersion(payload.baseVersion, "baseVersion");
  const currentDocument = await getCachedDocument(normalizedRoomCode);
  const currentVersion = await getCachedVersion(normalizedRoomCode);
  const recentDeltas = await getRecentDeltas(normalizedRoomCode);
  const duplicateDelta = findRecentDeltaByClientId(recentDeltas, clientDeltaId, userId);

  if (duplicateDelta) {
    const lineOwnership = await getLineOwnership(normalizedRoomCode);
    const charOwnership = await getCharOwnership(normalizedRoomCode);

    return toAppliedPayload({
      charOwnership,
      clientDeltaId,
      clientSentAt,
      deltaRecord: duplicateDelta,
      duplicate: true,
      lineOwnership,
      redisAppliedAt: Date.now(),
      redisApplyDurationMs: Date.now() - startedAt,
      roomCode: normalizedRoomCode,
      serverReceivedAt,
      userId,
      username
    });
  }

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
  const deletedText = acceptedDelta.type === "insert"
    ? ""
    : currentDocument.slice(acceptedDelta.position, acceptedDelta.position + acceptedDelta.length);
  const nextDocument = applyDeltaToDocument(currentDocument, acceptedDelta);
  const nextVersion = await incrementCachedVersion(normalizedRoomCode);
  const deltaRecord = toDeltaRecord({
    baseVersion,
    clientDeltaId,
    deletedText,
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
  const redisAppliedAt = Date.now();

  scheduleDocumentFlush(normalizedRoomCode).catch((error) => {
    logger.error(
      `[documents] Failed to schedule Mongo snapshot for room ${normalizedRoomCode}: ${error.message}`
    );
  });

  logger.info(
    `[editor-sync] Redis applied clientDeltaId=${clientDeltaId} room=${normalizedRoomCode} version=${nextVersion} durationMs=${redisAppliedAt - startedAt}`
  );

  return toAppliedPayload({
    charOwnership,
    clientDeltaId,
    clientSentAt,
    deltaRecord,
    lineOwnership,
    redisAppliedAt,
    redisApplyDurationMs: redisAppliedAt - startedAt,
    resolvedPayload,
    roomCode: normalizedRoomCode,
    serverReceivedAt,
    userId,
    username
  });
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
