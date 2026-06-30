import { ZodError } from "zod";
import { SOCKET_EVENTS } from "../../constants/socketEvents.js";
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
  broadcastRoomState,
  notifyKickedParticipant
} from "../room.broadcast.js";

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

      notifyKickedParticipant(io, room, kickedParticipant);
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
