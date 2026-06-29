import { ZodError } from "zod";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { ApiError } from "../utils/ApiError.js";

const formatZodMessage = (error) => {
  return error.issues
    .map((issue) => issue.message)
    .filter(Boolean)
    .join(", ");
};

export const validate = (schema) => (req, res, next) => {
  try {
    const validated = schema.parse({
      body: req.body,
      params: req.params,
      query: req.query
    });

    req.body = validated.body ?? req.body;
    req.params = validated.params ?? req.params;
    req.query = validated.query ?? req.query;
    req.validated = validated;
    next();
  } catch (error) {
    if (error instanceof ZodError) {
      next(new ApiError(HTTP_STATUS.BAD_REQUEST, formatZodMessage(error)));
      return;
    }

    next(error);
  }
};
