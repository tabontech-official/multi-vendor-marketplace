import express from "express"
import { Csvuplaods } from "../middleware/multer.js";
import { createBulkShippingProfiles, createShopifyProfile, deleteAllShopifyProfiles, getShippingProfiles, listAllShopifyProfiles } from "../controller/shippingprofile.js";
const shippingRouter=express.Router()


shippingRouter.post("/add-shipping-profiles",Csvuplaods, createBulkShippingProfiles);
shippingRouter.post("/add-shippings",Csvuplaods, createShopifyProfile);

shippingRouter.delete("/delete-all-shopify-profiles", deleteAllShopifyProfiles);

shippingRouter.get("/get",Csvuplaods, listAllShopifyProfiles);
shippingRouter.get("/getProfiles", getShippingProfiles);

export default shippingRouter