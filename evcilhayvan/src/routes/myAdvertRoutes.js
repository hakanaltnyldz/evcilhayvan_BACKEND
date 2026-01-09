// routes/myAdvertRoutes.js
import { Router } from "express";
import { query } from "express-validator";
import { authRequired } from "../middlewares/auth.js";
import { myAdverts } from "../controllers/petController.js";

const router = Router();

router.get(
  "/",
  authRequired(),
  [query("type").optional().isIn(["adoption", "mating"])],
  myAdverts
);

export default router;
