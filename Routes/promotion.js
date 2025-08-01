import express from 'express';
import {
  addPromotion,
  addPromotionDataFromProductDb,
  deleteAll,
  deletePromotion,
  endPromotions,
  getAllPromotions,
  getAllPromotionsbyUserId,
  getPromotionCountForSpecificUser,
} from '../controller/promotion.js';
import { verifyToken } from '../middleware/verifyToken.js';

const promoRouter = express.Router();
promoRouter.post('/',verifyToken ,addPromotion);
promoRouter.get('/', getAllPromotions);
promoRouter.get('/fetchAllPromotions',verifyToken, getAllPromotionsbyUserId);

promoRouter.delete('/:id', deletePromotion);
promoRouter.post('/:id',verifyToken, addPromotionDataFromProductDb);
promoRouter.delete('/endPromotions/:id', endPromotions);
promoRouter.get('/getAnnouncementsForUser/:userId', getPromotionCountForSpecificUser);
promoRouter.delete('/', deleteAll);

export default promoRouter;
