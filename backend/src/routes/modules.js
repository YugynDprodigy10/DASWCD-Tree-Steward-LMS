import { Router } from "express";
import requireUser from "../middleware/requireUser.js";
import { listVisibleModules } from "../db/moduleVisibility.js";

const router = Router();
router.use(requireUser);

// The course module list, without modules an admin has hidden from this user.
router.get("/", async (req, res) => {
  res.json({ modules: await listVisibleModules(req.user) });
});

export default router;