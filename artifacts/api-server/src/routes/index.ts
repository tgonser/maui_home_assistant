import { Router, type IRouter } from "express";
import healthRouter from "./health";
import haRouter from "./ha";
import haStreamRouter from "./haStream";
import roomAliasesRouter from "./roomAliases";
import entityAliasesRouter from "./entityAliases";
import surveyShareRouter from "./surveyShare";
import spotifyPlaylistsRouter from "./spotifyPlaylists";

const router: IRouter = Router();

router.use(healthRouter);
router.use(haRouter);
router.use(haStreamRouter);
router.use(roomAliasesRouter);
router.use(entityAliasesRouter);
router.use(surveyShareRouter);
router.use(spotifyPlaylistsRouter);

export default router;
