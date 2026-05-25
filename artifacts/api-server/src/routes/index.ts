import { Router, type IRouter } from "express";
import healthRouter from "./health";
import haRouter from "./ha";
import roomAliasesRouter from "./roomAliases";

const router: IRouter = Router();

router.use(healthRouter);
router.use(haRouter);
router.use(roomAliasesRouter);

export default router;
