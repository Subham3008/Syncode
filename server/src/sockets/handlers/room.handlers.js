import { ZodError } from "zod";
import { SOCKET_EVENTS } from "../../constants/socketEvents.js";
import { toRoomDTO, toRoomSessionDTO } from "../../modules/rooms/room.dto.js";
import {
  joinRoom,
  leaveRoom,
  markParticipantOffline,
  markParticipantOnline,
  rejoinRoom
} from "../../modules/rooms/room.service.js";
import {
  roomSocketJoinSchema,
  roomSocketLeaveSchema,
  roomSocketRejoinSchema
} from "../../modules/rooms/room.validator.js";
import {
  addSocketToRoom,
  addSocketUser,
  clearSocketFromAllMaps,
  getUserBySocket,
  removeSocketFromRoom
} from "../socket.store.js";

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
};

const attachSocketToRoom = async ({ io, socket, room, sessionUser }) => {
  socket.join(room.roomCode);
  addSocketUser(socket.id, {
    color: sessionUser.color,
    roomCode: room.roomCode,
    userId: sessionUser.userId,
    username: sessionUser.username
  });
  addSocketToRoom(room.roomCode, socket.id);

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
};

const detachSocketFromRoom = async ({ io, socket, roomCode, userId, intentionalLeave = false }) => {
  const userData = clearSocketFromAllMaps(socket.id) ?? { roomCode, userId };

  if (userData.roomCode) {
    socket.leave(userData.roomCode);
  }

  const updatePresence = intentionalLeave ? leaveRoom : markParticipantOffline;
  const result = await updatePresence({
    roomCode: userData.roomCode,
    userId: userData.userId,
    socketId: socket.id
  });

  if (result?.room && !result.ignoredStaleSocket) {
    socket.to(userData.roomCode).emit(SOCKET_EVENTS.ROOM_LEFT, {
      userId: userData.userId,
      username: result.participant.username
    });
    emitRoomState(io, result.room);
  }

  removeSocketFromRoom(userData.roomCode, socket.id);
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

  socket.on(SOCKET_EVENTS.ROOM_LEAVE, async (payload = {}) => {
    try {
      const storedUser = getUserBySocket(socket.id);
      const data = storedUser ?? roomSocketLeaveSchema.parse(payload);
      await detachSocketFromRoom({ io, socket, ...data, intentionalLeave: true });
    } catch (error) {
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
