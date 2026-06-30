import { createClient } from "redis";
import { env } from "./env.js";
import { logger } from "../utils/logger.js";

const getSafeRedisUrl = () => {
  try {
    const url = new URL(env.redisUrl);

    if (url.password) {
      url.password = "****";
    }

    return url.toString();
  } catch {
    return env.redisUrl;
  }
};

export const redisClient = createClient({
  url: env.redisUrl
});

redisClient.on("error", (error) => {
  logger.error(`Redis error: ${error.message}`);
});

export const connectRedis = async () => {
  if (redisClient.isOpen) {
    return redisClient;
  }

  try {
    await redisClient.connect();
    await redisClient.ping();
    logger.info(`Redis connected: ${getSafeRedisUrl()}`);
    return redisClient;
  } catch (error) {
    const message = `Redis connection failed for document sync cache: ${error.message}`;
    logger.error(message);
    throw new Error(`${message}. Start Redis locally or set REDIS_URL.`);
  }
};

export const disconnectRedis = async () => {
  if (!redisClient.isOpen) {
    return;
  }

  await redisClient.quit();
};
