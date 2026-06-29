import mongoose from "mongoose";
import { env } from "./env.js";
import { logger } from "../utils/logger.js";

export const connectDB = async () => {
  try {
    const connection = await mongoose.connect(env.mongoUri);
    logger.info(`MongoDB connected: ${connection.connection.host}`);
  } catch (error) {
    logger.error(`MongoDB connection failed: ${error.message}`);
    process.exit(1);
  }
};
