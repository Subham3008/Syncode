import { createAdapter } from "@socket.io/redis-adapter";
import { Server } from "socket.io";
import { corsOptions } from "../config/cors.js";
import { connectRedisSubscriber, redisClient, redisSubscriber } from "../config/redis.js";
import { SOCKET_EVENTS } from "../constants/socketEvents.js";
import { isDevelopment } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { registerEditorHandlers } from "./handlers/editor.handlers.js";
import { registerHostHandlers } from "./handlers/host.handlers.js";
import { registerPresenceHandlers } from "./handlers/presence.handlers.js";
import { registerRoomHandlers } from "./handlers/room.handlers.js";

export const initializeSocketServer = async (httpServer) => {
  const io = new Server(httpServer, {
    cors: corsOptions,
    transports: ["websocket", "polling"]
  });

  await connectRedisSubscriber();
  io.adapter(createAdapter(redisClient, redisSubscriber));
  logger.info("Socket.IO Redis adapter connected");

  io.on(SOCKET_EVENTS.CONNECTION, (socket) => {
    if (isDevelopment) {
      logger.info(`Socket connected: ${socket.id}`);
    }

    registerRoomHandlers(io, socket);
    registerHostHandlers(io, socket);
    registerEditorHandlers(io, socket);
    registerPresenceHandlers(io, socket);

    socket.on(SOCKET_EVENTS.DISCONNECT, () => {
      if (isDevelopment) {
        logger.info(`Socket disconnected: ${socket.id}`);
      }
    });
  });

  return io;
};
