import { toParticipantDTO } from "../rooms/room.dto.js";
import { SOCKET_EVENTS } from "../../constants/socketEvents.js";
import { hasRedisConnection, redisClient } from "../../config/redis.js";
import { logger } from "../../utils/logger.js";

const TYPING_TTL_MS = 2500;
const PARTICIPANTS_TTL_SECONDS = 30 * 60;

const roomPresenceMap = new Map();
const socketPresenceMap = new Map();
const typingTimers = new Map();

const normalizeRoomCode = (roomCode) =>
  typeof roomCode === "string" ? roomCode.trim().toUpperCase() : "";

const getPresenceParticipantsKey = (roomCode) =>
  `room:${normalizeRoomCode(roomCode)}:participants`;

const getTypingKey = (roomCode, participantId) =>
  `room:${normalizeRoomCode(roomCode)}:typing:${participantId}`;

const writeRedisPresence = (operation) => {
  if (!hasRedisConnection()) {
    return;
  }

  operation().catch((error) => {
    logger.warn(`Redis presence update failed: ${error.message}`);
  });
};

const normalizeName = (name) => {
  const cleanName = typeof name === "string" ? name.trim().replace(/\s+/g, " ") : "";
  return cleanName || "Anonymous";
};

const getRoomPresence = (roomCode) => {
  const normalizedRoomCode = normalizeRoomCode(roomCode);

  if (!roomPresenceMap.has(normalizedRoomCode)) {
    roomPresenceMap.set(normalizedRoomCode, new Map());
  }

  return roomPresenceMap.get(normalizedRoomCode);
};

const clearTypingTimer = (socketId) => {
  const timer = typingTimers.get(socketId);

  if (timer) {
    clearTimeout(timer);
    typingTimers.delete(socketId);
  }
};

const clearSocketPresence = (socketId) => {
  const currentPresence = socketPresenceMap.get(socketId);

  if (!currentPresence) {
    return null;
  }

  clearTypingTimer(socketId);
  socketPresenceMap.delete(socketId);

  const roomPresence = roomPresenceMap.get(currentPresence.roomCode);

  if (roomPresence?.get(currentPresence.participantId)?.socketId === socketId) {
    roomPresence.delete(currentPresence.participantId);
  }

  if (roomPresence?.size === 0) {
    roomPresenceMap.delete(currentPresence.roomCode);
  }

  return currentPresence;
};

export const getPresenceParticipants = (roomCode, participants = [], hostId = "") => {
  const normalizedRoomCode = normalizeRoomCode(roomCode);
  const liveParticipants = roomPresenceMap.get(normalizedRoomCode) ?? new Map();

  if (Array.isArray(participants) && participants.length > 0) {
    return participants.map((participant) => {
      const participantId = participant.userId;
      const liveParticipant = liveParticipants.get(participantId);
      const dto = toParticipantDTO(participant, hostId);

      return {
        ...dto,
        socketId: liveParticipant?.socketId ?? participant.socketId ?? null,
        participantId,
        displayName: normalizeName(dto.username),
        username: normalizeName(dto.username),
        isOnline: Boolean(liveParticipant) || Boolean(dto.isOnline),
        isTyping: Boolean(liveParticipant?.isTyping),
        cursorPosition: liveParticipant?.cursorPosition ?? null
      };
    });
  }

  return Array.from(liveParticipants.values()).map((participant) => ({ ...participant }));
};

export const emitPresenceList = (io, roomCode, participants = [], hostId = "") => {
  const normalizedRoomCode = normalizeRoomCode(roomCode);

  if (!normalizedRoomCode) {
    return [];
  }

  const presenceParticipants = getPresenceParticipants(normalizedRoomCode, participants, hostId);

  io.to(normalizedRoomCode).emit(SOCKET_EVENTS.PRESENCE_LIST, {
    roomCode: normalizedRoomCode,
    participants: presenceParticipants
  });

  return presenceParticipants;
};

