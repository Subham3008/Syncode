import { HTTP_STATUS } from "../constants/httpStatus.js";
import { logger } from "../utils/logger.js";

export const errorMiddleware = (error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const statusCode = error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
  const message = statusCode === HTTP_STATUS.INTERNAL_SERVER_ERROR
    ? "Internal server error"
    : error.message;

  if (statusCode === HTTP_STATUS.INTERNAL_SERVER_ERROR) {
    logger.error(error.stack || error.message);
  }

  res.status(statusCode).json({
    success: false,
    message
  });
};
