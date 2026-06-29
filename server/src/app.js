import cors from "cors";
import express from "express";
import { corsOptions } from "./config/cors.js";
import { HTTP_STATUS } from "./constants/httpStatus.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";
import { notFoundMiddleware } from "./middlewares/notFound.middleware.js";
import apiRoutes from "./routes/index.js";

export const app = express();

app.use(cors(corsOptions));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/health", (req, res) => {
  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: "Syncode API running"
  });
});

app.use("/api", apiRoutes);
app.use(notFoundMiddleware);
app.use(errorMiddleware);
