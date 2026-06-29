import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: Number(process.env.PORT) || 5000,
  nodeEnv: process.env.NODE_ENV || "development",
  mongoUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/syncode",
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173"
};

export const isDevelopment = env.nodeEnv === "development";
