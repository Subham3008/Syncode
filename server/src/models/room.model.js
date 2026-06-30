import mongoose from "mongoose";
import {
  DEFAULT_ROOM_NAME,
  MAX_ACTIVITY_LOG_ITEMS
} from "../constants/roomConstants.js";

const participantSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, trim: true },
    username: { type: String, required: true, trim: true },
    socketId: { type: String, default: null },
    color: { type: String, required: true, trim: true },
    isOnline: { type: Boolean, default: false },
    isHost: { type: Boolean, default: false },
    joinedAt: { type: Date, default: Date.now },
    lastSeen: { type: Date, default: Date.now }
  },
  { _id: false }
);

const activityLogSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        "room_created",
        "user_joined",
        "user_rejoined",
        "user_left",
        "room_renamed",
        "user_kicked",
        "room_locked",
        "room_unlocked",
        "room_closed"
      ],
      required: true
    },
    userId: { type: String, required: true, trim: true },
    username: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    timestamp: { type: Date, default: Date.now }
  },
  { _id: false }
);

const roomSchema = new mongoose.Schema(
  {
    roomCode: { type: String, required: true, trim: true, uppercase: true },
    roomName: { type: String, default: DEFAULT_ROOM_NAME, trim: true },
    hostId: { type: String, required: true, trim: true, index: true },
    hostName: { type: String, required: true, trim: true },
    document: { type: String, default: "" },
    documentVersion: { type: Number, default: 0 },
    participants: { type: [participantSchema], default: [] },
    activityLog: { type: [activityLogSchema], default: [] },
    isLocked: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true, index: true },
    lastPersistedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

roomSchema.index({ roomCode: 1 }, { unique: true });
roomSchema.index({ "participants.userId": 1 });

roomSchema.pre("save", function trimRollingRoomArrays(next) {
  if (this.activityLog.length > MAX_ACTIVITY_LOG_ITEMS) {
    this.activityLog = this.activityLog.slice(-MAX_ACTIVITY_LOG_ITEMS);
  }

  next();
});

export const Room = mongoose.model("Room", roomSchema);
