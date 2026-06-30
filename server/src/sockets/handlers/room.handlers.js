import { ZodError } from "zod";
import { SOCKET_EVENTS } from "../../constants/socketEvents.js";
import { toRoomDTO, toRoomSessionDTO } from "../../modules/rooms/room.dto.js";
import {
  joinRoom,
  markParticipantOffline,
  markParticipantOnline,
  rejoinRoom,
  removeParticipantFromRoom
} from "../../modules/rooms/room.service.js";
import {
  roomSocketJoinSchema,
  roomSocketLeaveSchema,
  roomSocketRejoinSchema
} from "../../modules/rooms/room.validator.js";
import {
  emitPresenceList,
  removePresenceParticipant,
  upsertPresenceParticipant
} from "../../modules/presence/presence.service.js";
import { flushDocumentToMongo } from "../../modules/documents/document.persistence.js";
import { logger } from "../../utils/logger.js";
import {
  addSocketToRoom,
  addSocketUser,
  clearSocketFromAllMaps,
  getSocketIdByUser,
  getRoomSockets,
  getUserBySocket,
  removeSocketFromRoom
} from "../socket.store.js";

const DISCONNECT_REJOIN_GRACE_MS = 1500;
const pendingDisconnects = new Map();

const getErrorMessage = (error) => {
  if (error instanceof ZodError) {
    return error.issues.map((issue) => issue.message).join(", ");
  }

  return error.message || "Socket request failed";
};

const emitRoomError = (socket, error) => {
  socket.emit(SOCKET_EVENTS.ROOM_ERROR, {
    message: getErrorMessage(error)
  });
};

const emitRoomState = (io, room) => {
  const roomDTO = toRoomDTO(room);
  io.to(room.roomCode).emit(SOCKET_EVENTS.PARTICIPANTS_UPDATED, roomDTO.participants);
  io.to(room.roomCode).emit(SOCKET_EVENTS.ACTIVITY_UPDATED, roomDTO.activityLog);
  emitPresenceList(io, room.roomCode, room.participants, room.hostId);
};

const getDisconnectKey = ({ roomCode, userId }) => `${roomCode}:${userId}`;

const clearPendingDisconnect = ({ roomCode, userId }) => {
  if (!roomCode || !userId) {
    return;
  }

  const disconnectKey = getDisconnectKey({ roomCode, userId });
  const timeoutId = pendingDisconnects.get(disconnectKey);

  if (timeoutId) {
    clearTimeout(timeoutId);
    pendingDisconnects.delete(disconnectKey);
  }
};

const scheduleParticipantOffline = ({ io, roomCode, userId, socketId }) => {
  if (!roomCode || !userId) {
    return;
  }

  clearPendingDisconnect({ roomCode, userId });

  const disconnectKey = getDisconnectKey({ roomCode, userId });
  const timeoutId = setTimeout(async () => {
    pendingDisconnects.delete(disconnectKey);

    if (getSocketIdByUser(userId)) {
      return;
    }

    try {
      const result = await markParticipantOffline({ roomCode, userId, socketId });

      if (result?.room && !result.isStaleSocket && !result.wasAlreadyOffline) {
        io.to(roomCode).emit(SOCKET_EVENTS.ROOM_LEFT, {
          userId,
          username: result.participant.username
        });
        emitRoomState(io, result.room);
      }

      if (roomCode && getRoomSockets(roomCode).size === 0) {
        try {
          await flushDocumentToMongo(roomCode);
        } catch (error) {
          logger.error(
            `[rooms] Failed to flush room ${roomCode} after disconnect: ${error.message}`
          );
        }
      }
    } catch {
      // The room may have been closed or the participant removed while the grace timer was pending.
    }
  }, DISCONNECT_REJOIN_GRACE_MS);

  pendingDisconnects.set(disconnectKey, timeoutId);
};

