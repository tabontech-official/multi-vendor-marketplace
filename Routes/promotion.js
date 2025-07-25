import express from 'express';
import {
  addPromotion,
  addPromotionDataFromProductDb,
  deletePromotion,
  endPromotions,
  getAllPromotions,
  getPromotionCountForSpecificUser,
} from '../controller/promotion.js';

const promoRouter = express.Router();
promoRouter.post('/', addPromotion);
promoRouter.get('/', getAllPromotions);
promoRouter.delete('/:id', deletePromotion);
promoRouter.post('/:id', addPromotionDataFromProductDb);
promoRouter.delete('/endPromotions/:id', endPromotions);
promoRouter.get('/getAnnouncementsForUser/:userId', getPromotionCountForSpecificUser);

export default promoRouter;
