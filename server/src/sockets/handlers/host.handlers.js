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
  emitPresenceList,
  removePresenceParticipant,
  removeRoomPresence
} from "../../modules/presence/presence.service.js";
import {
  clearSocketFromAllMaps,
  getRoomSockets,
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
  emitPresenceList(io, room.roomCode, room.participants, room.hostId);
};

const acknowledgeSuccess = (acknowledge, room) => {
  if (typeof acknowledge !== "function") {
    return;
  }

  acknowledge({
    success: true,
    data: toRoomDTO(room)
  });
};

const acknowledgeError = (acknowledge, error) => {
  if (typeof acknowledge !== "function") {
    return;
  }

  acknowledge({
    success: false,
    message: getErrorMessage(error)
  });
};

export const registerHostHandlers = (io, socket) => {
  socket.on(SOCKET_EVENTS.HOST_RENAME_ROOM, async (payload = {}, acknowledge) => {
    try {
      const data = hostRenameRoomSocketSchema.parse(payload);
      const room = await renameRoom(data);
      broadcastRoomState(io, room, SOCKET_EVENTS.ROOM_RENAMED);
      acknowledgeSuccess(acknowledge, room);
    } catch (error) {
      emitHostError(socket, error);
      acknowledgeError(acknowledge, error);
    }
  });

  socket.on(SOCKET_EVENTS.HOST_KICK_USER, async (payload = {}, acknowledge) => {
    try {
      const data = hostKickUserSocketSchema.parse(payload);
      const { room, kickedParticipant } = await kickParticipant(data);
      const targetSocketId = getSocketIdByUser(kickedParticipant.userId);

      io.to(room.roomCode).emit(SOCKET_EVENTS.USER_KICKED, {
        roomCode: room.roomCode,
        targetUserId: kickedParticipant.userId,
        message: "You were removed from the room by the host"
      });

      if (targetSocketId) {
        io.sockets.sockets.get(targetSocketId)?.leave(room.roomCode);
        removeSocketFromRoom(room.roomCode, targetSocketId);
        removeSocketUser(targetSocketId);
      }

      removePresenceParticipant({
        hostId: room.hostId,
        io,
        roomCode: room.roomCode,
        socketId: targetSocketId,
        userId: kickedParticipant.userId,
        participants: room.participants
      });

      broadcastRoomState(io, room);
      acknowledgeSuccess(acknowledge, room);
    } catch (error) {
      emitHostError(socket, error);
      acknowledgeError(acknowledge, error);
    }
  });

  socket.on(SOCKET_EVENTS.HOST_LOCK_ROOM, async (payload = {}, acknowledge) => {
    try {
      const data = hostLockRoomSocketSchema.parse(payload);
      const room = await setRoomLock(data);
      broadcastRoomState(io, room, SOCKET_EVENTS.ROOM_LOCKED);
      acknowledgeSuccess(acknowledge, room);
    } catch (error) {
      emitHostError(socket, error);
      acknowledgeError(acknowledge, error);
    }
  });

  socket.on(SOCKET_EVENTS.HOST_CLOSE_ROOM, async (payload = {}, acknowledge) => {
    try {
      const data = hostCloseRoomSocketSchema.parse(payload);
      const room = await closeRoom(data);
      removeRoomPresence({ io, roomCode: room.roomCode });
      broadcastRoomState(io, room, SOCKET_EVENTS.ROOM_CLOSED);

      for (const socketId of Array.from(getRoomSockets(room.roomCode))) {
        io.sockets.sockets.get(socketId)?.leave(room.roomCode);
        clearSocketFromAllMaps(socketId);
      }

      acknowledgeSuccess(acknowledge, room);
    } catch (error) {
      emitHostError(socket, error);
      acknowledgeError(acknowledge, error);
    }
  });
};
