import { Router, type IRouter } from "express";
import healthRouter from "./health";
import searchRouter from "./search";
import proxyRouter from "./proxy";
import downloadsRouter from "./downloads";
import subtitlesRouter from "./subtitles";
import genresRouter from "./genres";
import subscriptionRouter from "./subscription";
import accessRouter from "./access";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(searchRouter);
router.use(proxyRouter);
router.use(downloadsRouter);
router.use(subtitlesRouter);
router.use(genresRouter);
router.use(subscriptionRouter);
router.use(accessRouter);
router.use(adminRouter);

export default router;
