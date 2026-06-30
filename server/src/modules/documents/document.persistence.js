import { HTTP_STATUS } from "../../constants/httpStatus.js";
import { MAX_RECENT_DELTAS } from "../../constants/roomConstants.js";
import { Room } from "../../models/room.model.js";
import { ApiError } from "../../utils/ApiError.js";
import {
  clearDocumentDirty,
  getCachedDocument,
  getCachedVersion,
  getLineOwnership,
  getRecentDeltas
} from "./document.cache.js";

const SAVE_DELAY_MS = 3000;

const saveTimers = new Map();
const activeFlushes = new Map();

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

const clearScheduledSave = (roomCode) => {
  const existingTimer = saveTimers.get(roomCode);

  if (existingTimer) {
    clearTimeout(existingTimer);
    saveTimers.delete(roomCode);
  }
};

const persistRoomDocument = async (roomCode) => {
  const document = await getCachedDocument(roomCode);
  const version = await getCachedVersion(roomCode);
  const recentDeltas = await getRecentDeltas(roomCode);
  const lineOwnership = await getLineOwnership(roomCode);
  const persistedRecentDeltas = recentDeltas.slice(-MAX_RECENT_DELTAS);
  const updateResult = await Room.updateOne(
    { roomCode },
    {
      $set: {
        document,
        documentVersion: version,
        recentDeltas: persistedRecentDeltas,
        lineOwnership,
        updatedAt: new Date()
      }
    }
  );

  if (!updateResult.matchedCount) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "Room not found");
  }

  const latestVersion = await getCachedVersion(roomCode);
  const isFullyPersisted = latestVersion === version;

  if (isFullyPersisted) {
    await clearDocumentDirty(roomCode);
  } else {
    scheduleDocumentSave(roomCode);
  }

  return {
    roomCode,
    document,
    version,
    latestVersion,
    recentDeltas: persistedRecentDeltas,
    lineOwnership,
    isFullyPersisted
  };
};

export const flushDocumentToMongo = async (roomCode) => {
  const normalizedRoomCode = assertRoomCode(roomCode);
  const activeFlush = activeFlushes.get(normalizedRoomCode);

  clearScheduledSave(normalizedRoomCode);

  if (activeFlush) {
    return activeFlush;
  }

  const flushPromise = persistRoomDocument(normalizedRoomCode)
    .finally(() => {
      if (activeFlushes.get(normalizedRoomCode) === flushPromise) {
        activeFlushes.delete(normalizedRoomCode);
      }
    });

  activeFlushes.set(normalizedRoomCode, flushPromise);
  return flushPromise;
};

export const scheduleDocumentSave = (roomCode) => {
  const normalizedRoomCode = assertRoomCode(roomCode);

  clearScheduledSave(normalizedRoomCode);

  const timer = setTimeout(async () => {
    saveTimers.delete(normalizedRoomCode);

    try {
      await flushDocumentToMongo(normalizedRoomCode);
    } catch (error) {
      console.error(
        `[documents] Failed to flush room ${normalizedRoomCode} to MongoDB: ${error.message}`
      );
    }
  }, SAVE_DELAY_MS);

  timer.unref?.();
  saveTimers.set(normalizedRoomCode, timer);
};
