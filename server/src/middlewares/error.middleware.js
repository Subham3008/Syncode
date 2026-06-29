import { HTTP_STATUS } from "../constants/httpStatus.js";
import { isDevelopment } from "../config/env.js";

export const errorMiddleware = (error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const statusCode = Number.isInteger(error.statusCode)
    ? error.statusCode
    : HTTP_STATUS.INTERNAL_SERVER_ERROR;
  const message = statusCode === HTTP_STATUS.INTERNAL_SERVER_ERROR
    ? "Internal server error"
    : error.message;

  if (isDevelopment) {
    console.error("Backend Error:", {
      message: error.message,
      path: req.originalUrl,
      method: req.method,
      body: req.body,
      stack: error.stack
    });
  }

  res.status(statusCode).json({
    success: false,
    message
  });
};
