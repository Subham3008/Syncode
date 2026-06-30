import { nanoid } from "nanoid";
import { HTTP_STATUS } from "../../constants/httpStatus.js";
import {
  DEFAULT_ROOM_NAME,
  PARTICIPANT_COLORS
} from "../../constants/roomConstants.js";
import { Room } from "../../models/room.model.js";
import { assertCanKick, assertIsHost } from "../host/host.service.js";
import { ApiError } from "../../utils/ApiError.js";
import { generateRoomCode } from "../../utils/generateRoomCode.js";

const createUserId = () => `user_${nanoid(12)}`;

const now = () => new Date();

const createParticipant = ({ userId, username, room, isHost = false, socketId = null }) => ({
  userId,
  username,
  socketId,
  color: pickParticipantColor(room),
  isOnline: Boolean(socketId),
  isHost,
  joinedAt: now(),
  lastSeen: now()
});

const pickParticipantColor = (room) => {
  const usedColors = new Set(room?.participants?.map((participant) => participant.color) ?? []);
  return PARTICIPANT_COLORS.find((color) => !usedColors.has(color)) ?? PARTICIPANT_COLORS[0];
};

const addActivity = (room, activity) => {
  room.activityLog.push({
    ...activity,
    timestamp: now()
  });
};

const createUniqueRoomCode = async () => {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const roomCode = generateRoomCode();
    const existingRoom = await Room.exists({ roomCode });

    if (!existingRoom) {
      return roomCode;
    }
  }

  throw new ApiError(HTTP_STATUS.CONFLICT, "Could not generate a unique room code. Please try again");
};

const findRoomOrThrow = async (roomCode) => {
  const room = await Room.findOne({ roomCode });

  if (!room) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "Room not found");
  }

  return room;
};

const ensureRoomIsActive = (room) => {
  if (!room.isActive) {
    throw new ApiError(HTTP_STATUS.CONFLICT, "This room has been closed");
  }
};

const ensureRoomIsJoinable = (room) => {
  ensureRoomIsActive(room);

  if (room.isLocked) {
    throw new ApiError(HTTP_STATUS.FORBIDDEN, "This room is locked by the host");
  }
};

export const createRoom = async ({ username }) => {
  const userId = createUserId();
  const roomCode = await createUniqueRoomCode();
  const roomSeed = { participants: [] };
  const hostParticipant = createParticipant({
    userId,
    username,
    room: roomSeed,
    isHost: true
  });

  const room = await Room.create({
    roomCode,
    roomName: DEFAULT_ROOM_NAME,
    hostId: userId,
    hostName: username,
    participants: [hostParticipant],
    activityLog: [
      {
        type: "room_created",
        userId,
        username,
        message: `${username} created the room`,
        timestamp: now()
      }
    ]
  });

  return { room, sessionUser: hostParticipant };
};

export const joinRoom = async ({ roomCode, username }) => {
  const room = await findRoomOrThrow(roomCode);
  ensureRoomIsJoinable(room);

  const participant = createParticipant({
    userId: createUserId(),
    username,
    room
  });

  room.participants.push(participant);
  addActivity(room, {
    type: "user_joined",
    userId: participant.userId,
    username,
    message: `${username} joined the room`
  });

  await room.save();
  return { room, sessionUser: participant };
};

export const rejoinRoom = async ({ roomCode, userId }) => {
  const normalizedRoomCode = typeof roomCode === "string" ? roomCode.trim().toUpperCase() : "";
  const normalizedUserId = typeof userId === "string" ? userId.trim() : "";

  if (!normalizedRoomCode || !normalizedUserId) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, "roomCode and userId are required");
  }

  const room = await Room.findOne({ roomCode: normalizedRoomCode });

  if (!room) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "Room not found");
  }

  if (!room.isActive) {
    throw new ApiError(HTTP_STATUS.FORBIDDEN, "Room is closed");
  }

  const participant = room.participants.find((item) => item.userId === normalizedUserId);

  if (!participant) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "Participant not found in this room");
  }

  const lastSeen = now();
  const updateResult = await Room.updateOne(
    {
      roomCode: normalizedRoomCode,
      "participants.userId": normalizedUserId
    },
    {
      $set: {
        "participants.$.isOnline": true,
        "participants.$.lastSeen": lastSeen
      }
    }
  );

  if (!updateResult.matchedCount) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "Participant not found in this room");
  }

  const updatedRoom = await Room.findOne({ roomCode: normalizedRoomCode });
  const updatedParticipant = updatedRoom?.participants.find(
    (item) => item.userId === normalizedUserId
  );

  if (!updatedRoom || !updatedParticipant) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "Participant not found in this room");
  }

  return { room: updatedRoom, sessionUser: updatedParticipant };
};

