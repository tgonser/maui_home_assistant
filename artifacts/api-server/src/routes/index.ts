import { Router, type IRouter } from "express";
import healthRouter from "./health";
import haRouter from "./ha";
import roomAliasesRouter from "./roomAliases";
import entityAliasesRouter from "./entityAliases";
import surveyShareRouter from "./surveyShare";

const router: IRouter = Router();

router.use(healthRouter);
router.use(haRouter);
router.use(roomAliasesRouter);
router.use(entityAliasesRouter);
router.use(surveyShareRouter);

export default router;
