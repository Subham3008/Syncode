import { HTTP_STATUS } from "../../constants/httpStatus.js";
import { hasRedisConnection, redisClient } from "../../config/redis.js";
import { Room } from "../../models/room.model.js";
import { ApiError } from "../../utils/ApiError.js";

const RECENT_DELTAS_LIMIT = 50;
const RECENT_DELTAS_TTL_SECONDS = 20 * 60;
const memoryDocuments = new Map();

const normalizeRoomCode = (roomCode) => {
  if (typeof roomCode !== "string") {
    return "";
  }

  return roomCode.trim().toUpperCase();
};

const assertRoomCode = (roomCode) => {
  const normalizedRoomCode = normalizeRoomCode(roomCode);

  if (!normalizedRoomCode) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, "roomCode is required");
  }

  return normalizedRoomCode;
};

const parseJson = (value, fallback) => {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const parseVersion = (value) => {
  const version = Number(value);

  return Number.isInteger(version) && version >= 0 ? version : 0;
};

const normalizeLineOwnership = (lineOwnership) => {
  if (!lineOwnership || typeof lineOwnership !== "object" || Array.isArray(lineOwnership)) {
    return {};
  }

  if (lineOwnership instanceof Map) {
    return Object.fromEntries(lineOwnership);
  }

  return { ...lineOwnership };
};

const normalizeCharOwnership = (charOwnership, document = "") => {
  const safeDocument = typeof document === "string" ? document : "";

  if (!Array.isArray(charOwnership)) {
    return [];
  }

  return charOwnership.slice(0, safeDocument.length);
};

const createMemoryState = ({
  charOwnership = [],
  document = "",
  dirty = false,
  dirtyDeltaCount = 0,
  dirtySince = null,
  lineOwnership = {},
  recentDeltas = [],
  version = 0
} = {}) => {
  const safeDocument = typeof document === "string" ? document : "";

  return {
    charOwnership: normalizeCharOwnership(charOwnership, safeDocument),
    dirty: Boolean(dirty),
    dirtyDeltaCount: parseVersion(dirtyDeltaCount),
    dirtySince,
    document: safeDocument,
    lineOwnership: normalizeLineOwnership(lineOwnership),
    recentDeltas: Array.isArray(recentDeltas)
      ? recentDeltas.slice(-RECENT_DELTAS_LIMIT)
      : [],
    version: parseVersion(version)
  };
};

const setMemoryState = (roomCode, state) => {
  const normalizedRoomCode = assertRoomCode(roomCode);
  const nextState = createMemoryState(state);

  memoryDocuments.set(normalizedRoomCode, nextState);
  return nextState;
};

const loadDocumentFromMongo = async (roomCode) => {
  const normalizedRoomCode = assertRoomCode(roomCode);
  const room = await Room.findOne({ roomCode: normalizedRoomCode })
    .select("document documentVersion recentDeltas lineOwnership charOwnership")
    .lean();

  if (!room) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "Room not found");
  }

  const document = typeof room.document === "string" ? room.document : "";

  return createMemoryState({
    document,
    version: room.documentVersion,
    recentDeltas: room.recentDeltas,
    lineOwnership: room.lineOwnership,
    charOwnership: room.charOwnership
  });
};

const getMemoryState = async (roomCode) => {
  const normalizedRoomCode = assertRoomCode(roomCode);
  const cachedState = memoryDocuments.get(normalizedRoomCode);

  if (cachedState) {
    return cachedState;
  }

  const hydratedState = await loadDocumentFromMongo(normalizedRoomCode);
  memoryDocuments.set(normalizedRoomCode, hydratedState);
  return hydratedState;
};

export const getDocumentKey = (roomCode) => `room:${assertRoomCode(roomCode)}:document`;
export const getVersionKey = (roomCode) => `room:${assertRoomCode(roomCode)}:version`;
export const getRecentDeltasKey = (roomCode) => `room:${assertRoomCode(roomCode)}:recentDeltas`;
export const getLineOwnershipKey = (roomCode) => `room:${assertRoomCode(roomCode)}:lineOwnership`;
export const getCharOwnershipKey = (roomCode) => `room:${assertRoomCode(roomCode)}:charOwnership`;
export const getDirtyKey = (roomCode) => `room:${assertRoomCode(roomCode)}:dirty`;
export const getDirtyDeltaCountKey = (roomCode) =>
  `room:${assertRoomCode(roomCode)}:dirtyDeltaCount`;
