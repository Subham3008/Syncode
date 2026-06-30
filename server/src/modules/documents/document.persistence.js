import { HTTP_STATUS } from "../../constants/httpStatus.js";
import { Room } from "../../models/room.model.js";
import { ApiError } from "../../utils/ApiError.js";
import { logger } from "../../utils/logger.js";
import {
  clearDocumentDirty,
  getCachedDocument,
  getCachedVersion,
  getDirtyDeltaCount
} from "./document.cache.js";

const SAVE_DELAY_MS = 3000;
const DELTA_FLUSH_THRESHOLD = 40;

const saveTimers = new Map();
const activeFlushes = new Map();
let mongoFlushWriteCount = 0;

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
  const startedAt = Date.now();
  const document = await getCachedDocument(roomCode);
  const version = await getCachedVersion(roomCode);
  const updateResult = await Room.updateOne(
    { roomCode },
    {
      $set: {
        document,
        documentVersion: version,
        lastPersistedAt: new Date(),
        updatedAt: new Date()
      },
      $unset: {
        recentDeltas: "",
        lineOwnership: "",
        charOwnership: ""
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
    scheduleDocumentFlush(roomCode).catch((error) => {
      logger.error(
        `[documents] Failed to reschedule Mongo snapshot for room ${roomCode}: ${error.message}`
      );
    });
  }

  mongoFlushWriteCount += 1;
  logger.info(
    `[documents] Mongo snapshot flushed room=${roomCode} version=${version} durationMs=${Date.now() - startedAt} writes=${mongoFlushWriteCount}`
  );

  return {
    roomCode,
    document,
    version,
    latestVersion,
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

export const scheduleDocumentFlush = async (roomCode, options = {}) => {
  const normalizedRoomCode = assertRoomCode(roomCode);
  const delayMs = options.immediate ? 0 : SAVE_DELAY_MS;

  if (!options.immediate) {
    const dirtyDeltaCount = await getDirtyDeltaCount(normalizedRoomCode);

    if (dirtyDeltaCount >= DELTA_FLUSH_THRESHOLD) {
      return scheduleDocumentFlush(normalizedRoomCode, { immediate: true });
    }
  }

  clearScheduledSave(normalizedRoomCode);

  const timer = setTimeout(async () => {
    saveTimers.delete(normalizedRoomCode);

    try {
      await flushDocumentToMongo(normalizedRoomCode);
    } catch (error) {
      console.error(
        `[documents] Failed to flush room ${normalizedRoomCode} to MongoDB: ${error.message}`
      );
      scheduleDocumentFlush(normalizedRoomCode).catch((scheduleError) => {
        console.error(
          `[documents] Failed to reschedule MongoDB flush for ${normalizedRoomCode}: ${scheduleError.message}`
        );
      });
    }
  }, delayMs);

  timer.unref?.();
  saveTimers.set(normalizedRoomCode, timer);
  logger.info(
    `[documents] Mongo snapshot scheduled room=${normalizedRoomCode} delayMs=${delayMs} at=${Date.now()}`
  );
};

export const scheduleDocumentSave = scheduleDocumentFlush;
