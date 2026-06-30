import dotenv from "dotenv";

dotenv.config();

const requiredEnv = ["PORT", "NODE_ENV", "MONGODB_URI", "CLIENT_URL"];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const buildRedisUrl = () => {
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL;
  }

  const host = process.env.REDIS_HOST?.trim();
  const port = process.env.REDIS_PORT?.trim() || "6379";
  const password = process.env.REDIS_PASSWORD;

  if (!host) {
    return "redis://localhost:6379";
  }

  const encodedPassword = password ? `:${encodeURIComponent(password)}@` : "";

  return `redis://${encodedPassword}${host}:${port}`;
};

export const env = {
  port: Number(process.env.PORT),
  nodeEnv: process.env.NODE_ENV,
  mongoUri: process.env.MONGODB_URI,
  clientUrl: process.env.CLIENT_URL,
  redisHost: process.env.REDIS_HOST?.trim() || "",
  redisPort: Number(process.env.REDIS_PORT || 6379),
  redisPassword: process.env.REDIS_PASSWORD || "",
  redisUrl: buildRedisUrl()
};

export const isDevelopment = env.nodeEnv === "development";