export const upsertPresenceParticipant = ({ io, room, participant, socketId }) => {
  const roomCode = normalizeRoomCode(room?.roomCode);
  const participantId = typeof participant?.userId === "string" ? participant.userId.trim() : "";

  if (!roomCode || !participantId || !socketId) {
    return null;
  }

  const roomPresence = getRoomPresence(roomCode);
  const previousPresence = roomPresence.get(participantId);

  if (previousPresence?.socketId && previousPresence.socketId !== socketId) {
    clearSocketPresence(previousPresence.socketId);
  }

  clearSocketPresence(socketId);

  const presenceParticipant = {
    socketId,
    participantId,
    userId: participantId,
    displayName: normalizeName(participant.username),
    username: normalizeName(participant.username),
    color: participant.color || "",
    isHost: Boolean(participant.isHost || room.hostId === participantId),
    isOnline: true,
    isTyping: false,
    cursorPosition: null,
    joinedAt: participant.joinedAt ?? new Date(),
    lastSeen: new Date()
  };

  roomPresence.set(participantId, presenceParticipant);
  socketPresenceMap.set(socketId, { roomCode, participantId });
  writeRedisPresence(async () => {
    await redisClient.hSet(
      getPresenceParticipantsKey(roomCode),
      participantId,
      JSON.stringify(presenceParticipant)
    );
    await redisClient.expire(getPresenceParticipantsKey(roomCode), PARTICIPANTS_TTL_SECONDS);
  });

  io.to(roomCode).emit(SOCKET_EVENTS.PRESENCE_JOIN, {
    roomCode,
    participant: presenceParticipant
  });
  emitPresenceList(io, roomCode, room.participants, room.hostId);

  return presenceParticipant;
};

export const removePresenceParticipant = ({
  hostId = "",
  io,
  roomCode,
  socketId,
  userId,
  participants = []
}) => {
  const normalizedRoomCode = normalizeRoomCode(roomCode);
  const socketPresence = socketId ? clearSocketPresence(socketId) : null;
  const participantId = userId || socketPresence?.participantId;

  if (normalizedRoomCode && participantId) {
    roomPresenceMap.get(normalizedRoomCode)?.delete(participantId);
    writeRedisPresence(async () => {
      await redisClient.hDel(getPresenceParticipantsKey(normalizedRoomCode), participantId);
      await redisClient.del(getTypingKey(normalizedRoomCode, participantId));
    });
    io.to(normalizedRoomCode).emit(SOCKET_EVENTS.PRESENCE_LEAVE, {
      roomCode: normalizedRoomCode,
      participantId,
      userId: participantId
    });
    emitPresenceList(io, normalizedRoomCode, participants, hostId);
  }
};

export const removeRoomPresence = ({ io, roomCode }) => {
  const normalizedRoomCode = normalizeRoomCode(roomCode);
  const roomPresence = roomPresenceMap.get(normalizedRoomCode);

  if (!roomPresence) {
    return;
  }

  roomPresence.forEach((participant) => {
    clearTypingTimer(participant.socketId);
    socketPresenceMap.delete(participant.socketId);
  });
  roomPresenceMap.delete(normalizedRoomCode);
  writeRedisPresence(async () => {
    await redisClient.del(getPresenceParticipantsKey(normalizedRoomCode));
  });
  emitPresenceList(io, normalizedRoomCode, []);
};

export const updateTypingPresence = ({ io, roomCode, socketId, isTyping, cursorPosition = null }) => {
  const normalizedRoomCode = normalizeRoomCode(roomCode);
  const socketPresence = socketPresenceMap.get(socketId);

  if (!normalizedRoomCode || !socketPresence || socketPresence.roomCode !== normalizedRoomCode) {
    return null;
  }

  const roomPresence = roomPresenceMap.get(normalizedRoomCode);
  const participant = roomPresence?.get(socketPresence.participantId);

  if (!participant) {
    return null;
  }

  clearTypingTimer(socketId);
  participant.isTyping = Boolean(isTyping);
  participant.cursorPosition = Number.isInteger(cursorPosition) && cursorPosition >= 0
    ? cursorPosition
    : null;
  participant.lastSeen = new Date();

  if (participant.isTyping) {
    writeRedisPresence(async () => {
      await redisClient.set(
        getTypingKey(normalizedRoomCode, participant.userId),
        JSON.stringify({
          cursorPosition: participant.cursorPosition,
          isTyping: true,
          userId: participant.userId,
          updatedAt: Date.now()
        }),
        { PX: TYPING_TTL_MS }
      );
    });

    const timer = setTimeout(() => {
      updateTypingPresence({
        io,
        roomCode: normalizedRoomCode,
        socketId,
        isTyping: false
      });
    }, TYPING_TTL_MS);

    timer.unref?.();
    typingTimers.set(socketId, timer);
  } else {
    writeRedisPresence(async () => {
      await redisClient.del(getTypingKey(normalizedRoomCode, participant.userId));
    });
  }

  io.to(normalizedRoomCode).emit(SOCKET_EVENTS.PRESENCE_UPDATE, {
    roomCode: normalizedRoomCode,
    participant: { ...participant }
  });

  io.to(normalizedRoomCode).emit(
    participant.isTyping ? SOCKET_EVENTS.PRESENCE_TYPING : SOCKET_EVENTS.PRESENCE_STOP_TYPING,
    {
      roomCode: normalizedRoomCode,
      participant: { ...participant }
    }
  );

  emitPresenceList(io, normalizedRoomCode);
  return participant;
};
