import express from "express";
import formidable from "express-formidable";
const router = express.Router();

// middlewares
import { isInstructor, requireSignin } from "../middlewares";

// controllers
import {
  uploadImage,
  removeImage,
  create,
  read,
  uploadVideo,
  removeVideo,
  addLesson,
  update,
} from "../controllers/course";

// image
router.post("/course/upload-image", uploadImage);
router.post("/course/remove-image", removeImage);

// course
router.post("/course", requireSignin, isInstructor, create);
router.put("/course/:slug", requireSignin, update);
router.get("/course/:slug", read);
router.post(
  "/course/video-upload/:instructorId",
  requireSignin,
  formidable(),
  uploadVideo
);
router.post("/course/remove-video/:instructorId", requireSignin, removeVideo);
// `/api/course/lesson/${slug}/${course.instructor_id}`,
router.post("/course/lesson/:slug/:instructorId", requireSignin, addLesson);
module.exports = router;
