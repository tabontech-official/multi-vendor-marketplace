import express from "express"
import { addPromotion, addPromotionDataFromProductDb, deletePromotion, getAllPromotions } from "../controller/promotion.js";


const promoRouter=express.Router()
promoRouter.post("/",addPromotion)
promoRouter.get("/",getAllPromotions)
promoRouter.delete("/:id",deletePromotion)
promoRouter.post("/:id",addPromotionDataFromProductDb)





export default promoRouter;