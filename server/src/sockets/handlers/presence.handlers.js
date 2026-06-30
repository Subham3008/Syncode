import { HTTP_STATUS } from "../../constants/httpStatus.js";
import { SOCKET_EVENTS } from "../../constants/socketEvents.js";
import { ApiError } from "../../utils/ApiError.js";
import { getUserBySocket } from "../socket.store.js";

const TYPING_TTL_MS = 2500;

const typingBySocket = new Map();
const typingTimers = new Map();

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

const getRoomTypingUsers = (roomCode) =>
  Array.from(typingBySocket.values())
    .filter((typingUser) => typingUser.roomCode === roomCode)
    .map(({ color, userId, username }) => ({
      color,
      userId,
      username
    }));

const broadcastTypingUsers = (io, roomCode) => {
  io.to(roomCode).emit(SOCKET_EVENTS.TYPING_UPDATED, {
    roomCode,
    users: getRoomTypingUsers(roomCode)
  });
};

const clearTypingTimer = (socketId) => {
  const timer = typingTimers.get(socketId);

  if (timer) {
    clearTimeout(timer);
    typingTimers.delete(socketId);
  }
};

const stopTyping = ({ io, roomCode = null, socketId }) => {
  const typingUser = typingBySocket.get(socketId);
  const targetRoomCode = roomCode || typingUser?.roomCode;

  clearTypingTimer(socketId);
  typingBySocket.delete(socketId);

  if (targetRoomCode) {
    broadcastTypingUsers(io, targetRoomCode);
  }
};

const scheduleTypingExpiry = ({ io, socketId }) => {
  clearTypingTimer(socketId);

  const timer = setTimeout(() => {
    stopTyping({ io, socketId });
  }, TYPING_TTL_MS);

  timer.unref?.();
  typingTimers.set(socketId, timer);
};

export const registerPresenceHandlers = (io, socket) => {
  socket.on(SOCKET_EVENTS.TYPING_START, (payload = {}) => {
    try {
      const safePayload = normalizePayload(payload);
      const typingUser = assertSocketCanAccessRoom({
        socket,
        roomCode: safePayload.roomCode
      });

      typingBySocket.set(socket.id, typingUser);
      scheduleTypingExpiry({ io, socketId: socket.id });
      broadcastTypingUsers(io, typingUser.roomCode);
    } catch (error) {
      socket.emit(SOCKET_EVENTS.PRESENCE_ERROR, getErrorPayload(error));
    }
  });

  socket.on(SOCKET_EVENTS.TYPING_STOP, (payload = {}) => {
    try {
      const safePayload = normalizePayload(payload);
      const typingUser = assertSocketCanAccessRoom({
        socket,
        roomCode: safePayload.roomCode
      });

      stopTyping({
        io,
        roomCode: typingUser.roomCode,
        socketId: socket.id
      });
    } catch (error) {
      socket.emit(SOCKET_EVENTS.PRESENCE_ERROR, getErrorPayload(error));
    }
  });

  socket.on(SOCKET_EVENTS.ROOM_LEAVE, () => {
    stopTyping({ io, socketId: socket.id });
  });

  socket.on(SOCKET_EVENTS.DISCONNECT, () => {
    stopTyping({ io, socketId: socket.id });
  });
};
