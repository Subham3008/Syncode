import { HTTP_STATUS } from "../constants/httpStatus.js";
import { ApiError } from "../utils/ApiError.js";

export const notFoundMiddleware = (req, res, next) => {
  next(new ApiError(HTTP_STATUS.NOT_FOUND, `Route not found: ${req.method} ${req.originalUrl}`));
};
