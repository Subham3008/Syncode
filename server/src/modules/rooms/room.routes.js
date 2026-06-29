import { Router } from "express";
import { validate } from "../../middlewares/validate.middleware.js";
import {
  closeRoomController,
  createRoomController,
  getRoomController,
  joinRoomController,
  kickParticipantController,
  rejoinRoomController,
  renameRoomController,
  setRoomLockController
} from "./room.controller.js";
import {
  closeRoomSchema,
  createRoomSchema,
  getRoomSchema,
  joinRoomSchema,
  kickParticipantSchema,
  rejoinRoomSchema,
  renameRoomSchema,
  setRoomLockSchema
} from "./room.validator.js";

const router = Router();

router.post("/create", validate(createRoomSchema), createRoomController);
router.post("/join", validate(joinRoomSchema), joinRoomController);
router.post("/rejoin", validate(rejoinRoomSchema), rejoinRoomController);
router.get("/:roomCode", validate(getRoomSchema), getRoomController);
router.patch("/:roomCode/rename", validate(renameRoomSchema), renameRoomController);
router.post("/:roomCode/kick", validate(kickParticipantSchema), kickParticipantController);
router.patch("/:roomCode/lock", validate(setRoomLockSchema), setRoomLockController);
router.patch("/:roomCode/close", validate(closeRoomSchema), closeRoomController);

export default router;
