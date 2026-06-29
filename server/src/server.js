import http from "http";
import { app } from "./app.js";
import { connectDB } from "./config/db.js";
import { env } from "./config/env.js";
import { initializeSocketServer } from "./sockets/index.js";
import { logger } from "./utils/logger.js";

const startServer = async () => {
  await connectDB();

  const httpServer = http.createServer(app);
  const io = initializeSocketServer(httpServer);
  app.set("io", io);

  httpServer.listen(env.port, () => {
    logger.info(`Syncode server running on port ${env.port}`);
  });
};

startServer();
