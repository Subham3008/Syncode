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
    logger.warn(
      `Redis unavailable; using in-memory document cache and local Socket.IO adapter: ${error.message}`
    );
    return null;
  }
};

export const connectRedisSubscriber = async () => {
  if (!redisClient.isOpen) {
    return null;
  }

  if (redisSubscriber.isOpen) {
    return redisSubscriber;
  }

  try {
    await redisSubscriber.connect();
    return redisSubscriber;
  } catch (error) {
    logger.warn(
      `Redis subscriber unavailable; Socket.IO will use local adapter: ${error.message}`
    );
    return null;
  }
};

export const hasRedisConnection = () => Boolean(redisClient.isReady);

export const disconnectRedis = async () => {
  if (redisSubscriber.isOpen) {
    await redisSubscriber.quit();
  }

  if (!redisClient.isOpen) {
    return;
  }

  await redisClient.quit();
};
