import express from "express";
const router = express.Router();

// middlewares
import { isInstructor, requireSignin } from "../middlewares";

// controllers
import { uploadImage, removeImage, create } from "../controllers/course";

// image
router.post("/course/upload-image", uploadImage);
router.post("/course/remove-image", removeImage);

// course
router.post("/course", requireSignin, isInstructor, create);

module.exports = router;
