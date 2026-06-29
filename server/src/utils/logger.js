import { isDevelopment } from "../config/env.js";

export const logger = {
  info(message) {
    if (isDevelopment) {
      console.log(`[info] ${message}`);
    }
  },
  warn(message) {
    console.warn(`[warn] ${message}`);
  },
  error(message) {
    console.error(`[error] ${message}`);
  }
};