export const getDirtySinceKey = (roomCode) => `room:${assertRoomCode(roomCode)}:dirtySince`;

export const hydrateDocumentCache = async (roomCode) => {
  const normalizedRoomCode = assertRoomCode(roomCode);
  const state = await loadDocumentFromMongo(normalizedRoomCode);

  if (!hasRedisConnection()) {
    return setMemoryState(normalizedRoomCode, state);
  }

  const multi = redisClient.multi();
  multi.set(getDocumentKey(normalizedRoomCode), state.document);
  multi.set(getVersionKey(normalizedRoomCode), String(state.version));
  multi.set(getLineOwnershipKey(normalizedRoomCode), JSON.stringify(state.lineOwnership));
  multi.set(getCharOwnershipKey(normalizedRoomCode), JSON.stringify(state.charOwnership));
  multi.del(getRecentDeltasKey(normalizedRoomCode));
  multi.del(getDirtyDeltaCountKey(normalizedRoomCode));
  multi.del(getDirtySinceKey(normalizedRoomCode));

  for (const delta of state.recentDeltas) {
    multi.rPush(getRecentDeltasKey(normalizedRoomCode), JSON.stringify(delta));
  }

  multi.lTrim(getRecentDeltasKey(normalizedRoomCode), -RECENT_DELTAS_LIMIT, -1);
  await multi.exec();

  return state;
};

export const getCachedDocument = async (roomCode) => {
  if (!hasRedisConnection()) {
    const state = await getMemoryState(roomCode);
    return state.document;
  }

  const document = await redisClient.get(getDocumentKey(roomCode));

  if (document !== null) {
    return document;
  }

  const hydrated = await hydrateDocumentCache(roomCode);
  return hydrated.document;
};

export const setCachedDocument = async (roomCode, document) => {
  const safeDocument = typeof document === "string" ? document : "";

  if (!hasRedisConnection()) {
    const state = await getMemoryState(roomCode);
    state.document = safeDocument;
    state.charOwnership = normalizeCharOwnership(state.charOwnership, safeDocument);
    return state.document;
  }

  await redisClient.set(getDocumentKey(roomCode), safeDocument);
  return safeDocument;
};

export const getCachedVersion = async (roomCode) => {
  if (!hasRedisConnection()) {
    const state = await getMemoryState(roomCode);
    return state.version;
  }

  const version = await redisClient.get(getVersionKey(roomCode));

  if (version !== null) {
    return parseVersion(version);
  }

  const hydrated = await hydrateDocumentCache(roomCode);
  return hydrated.version;
};

export const setCachedVersion = async (roomCode, version) => {
  const safeVersion = parseVersion(version);

  if (!hasRedisConnection()) {
    const state = await getMemoryState(roomCode);
    state.version = safeVersion;
    return state.version;
  }

  await redisClient.set(getVersionKey(roomCode), String(safeVersion));
  return safeVersion;
};

export const incrementCachedVersion = async (roomCode) => {
  if (!hasRedisConnection()) {
    const state = await getMemoryState(roomCode);
    state.version += 1;
    return state.version;
  }

  const versionKey = getVersionKey(roomCode);
  const exists = await redisClient.exists(versionKey);

  if (!exists) {
    await hydrateDocumentCache(roomCode);
  }

  return redisClient.incr(versionKey);
};

export const pushRecentDelta = async (roomCode, delta) => {
  if (!hasRedisConnection()) {
    const state = await getMemoryState(roomCode);
    const safeDelta = delta && typeof delta === "object" ? delta : {};

    state.recentDeltas.push(safeDelta);
    state.recentDeltas = state.recentDeltas.slice(-RECENT_DELTAS_LIMIT);
    return safeDelta;
  }

  const recentDeltasKey = getRecentDeltasKey(roomCode);
  const safeDelta = delta && typeof delta === "object" ? delta : {};
  const serializedDelta = JSON.stringify(safeDelta);

  const multi = redisClient.multi();
  multi.rPush(recentDeltasKey, serializedDelta);
  multi.lTrim(recentDeltasKey, -RECENT_DELTAS_LIMIT, -1);
  multi.expire(recentDeltasKey, RECENT_DELTAS_TTL_SECONDS);
  await multi.exec();

  return safeDelta;
};

