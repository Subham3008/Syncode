import { HTTP_STATUS } from "../../constants/httpStatus.js";
import { SOCKET_EVENTS } from "../../constants/socketEvents.js";
import { ApiError } from "../../utils/ApiError.js";
import { updateTypingPresence } from "../../modules/presence/presence.service.js";
import { getUserBySocket } from "../socket.store.js";

const normalizeRoomCode = (roomCode) => {
  if (typeof roomCode !== "string") {
    return "";
  }

  return roomCode.trim().toUpperCase();
};

const normalizePayload = (payload) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {};
  }

  return payload;
};

const getErrorPayload = (error) => ({
  message: error.message || "Presence update failed",
  statusCode: error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR
});

const assertSocketCanAccessRoom = ({ socket, roomCode }) => {
  const normalizedRoomCode = normalizeRoomCode(roomCode);

  if (!normalizedRoomCode) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, "roomCode is required");
  }

  const storedUser = getUserBySocket(socket.id);

  if (!storedUser || normalizeRoomCode(storedUser.roomCode) !== normalizedRoomCode) {
    throw new ApiError(HTTP_STATUS.FORBIDDEN, "Join the room before sending presence");
  }

  return {
    color: storedUser.color,
    roomCode: normalizedRoomCode,
    userId: storedUser.userId,
    username: storedUser.username
  };
};

export const registerPresenceHandlers = (io, socket) => {
  const handleTypingStart = (payload = {}) => {
    try {
      const safePayload = normalizePayload(payload);
      const typingUser = assertSocketCanAccessRoom({
        socket,
        roomCode: safePayload.roomCode
      });

      updateTypingPresence({
        io,
        roomCode: typingUser.roomCode,
        socketId: socket.id,
        isTyping: true,
        cursorPosition: Number.isInteger(safePayload.cursorPosition)
          ? safePayload.cursorPosition
          : null
      });
    } catch (error) {
      socket.emit(SOCKET_EVENTS.PRESENCE_ERROR, getErrorPayload(error));
    }
  };

  const handleTypingStop = (payload = {}) => {
    try {
      const safePayload = normalizePayload(payload);
      const typingUser = assertSocketCanAccessRoom({
        socket,
        roomCode: safePayload.roomCode
      });

      updateTypingPresence({
        io,
        roomCode: typingUser.roomCode,
        socketId: socket.id,
        isTyping: false
      });
    } catch (error) {
      socket.emit(SOCKET_EVENTS.PRESENCE_ERROR, getErrorPayload(error));
    }
  };

  socket.on(SOCKET_EVENTS.PRESENCE_TYPING, handleTypingStart);
  socket.on(SOCKET_EVENTS.PRESENCE_STOP_TYPING, handleTypingStop);
  socket.on(SOCKET_EVENTS.TYPING_START, handleTypingStart);
  socket.on(SOCKET_EVENTS.TYPING_STOP, handleTypingStop);
};