const attachSocketToRoom = async ({ io, socket, room, sessionUser }) => {
  clearPendingDisconnect({
    roomCode: room.roomCode,
    userId: sessionUser.userId
  });

  const previousSocketId = getSocketIdByUser(sessionUser.userId);

  if (previousSocketId && previousSocketId !== socket.id) {
    const previousUser = getUserBySocket(previousSocketId);

    if (previousUser?.roomCode) {
      io.sockets.sockets.get(previousSocketId)?.leave(previousUser.roomCode);
    }

    clearSocketFromAllMaps(previousSocketId);
  }

  const existingUser = getUserBySocket(socket.id);

  if (existingUser?.roomCode && existingUser.roomCode !== room.roomCode) {
    socket.leave(existingUser.roomCode);
    removeSocketFromRoom(existingUser.roomCode, socket.id);
  }

  socket.join(room.roomCode);
  addSocketUser(socket.id, {
    color: sessionUser.color,
    roomCode: room.roomCode,
    userId: sessionUser.userId,
    username: sessionUser.username
  });
  addSocketToRoom(room.roomCode, socket.id);
  logger.info(
    `[room-socket] joined socket=${socket.id} user=${sessionUser.userId} room=${room.roomCode}`
  );

  const { room: onlineRoom, participant } = await markParticipantOnline({
    roomCode: room.roomCode,
    userId: sessionUser.userId,
    socketId: socket.id
  });

  socket.emit(SOCKET_EVENTS.ROOM_JOINED, toRoomSessionDTO(onlineRoom, participant));
  socket.to(room.roomCode).emit(SOCKET_EVENTS.ROOM_JOINED, {
    room: toRoomDTO(onlineRoom),
    participant: {
      userId: participant.userId,
      username: participant.username
    }
  });
  emitRoomState(io, onlineRoom);
  upsertPresenceParticipant({
    io,
    room: onlineRoom,
    participant,
    socketId: socket.id
  });
};

const detachSocketFromRoom = async ({ io, socket, roomCode, userId }) => {
  const userData = clearSocketFromAllMaps(socket.id) ?? { roomCode, userId };

  if (userData.roomCode) {
    removePresenceParticipant({
      io,
      roomCode: userData.roomCode,
      socketId: socket.id,
      userId: userData.userId
    });
    socket.leave(userData.roomCode);
  }

  const activeSocketId = getSocketIdByUser(userData.userId);

  if (activeSocketId && activeSocketId !== socket.id) {
    return;
  }

  scheduleParticipantOffline({
    io,
    roomCode: userData.roomCode,
    userId: userData.userId,
    socketId: socket.id
  });
};

const leaveSocketRoom = async ({ io, socket, roomCode, userId }) => {
  const userData = clearSocketFromAllMaps(socket.id) ?? { roomCode, userId };

  clearPendingDisconnect(userData);

  if (userData.roomCode) {
    socket.leave(userData.roomCode);
  }

  const result = await removeParticipantFromRoom({
    roomCode: userData.roomCode,
    userId: userData.userId
  });

  if (result?.room) {
    removePresenceParticipant({
      hostId: result.room.hostId,
      io,
      roomCode: userData.roomCode,
      socketId: socket.id,
      userId: userData.userId,
      participants: result.room.participants
    });
    socket.to(userData.roomCode).emit(SOCKET_EVENTS.ROOM_LEFT, {
      userId: userData.userId,
      username: result.participant.username
    });
    emitRoomState(io, result.room);
  }

  removeSocketFromRoom(userData.roomCode, socket.id);

  if (userData.roomCode && getRoomSockets(userData.roomCode).size === 0) {
    try {
      await flushDocumentToMongo(userData.roomCode);
    } catch (error) {
      logger.error(
        `[rooms] Failed to flush room ${userData.roomCode} after leave: ${error.message}`
      );
    }
  }
};

export const registerRoomHandlers = (io, socket) => {
  socket.on(SOCKET_EVENTS.ROOM_JOIN, async (payload = {}) => {
    try {
      const data = roomSocketJoinSchema.parse(payload);
      const { room, sessionUser } = await joinRoom(data);
      await attachSocketToRoom({ io, socket, room, sessionUser });
    } catch (error) {
      emitRoomError(socket, error);
    }
  });

  socket.on(SOCKET_EVENTS.ROOM_REJOIN, async (payload = {}) => {
    try {
      const data = roomSocketRejoinSchema.parse(payload);
      const { room, sessionUser } = await rejoinRoom(data);
      await attachSocketToRoom({ io, socket, room, sessionUser });
    } catch (error) {
      emitRoomError(socket, error);
    }
  });

  socket.on(SOCKET_EVENTS.ROOM_LEAVE, async (payload = {}, acknowledge) => {
    try {
      const storedUser = getUserBySocket(socket.id);
      const data = storedUser ?? roomSocketLeaveSchema.parse(payload);
      await leaveSocketRoom({ io, socket, ...data });

      if (typeof acknowledge === "function") {
        acknowledge({ success: true });
      }
    } catch (error) {
      if (typeof acknowledge === "function") {
        acknowledge({
          success: false,
          message: getErrorMessage(error)
        });
      }

      emitRoomError(socket, error);
    }
  });

  socket.on(SOCKET_EVENTS.DISCONNECT, async () => {
    const userData = getUserBySocket(socket.id);

    if (!userData) {
      return;
    }

    try {
      await detachSocketFromRoom({ io, socket, ...userData });
    } catch {
      clearSocketFromAllMaps(socket.id);
    }
  });
};
