import { HTTP_STATUS } from "../../constants/httpStatus.js";
import { SOCKET_EVENTS } from "../../constants/socketEvents.js";
import {
  applyEditorDelta,
  getDocumentState
} from "../../modules/documents/document.service.js";
import { ApiError } from "../../utils/ApiError.js";
import { getUserBySocket } from "../socket.store.js";

const normalizeRoomCode = (roomCode) => {
  if (typeof roomCode !== "string") {
    return "";
  }

  return roomCode.trim().toUpperCase();
};

const getErrorPayload = (error) => ({
  message: error.message || "Editor sync failed",
  statusCode: error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR
});

const emitEditorError = (socket, error) => {
  socket.emit(SOCKET_EVENTS.EDITOR_ERROR, getErrorPayload(error));
};

const normalizePayload = (payload) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {};
  }

  return payload;
};

const assertSocketCanAccessRoom = ({ socket, roomCode, userId = null }) => {
  const normalizedRoomCode = normalizeRoomCode(roomCode);

  if (!normalizedRoomCode) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, "roomCode is required");
  }

  const storedUser = getUserBySocket(socket.id);

  if (!storedUser || normalizeRoomCode(storedUser.roomCode) !== normalizedRoomCode) {
    throw new ApiError(HTTP_STATUS.FORBIDDEN, "Join the room before syncing the editor");
  }

  if (userId && storedUser.userId !== userId) {
    throw new ApiError(HTTP_STATUS.FORBIDDEN, "Editor user does not match socket session");
  }

  return {
    color: storedUser.color,
    roomCode: normalizedRoomCode,
    userId: storedUser.userId,
    username: storedUser.username
  };
};

export const registerEditorHandlers = (io, socket) => {
  socket.on(SOCKET_EVENTS.EDITOR_GET_STATE, async (payload = {}) => {
    try {
      const safePayload = normalizePayload(payload);
      const { roomCode } = assertSocketCanAccessRoom({
        socket,
        roomCode: safePayload.roomCode
      });
      const documentState = await getDocumentState(roomCode);

      socket.emit(SOCKET_EVENTS.EDITOR_STATE, documentState);
    } catch (error) {
      emitEditorError(socket, error);
    }
  });

  socket.on(SOCKET_EVENTS.EDITOR_DELTA, async (payload = {}, acknowledge) => {
    try {
      const safePayload = normalizePayload(payload);
      const sessionUser = assertSocketCanAccessRoom({
        socket,
        roomCode: safePayload.roomCode,
        userId: safePayload.userId
      });
      const acceptedDelta = await applyEditorDelta({
        ...safePayload,
        roomCode: sessionUser.roomCode,
        userId: sessionUser.userId,
        username: safePayload.username || sessionUser.username,
        color: sessionUser.color
      });

      socket.emit(SOCKET_EVENTS.EDITOR_SYNC, acceptedDelta);
      socket.to(sessionUser.roomCode).emit(SOCKET_EVENTS.EDITOR_DELTA_APPLIED, acceptedDelta);

      if (typeof acknowledge === "function") {
        acknowledge({
          success: true,
          data: acceptedDelta
        });
      }
    } catch (error) {
      emitEditorError(socket, error);

      if (typeof acknowledge === "function") {
        acknowledge({
          success: false,
          message: error.message || "Editor sync failed",
          statusCode: error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR
        });
      }
    }
  });
};
