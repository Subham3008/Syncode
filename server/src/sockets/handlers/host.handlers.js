import { ZodError } from "zod";
import { SOCKET_EVENTS } from "../../constants/socketEvents.js";
import { toRoomDTO } from "../../modules/rooms/room.dto.js";
import {
  closeRoom,
  kickParticipant,
  renameRoom,
  setRoomLock
} from "../../modules/rooms/room.service.js";
import {
  hostCloseRoomSocketSchema,
  hostKickUserSocketSchema,
  hostLockRoomSocketSchema,
  hostRenameRoomSocketSchema
} from "../../modules/rooms/room.validator.js";
import {
  getSocketIdByUser,
  removeSocketFromRoom,
  removeSocketUser
} from "../socket.store.js";

const getErrorMessage = (error) => {
  if (error instanceof ZodError) {
    return error.issues.map((issue) => issue.message).join(", ");
  }

  return error.message || "Host action failed";
};

const emitHostError = (socket, error) => {
  socket.emit(SOCKET_EVENTS.ROOM_ERROR, {
    message: getErrorMessage(error)
  });
};

const broadcastRoomState = (io, room, eventName) => {
  const roomDTO = toRoomDTO(room);

  if (eventName) {
    io.to(room.roomCode).emit(eventName, roomDTO);
  }

  io.to(room.roomCode).emit(SOCKET_EVENTS.PARTICIPANTS_UPDATED, roomDTO.participants);
  io.to(room.roomCode).emit(SOCKET_EVENTS.ACTIVITY_UPDATED, roomDTO.activityLog);
};

export const registerHostHandlers = (io, socket) => {
  socket.on(SOCKET_EVENTS.HOST_RENAME_ROOM, async (payload = {}) => {
    try {
      const data = hostRenameRoomSocketSchema.parse(payload);
      const room = await renameRoom(data);
      broadcastRoomState(io, room, SOCKET_EVENTS.ROOM_RENAMED);
    } catch (error) {
      emitHostError(socket, error);
    }
  });

  socket.on(SOCKET_EVENTS.HOST_KICK_USER, async (payload = {}) => {
    try {
      const data = hostKickUserSocketSchema.parse(payload);
      const { room, kickedParticipant } = await kickParticipant(data);
      const targetSocketId = getSocketIdByUser(kickedParticipant.userId);

      if (targetSocketId) {
        io.to(targetSocketId).emit(SOCKET_EVENTS.USER_KICKED, {
          roomCode: room.roomCode,
          message: "You were removed from the room by the host"
        });
        io.sockets.sockets.get(targetSocketId)?.leave(room.roomCode);
        removeSocketFromRoom(room.roomCode, targetSocketId);
        removeSocketUser(targetSocketId);
      }

      broadcastRoomState(io, room);
    } catch (error) {
      emitHostError(socket, error);
    }
  });

  socket.on(SOCKET_EVENTS.HOST_LOCK_ROOM, async (payload = {}) => {
    try {
      const data = hostLockRoomSocketSchema.parse(payload);
      const room = await setRoomLock(data);
      broadcastRoomState(io, room, SOCKET_EVENTS.ROOM_LOCKED);
    } catch (error) {
      emitHostError(socket, error);
    }
  });

  socket.on(SOCKET_EVENTS.HOST_CLOSE_ROOM, async (payload = {}) => {
    try {
      const data = hostCloseRoomSocketSchema.parse(payload);
      const room = await closeRoom(data);
      broadcastRoomState(io, room, SOCKET_EVENTS.ROOM_CLOSED);
    } catch (error) {
      emitHostError(socket, error);
    }
  });
};
