import { Router, type IRouter } from "express";
import healthRouter from "./health";
import haRouter from "./ha";

const router: IRouter = Router();

router.use(healthRouter);
router.use(haRouter);

export default router;
