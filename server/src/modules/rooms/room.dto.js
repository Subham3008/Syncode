export const toParticipantDTO = (participant) => ({
  userId: participant.userId,
  username: participant.username,
  color: participant.color,
  isOnline: participant.isOnline,
  isHost: participant.isHost,
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
  participants: room.participants?.map(toParticipantDTO) ?? [],
  activityLog: room.activityLog?.map(toActivityDTO) ?? [],
  document: room.document,
  documentVersion: room.documentVersion,
  isLocked: room.isLocked,
  isActive: room.isActive,
  createdAt: room.createdAt,
  updatedAt: room.updatedAt
});

export const toRoomSessionDTO = (room, sessionUser) => ({
  ...toRoomDTO(room),
  userId: sessionUser.userId,
  username: sessionUser.username,
  isHost: room.hostId === sessionUser.userId
});
