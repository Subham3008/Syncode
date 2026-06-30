import { SOCKET_EVENTS } from "../constants/socketEvents.js";
import { toRoomDTO } from "../modules/rooms/room.dto.js";
import {
  getSocketIdByUser,
  removeSocketFromRoom,
  removeSocketUser
} from "./socket.store.js";

export const broadcastRoomState = (io, room, eventName) => {
  if (!io || !room) {
    return;
  }

  const roomDTO = toRoomDTO(room);

  if (eventName) {
    io.to(room.roomCode).emit(eventName, roomDTO);
  }

  io.to(room.roomCode).emit(SOCKET_EVENTS.PARTICIPANTS_UPDATED, roomDTO.participants);
  io.to(room.roomCode).emit(SOCKET_EVENTS.ACTIVITY_UPDATED, roomDTO.activityLog);
};

export const notifyKickedParticipant = (io, room, kickedParticipant) => {
  if (!io || !room || !kickedParticipant) {
    return;
  }

  const targetSocketId = getSocketIdByUser(kickedParticipant.userId);

  if (!targetSocketId) {
    return;
  }

  io.to(targetSocketId).emit(SOCKET_EVENTS.USER_KICKED, {
    roomCode: room.roomCode,
    message: "You were removed from the room by the host"
  });
  io.sockets.sockets.get(targetSocketId)?.leave(room.roomCode);
  removeSocketFromRoom(room.roomCode, targetSocketId);
  removeSocketUser(targetSocketId);
};
