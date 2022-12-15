import express from "express";
const router = express.Router();
// controllers

import {
  register,
  login,
  logout,
  currentUser,
  sendTestEmail,
  forgotPassword,
  resetPassword,
  QuestGen,
} from "../controllers/auth";

// middlewares
import { requireSignin } from "../middlewares";

router.post("/register", register);
router.post("/login", login);
router.get("/logout", logout);
router.get("/current-user", requireSignin, currentUser);
router.get("/send-email", sendTestEmail);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

router.get("/register", register);
//  (server controllers and routes setup complete)

// router.get("/quest", QuestGen);

module.exports = router;
