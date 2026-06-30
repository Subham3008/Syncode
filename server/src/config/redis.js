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

const createRedisClient = () => createClient({
  url: env.redisUrl
});

export const redisClient = createRedisClient();
export const redisSubscriber = redisClient.duplicate();

redisClient.on("error", (error) => {
  logger.error(`Redis error: ${error.message}`);
});

redisSubscriber.on("error", (error) => {
  logger.error(`Redis subscriber error: ${error.message}`);
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
    throw new Error(`${message}. Start Redis locally or set REDIS_URL, or set REDIS_HOST, REDIS_PORT, and REDIS_PASSWORD.`);
  }
};

export const connectRedisSubscriber = async () => {
  if (redisSubscriber.isOpen) {
    return redisSubscriber;
  }

  await redisSubscriber.connect();
  return redisSubscriber;
};

export const disconnectRedis = async () => {
  if (redisSubscriber.isOpen) {
    await redisSubscriber.quit();
  }

  if (!redisClient.isOpen) {
    return;
  }

  await redisClient.quit();
};
