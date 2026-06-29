import { z } from "zod";
import { ROOM_CODE_LENGTH } from "../../constants/roomConstants.js";

const normalizeSpaces = (value) => value.trim().replace(/\s+/g, " ");
const usernamePattern = /^[A-Za-z0-9 _-]+$/;
const roomCodePattern = /^[A-Z0-9]{6}$/;

const usernameSchema = z
  .string({
    required_error: "Username is required",
    invalid_type_error: "Username must be a string"
  })
  .transform(normalizeSpaces)
  .pipe(
    z
      .string()
      .min(2, "Username must be at least 2 characters")
      .max(24, "Username must be at most 24 characters")
      .regex(usernamePattern, "Username can only contain letters, numbers, spaces, underscores, and hyphens")
  );

const roomCodeSchema = z
  .string({
    required_error: "Room code is required",
    invalid_type_error: "Room code must be a string"
  })
  .transform((value) => normalizeSpaces(value).toUpperCase())
  .pipe(
    z
      .string()
      .length(ROOM_CODE_LENGTH, "Room code must be 6 characters")
      .regex(roomCodePattern, "Room code must contain only uppercase letters and numbers")
  );

const roomNameSchema = z
  .string({
    required_error: "Room name is required",
    invalid_type_error: "Room name must be a string"
  })
  .transform(normalizeSpaces)
  .pipe(
    z
      .string()
      .min(3, "Room name must be at least 3 characters")
      .max(40, "Room name must be at most 40 characters")
  );

const userIdSchema = (label = "User ID") =>
  z
    .string({
      required_error: `${label} is required`,
      invalid_type_error: `${label} must be a string`
    })
    .transform(normalizeSpaces)
    .pipe(z.string().min(1, `${label} is required`));

const roomParamsSchema = z.object({
  roomCode: roomCodeSchema
});

const rejoinBodySchema = z
  .object({
    roomCode: z.unknown().optional(),
    userId: z.unknown().optional()
  })
  .transform((value, context) => {
    const roomCode = typeof value.roomCode === "string"
      ? normalizeSpaces(value.roomCode).toUpperCase()
      : "";
    const userId = typeof value.userId === "string" ? normalizeSpaces(value.userId) : "";

    if (!roomCode || !userId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "roomCode and userId are required"
      });
      return z.NEVER;
    }

    return { roomCode, userId };
  });

export const createRoomSchema = z.object({
  body: z.object({
    username: usernameSchema
  })
});

export const joinRoomSchema = z.object({
  body: z.object({
    roomCode: roomCodeSchema,
    username: usernameSchema
  })
});

export const rejoinRoomSchema = z.object({
  body: rejoinBodySchema
});

export const getRoomSchema = z.object({
  params: roomParamsSchema
});

export const renameRoomSchema = z.object({
  params: roomParamsSchema,
  body: z.object({
    userId: userIdSchema(),
    roomName: roomNameSchema
  })
});

export const kickParticipantSchema = z.object({
  params: roomParamsSchema,
  body: z.object({
    hostId: userIdSchema("Host ID"),
    targetUserId: userIdSchema("Target user ID")
  })
});

export const setRoomLockSchema = z.object({
  params: roomParamsSchema,
  body: z.object({
    userId: userIdSchema(),
    isLocked: z.boolean({
      required_error: "Lock state is required",
      invalid_type_error: "Lock state must be true or false"
    })
  })
});

export const closeRoomSchema = z.object({
  params: roomParamsSchema,
  body: z.object({
    userId: userIdSchema()
  })
});

export const roomSocketJoinSchema = joinRoomSchema.shape.body;
export const roomSocketRejoinSchema = rejoinRoomSchema.shape.body;
export const roomSocketLeaveSchema = z.object({
  roomCode: roomCodeSchema,
  userId: userIdSchema()
});

export const hostRenameRoomSocketSchema = z.object({
  roomCode: roomCodeSchema,
  userId: userIdSchema(),
  roomName: roomNameSchema
});

export const hostKickUserSocketSchema = z.object({
  roomCode: roomCodeSchema,
  hostId: userIdSchema("Host ID"),
  targetUserId: userIdSchema("Target user ID")
});

export const hostLockRoomSocketSchema = z.object({
  roomCode: roomCodeSchema,
  userId: userIdSchema(),
  isLocked: z.boolean({
    required_error: "Lock state is required",
    invalid_type_error: "Lock state must be true or false"
  })
});

export const hostCloseRoomSocketSchema = z.object({
  roomCode: roomCodeSchema,
  userId: userIdSchema()
});
