import { Router } from "express";
import { HTTP_STATUS } from "../constants/httpStatus.js";

const router = Router();

router.get("/", (req, res) => {
  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: "Syncode API ready"
  });
});

export default router;
