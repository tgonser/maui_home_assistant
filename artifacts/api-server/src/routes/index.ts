import { Router, type IRouter } from "express";
import healthRouter from "./health";
import haRouter from "./ha";
import roomAliasesRouter from "./roomAliases";
import entityAliasesRouter from "./entityAliases";

const router: IRouter = Router();

router.use(healthRouter);
router.use(haRouter);
router.use(roomAliasesRouter);
router.use(entityAliasesRouter);

export default router;
