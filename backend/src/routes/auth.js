import { Router } from "express";
import requireUser from "../middleware/requireUser.js";

const router = Router();

router.get("/me", requireUser, (req, res) => {
  const { id, username, email, roles } = req.user;
  res.json({ user: { id, username, email, roles } });
});

export default router;