export const getRecentDeltas = async (roomCode) => {
  if (!hasRedisConnection()) {
    const state = await getMemoryState(roomCode);
    return state.recentDeltas;
  }

  const recentDeltas = await redisClient.lRange(getRecentDeltasKey(roomCode), 0, -1);

  return recentDeltas
    .map((delta) => parseJson(delta, null))
    .filter(Boolean);
};

export const getLineOwnership = async (roomCode) => {
  if (!hasRedisConnection()) {
    const state = await getMemoryState(roomCode);
    return state.lineOwnership;
  }

  const lineOwnership = await redisClient.get(getLineOwnershipKey(roomCode));

  return parseJson(lineOwnership, {});
};

export const setLineOwnership = async (roomCode, lineOwnership) => {
  const safeLineOwnership = normalizeLineOwnership(lineOwnership);

  if (!hasRedisConnection()) {
    const state = await getMemoryState(roomCode);
    state.lineOwnership = safeLineOwnership;
    return state.lineOwnership;
  }

  await redisClient.set(getLineOwnershipKey(roomCode), JSON.stringify(safeLineOwnership));
  return safeLineOwnership;
};

export const getCharOwnership = async (roomCode) => {
  if (!hasRedisConnection()) {
    const state = await getMemoryState(roomCode);
    return normalizeCharOwnership(state.charOwnership, state.document);
  }

  const document = await getCachedDocument(roomCode);
  const charOwnership = await redisClient.get(getCharOwnershipKey(roomCode));

  return normalizeCharOwnership(parseJson(charOwnership, []), document);
};

export const setCharOwnership = async (roomCode, charOwnership) => {
  if (!hasRedisConnection()) {
    const state = await getMemoryState(roomCode);
    state.charOwnership = normalizeCharOwnership(charOwnership, state.document);
    return state.charOwnership;
  }

  const document = await getCachedDocument(roomCode);
  const safeCharOwnership = normalizeCharOwnership(charOwnership, document);

  await redisClient.set(getCharOwnershipKey(roomCode), JSON.stringify(safeCharOwnership));
  return safeCharOwnership;
};

export const markDocumentDirty = async (roomCode) => {
  if (!hasRedisConnection()) {
    const state = await getMemoryState(roomCode);
    state.dirty = true;
    state.dirtyDeltaCount += 1;
    state.dirtySince = state.dirtySince || Date.now();
    return state.dirtyDeltaCount;
  }

  const normalizedRoomCode = assertRoomCode(roomCode);
  const dirtyKey = getDirtyKey(normalizedRoomCode);
  const dirtyDeltaCountKey = getDirtyDeltaCountKey(normalizedRoomCode);
  const dirtySinceKey = getDirtySinceKey(normalizedRoomCode);
  const now = Date.now();
  const multi = redisClient.multi();

  multi.set(dirtyKey, "1");
  multi.incr(dirtyDeltaCountKey);
  multi.set(dirtySinceKey, String(now), { NX: true });

  const results = await multi.exec();
  const dirtyDeltaCountResult = results?.[1];
  const dirtyDeltaCount = Array.isArray(dirtyDeltaCountResult)
    ? dirtyDeltaCountResult[1]
    : dirtyDeltaCountResult;

  return Number(dirtyDeltaCount) || 1;
};

export const clearDocumentDirty = async (roomCode) => {
  if (!hasRedisConnection()) {
    const state = await getMemoryState(roomCode);
    state.dirty = false;
    state.dirtyDeltaCount = 0;
    state.dirtySince = null;
    return false;
  }

  const normalizedRoomCode = assertRoomCode(roomCode);

  await redisClient.del([
    getDirtyKey(normalizedRoomCode),
    getDirtyDeltaCountKey(normalizedRoomCode),
    getDirtySinceKey(normalizedRoomCode)
  ]);
  return false;
};

export const isDocumentDirty = async (roomCode) => {
  if (!hasRedisConnection()) {
    const state = await getMemoryState(roomCode);
    return state.dirty;
  }

  const dirty = await redisClient.get(getDirtyKey(roomCode));

  return dirty === "1";
};

export const getDirtyDeltaCount = async (roomCode) => {
  if (!hasRedisConnection()) {
    const state = await getMemoryState(roomCode);
    return state.dirtyDeltaCount;
  }

  const dirtyDeltaCount = await redisClient.get(getDirtyDeltaCountKey(roomCode));
  const numericCount = Number(dirtyDeltaCount);

  return Number.isInteger(numericCount) && numericCount > 0 ? numericCount : 0;
};
