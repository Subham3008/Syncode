export const toParticipantDTO = (participant, hostId = "") => ({
  userId: participant.userId,
  username: participant.username,
  color: participant.color,
  isOnline: participant.isOnline,
  isHost: participant.isHost || participant.userId === hostId,
  joinedAt: participant.joinedAt,
  lastSeen: participant.lastSeen
});

export const toActivityDTO = (activity) => ({
  type: activity.type,
  userId: activity.userId,
  username: activity.username,
  message: activity.message,
  timestamp: activity.timestamp
});

export const toRoomDTO = (room) => ({
  roomCode: room.roomCode,
  roomName: room.roomName,
  hostId: room.hostId,
  hostName: room.hostName,
  participants: room.participants?.map((participant) => toParticipantDTO(participant, room.hostId)) ?? [],
  activityLog: room.activityLog?.map(toActivityDTO) ?? [],
  document: room.document,
  documentVersion: room.documentVersion,
  isLocked: room.isLocked,
  isActive: room.isActive,
  createdAt: room.createdAt,
  lastPersistedAt: room.lastPersistedAt,
  updatedAt: room.updatedAt
});

export const toRoomSessionDTO = (room, sessionUser) => ({
  ...toRoomDTO(room),
  userId: sessionUser.userId,
  username: sessionUser.username,
  color: sessionUser.color,
  isHost: room.hostId === sessionUser.userId
});
