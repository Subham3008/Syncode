import { nanoid } from "nanoid";
import { HTTP_STATUS } from "../../constants/httpStatus.js";
import {
  DEFAULT_ROOM_NAME,
  PARTICIPANT_COLORS
} from "../../constants/roomConstants.js";
import { Room } from "../../models/room.model.js";
import { assertCanKick, assertIsHost } from "../host/host.service.js";
import { flushDocumentToMongo } from "../documents/document.persistence.js";
import { ApiError } from "../../utils/ApiError.js";
import { generateRoomCode } from "../../utils/generateRoomCode.js";
import { logger } from "../../utils/logger.js";

const createUserId = () => `user_${nanoid(12)}`;

const now = () => new Date();

const normalizeColor = (color) => (typeof color === "string" ? color.trim().toLowerCase() : "");

const hashString = (value = "") => {
  const source = String(value || "participant");
  let hash = 2166136261;

  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
};

const hslToHex = (hue, saturation, lightness) => {
  const s = saturation / 100;
  const l = lightness / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;

  if (hue < 60) {
    r = c;
    g = x;
  } else if (hue < 120) {
    r = x;
    g = c;
  } else if (hue < 180) {
    g = c;
    b = x;
  } else if (hue < 240) {
    g = x;
    b = c;
  } else if (hue < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  const toHex = (channel) =>
    Math.round((channel + m) * 255)
      .toString(16)
      .padStart(2, "0");

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const createGeneratedColor = ({ userId = "", username = "" } = {}, attempt = 0) => {
  const hash = hashString(`${userId}:${username}:${attempt}`);
  const hue = (hash + Math.round(attempt * 137.508)) % 360;
  const saturation = 68 + (hash % 12);
  const lightness = 52 + ((hash >>> 8) % 8);

  return hslToHex(hue, saturation, lightness);
};

const pickColorFromUsed = (usedColors, participant = {}) => {
  const paletteColor = PARTICIPANT_COLORS.find(
    (color) => !usedColors.has(normalizeColor(color))
  );

  if (paletteColor) {
    return paletteColor;
  }

  for (let attempt = 0; attempt < 64; attempt += 1) {
    const generatedColor = createGeneratedColor(participant, attempt);

    if (!usedColors.has(normalizeColor(generatedColor))) {
      return generatedColor;
    }
  }

  return hslToHex((usedColors.size * 137.508) % 360, 72, 56);
};

const pickParticipantColor = (room, participant = {}) => {
  const usedColors = new Set(
    (room?.participants ?? [])
      .map((item) => normalizeColor(item.color))
      .filter(Boolean)
  );

  return pickColorFromUsed(usedColors, participant);
};

const ensureUniqueParticipantColors = (room) => {
  const usedColors = new Set();
  let changed = false;

  for (const participant of room?.participants ?? []) {
    const normalizedColor = normalizeColor(participant.color);

    if (!normalizedColor || usedColors.has(normalizedColor)) {
      participant.color = pickColorFromUsed(usedColors, {
        userId: participant.userId,
        username: participant.username
      });
      changed = true;
    }

    usedColors.add(normalizeColor(participant.color));
  }

  return changed;
};

const createParticipant = ({ userId, username, room, isHost = false, socketId = null }) => ({
  userId,
  username,
  socketId,
  color: pickParticipantColor(room, { userId, username }),
  isOnline: Boolean(socketId),
  isHost,
  joinedAt: now(),
  lastSeen: now()
});

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
  ensureUniqueParticipantColors(room);
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

  const isHostRejoin = room.hostId === normalizedUserId;
  let participant = room.participants.find((item) => item.userId === normalizedUserId);

  if (!participant) {
    if (!isHostRejoin) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, "Participant not found in this room");
    }

    participant = createParticipant({
      userId: normalizedUserId,
      username: room.hostName,
      room,
      isHost: true
    });
    room.participants.push(participant);
  }

  participant.isOnline = true;
  participant.lastSeen = now();

  if (isHostRejoin) {
    participant.isHost = true;
  }

  ensureUniqueParticipantColors(room);
  await room.save();

  return { room, sessionUser: participant };
};

export const getRoomByCode = async (roomCode) => {
  const room = await findRoomOrThrow(roomCode);

  if (ensureUniqueParticipantColors(room)) {
    await room.save();
  }

  return room;
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

  try {
    await flushDocumentToMongo(room.roomCode);
  } catch (error) {
    logger.error(
      `[rooms] Room ${room.roomCode} closed but document snapshot flush failed: ${error.message}`
    );
  }

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

  ensureUniqueParticipantColors(room);
  await room.save();
  return { room, participant };
};

export const markParticipantOffline = async ({ roomCode, userId, socketId = null }) => {
  const room = await findRoomOrThrow(roomCode);
  const participant = room.participants.find((item) => item.userId === userId);

  if (!participant) {
    return null;
  }

  if (socketId && participant.socketId && participant.socketId !== socketId) {
    return { room, participant, isStaleSocket: true };
  }

  participant.socketId = null;
  participant.isOnline = false;
  participant.lastSeen = now();

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
  if (room.participants.length === 0) {
    try {
      await flushDocumentToMongo(room.roomCode);
    } catch (error) {
      logger.error(
        `[rooms] Last participant left room ${room.roomCode} but document snapshot flush failed: ${error.message}`
      );
    }
  }
  return { room, participant };
};