export const getRoomByCode = async (roomCode) => {
  return findRoomOrThrow(roomCode);
};

export const renameRoom = async ({ roomCode, userId, roomName }) => {
  const room = await findRoomOrThrow(roomCode);
  ensureRoomIsActive(room);
  assertIsHost(room, userId);

  room.roomName = roomName;
  addActivity(room, {
    type: "room_renamed",
    userId,
    username: room.hostName,
    message: `Room renamed to ${roomName}`
  });

  await room.save();
  return room;
};

export const kickParticipant = async ({ roomCode, hostId, targetUserId }) => {
  const room = await findRoomOrThrow(roomCode);
  ensureRoomIsActive(room);
  const targetParticipant = assertCanKick(room, hostId, targetUserId);

  room.participants = room.participants.filter(
    (participant) => participant.userId !== targetUserId
  );
  addActivity(room, {
    type: "user_kicked",
    userId: targetParticipant.userId,
    username: targetParticipant.username,
    message: `${targetParticipant.username} was removed by the host`
  });

  await room.save();
  return { room, kickedParticipant: targetParticipant };
};

export const setRoomLock = async ({ roomCode, userId, isLocked }) => {
  const room = await findRoomOrThrow(roomCode);
  ensureRoomIsActive(room);
  assertIsHost(room, userId);

  room.isLocked = isLocked;
  addActivity(room, {
    type: isLocked ? "room_locked" : "room_unlocked",
    userId,
    username: room.hostName,
    message: isLocked ? "Room locked by host" : "Room unlocked by host"
  });

  await room.save();
  return room;
};

export const closeRoom = async ({ roomCode, userId }) => {
  const room = await findRoomOrThrow(roomCode);
  ensureRoomIsActive(room);
  assertIsHost(room, userId);

  room.isActive = false;
  addActivity(room, {
    type: "room_closed",
    userId,
    username: room.hostName,
    message: "Room closed by host"
  });

  await room.save();
  return room;
};

export const markParticipantOnline = async ({ roomCode, userId, socketId }) => {
  const room = await findRoomOrThrow(roomCode);
  ensureRoomIsActive(room);

  const participant = room.participants.find((item) => item.userId === userId);

  if (!participant) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "Participant not found");
  }

  participant.socketId = socketId;
  participant.isOnline = true;
  participant.lastSeen = now();

  await room.save();
  return { room, participant };
};

export const markParticipantOffline = async ({ roomCode, userId }) => {
  const room = await findRoomOrThrow(roomCode);
  const participant = room.participants.find((item) => item.userId === userId);

  if (!participant) {
    return null;
  }

  participant.socketId = null;
  participant.isOnline = false;
  participant.lastSeen = now();
  addActivity(room, {
    type: "user_left",
    userId,
    username: participant.username,
    message: `${participant.username} left the room`
  });

  await room.save();
  return { room, participant };
};

export const removeParticipantFromRoom = async ({ roomCode, userId }) => {
  const room = await findRoomOrThrow(roomCode);
  const participant = room.participants.find((item) => item.userId === userId);

  if (!participant) {
    return null;
  }

  room.participants = room.participants.filter((item) => item.userId !== userId);
  addActivity(room, {
    type: "user_left",
    userId,
    username: participant.username,
    message: `${participant.username} left the room`
  });

  await room.save();
  return { room, participant };
};
