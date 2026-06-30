import http from "http";
import { app } from "./app.js";
import { connectDB } from "./config/db.js";
import { env } from "./config/env.js";
import { connectRedis } from "./config/redis.js";
import { initializeSocketServer } from "./sockets/index.js";
import { logger } from "./utils/logger.js";

const startServer = async () => {
  await connectDB();
  await connectRedis();

  const httpServer = http.createServer(app);
  await initializeSocketServer(httpServer);

  httpServer.listen(env.port, () => {
    logger.info(`Syncode server running on port ${env.port}`);
  });
};

startServer();
