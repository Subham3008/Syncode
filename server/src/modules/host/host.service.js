import { HTTP_STATUS } from "../../constants/httpStatus.js";
import { ApiError } from "../../utils/ApiError.js";

export const isRoomHost = (room, userId) => room?.hostId === userId;

export const assertIsHost = (room, userId) => {
  if (!isRoomHost(room, userId)) {
    throw new ApiError(HTTP_STATUS.FORBIDDEN, "Only the room host can perform this action");
  }
};

export const assertCanKick = (room, hostId, targetUserId) => {
  assertIsHost(room, hostId);

  if (hostId === targetUserId) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, "Host cannot kick themselves");
  }

  const targetParticipant = room.participants.find(
    (participant) => participant.userId === targetUserId
  );

  if (!targetParticipant) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, "Participant not found");
  }

  return targetParticipant;
};
