import { HTTP_STATUS } from "../../constants/httpStatus.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import {
  closeRoom,
  createRoom,
  getRoomByCode,
  joinRoom,
  kickParticipant,
  rejoinRoom,
  renameRoom,
  setRoomLock
} from "./room.service.js";
import { toRoomDTO, toRoomSessionDTO } from "./room.dto.js";
import { SOCKET_EVENTS } from "../../constants/socketEvents.js";
import {
  broadcastRoomState,
  notifyKickedParticipant
} from "../../sockets/room.broadcast.js";

const sendResponse = (res, response) => {
  res.status(response.statusCode).json({
    success: response.success,
    message: response.message,
    data: response.data
  });
};

const getSocketServer = (req) => req.app.get("io");

export const createRoomController = asyncHandler(async (req, res) => {
  const { room, sessionUser } = await createRoom(req.body);

  sendResponse(
    res,
    new ApiResponse(
      HTTP_STATUS.CREATED,
      toRoomSessionDTO(room, sessionUser),
      "Room created successfully"
    )
  );
});

export const joinRoomController = asyncHandler(async (req, res) => {
  const { room, sessionUser } = await joinRoom(req.body);

  sendResponse(
    res,
    new ApiResponse(HTTP_STATUS.OK, toRoomSessionDTO(room, sessionUser), "Room joined successfully")
  );
});

export const rejoinRoomController = asyncHandler(async (req, res) => {
  const { room, sessionUser } = await rejoinRoom(req.body);

  sendResponse(
    res,
    new ApiResponse(HTTP_STATUS.OK, toRoomSessionDTO(room, sessionUser), "Room rejoined successfully")
  );
});

export const getRoomController = asyncHandler(async (req, res) => {
  const room = await getRoomByCode(req.params.roomCode);

  sendResponse(res, new ApiResponse(HTTP_STATUS.OK, toRoomDTO(room), "Room fetched successfully"));
});

export const renameRoomController = asyncHandler(async (req, res) => {
  const room = await renameRoom({
    roomCode: req.params.roomCode,
    userId: req.body.userId,
    roomName: req.body.roomName
  });

  broadcastRoomState(getSocketServer(req), room, SOCKET_EVENTS.ROOM_RENAMED);
  sendResponse(res, new ApiResponse(HTTP_STATUS.OK, toRoomDTO(room), "Room renamed successfully"));
});

export const kickParticipantController = asyncHandler(async (req, res) => {
  const { room, kickedParticipant } = await kickParticipant({
    roomCode: req.params.roomCode,
    hostId: req.body.hostId,
    targetUserId: req.body.targetUserId
  });

  const io = getSocketServer(req);
  notifyKickedParticipant(io, room, kickedParticipant);
  broadcastRoomState(io, room);

  sendResponse(
    res,
    new ApiResponse(HTTP_STATUS.OK, toRoomDTO(room), "Participant removed successfully")
  );
});

export const setRoomLockController = asyncHandler(async (req, res) => {
  const room = await setRoomLock({
    roomCode: req.params.roomCode,
    userId: req.body.userId,
    isLocked: req.body.isLocked
  });

  broadcastRoomState(getSocketServer(req), room, SOCKET_EVENTS.ROOM_LOCKED);
  sendResponse(
    res,
    new ApiResponse(
      HTTP_STATUS.OK,
      toRoomDTO(room),
      room.isLocked ? "Room locked successfully" : "Room unlocked successfully"
    )
  );
});

export const closeRoomController = asyncHandler(async (req, res) => {
  const room = await closeRoom({
    roomCode: req.params.roomCode,
    userId: req.body.userId
  });

  broadcastRoomState(getSocketServer(req), room, SOCKET_EVENTS.ROOM_CLOSED);
  sendResponse(res, new ApiResponse(HTTP_STATUS.OK, toRoomDTO(room), "Room closed successfully"));
});
