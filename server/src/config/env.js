import dotenv from "dotenv";

dotenv.config();

const requiredEnv = ["PORT", "NODE_ENV", "MONGODB_URI", "CLIENT_URL"];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const env = {
  port: Number(process.env.PORT),
  nodeEnv: process.env.NODE_ENV,
  mongoUri: process.env.MONGODB_URI,
  clientUrl: process.env.CLIENT_URL,
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379"
};

export const isDevelopment = env.nodeEnv === "development";
