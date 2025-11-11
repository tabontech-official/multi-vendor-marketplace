import express from "express"
import { Csvuplaods } from "../middleware/multer.js";
import { activateShippingProfile, createBulkShippingProfiles, createShopifyProfile, deactivateShippingProfile, deleteAllShopifyProfiles, getShippingProfiles, getUserActiveProfiles, listAllShopifyProfiles } from "../controller/shippingprofile.js";
const shippingRouter=express.Router()


shippingRouter.post("/add-shipping-profiles",Csvuplaods, createBulkShippingProfiles);
shippingRouter.post("/add-shippings",Csvuplaods, createShopifyProfile);
shippingRouter.post("/activate", activateShippingProfile);
shippingRouter.post("/deactivate", deactivateShippingProfile);

shippingRouter.delete("/delete-all-shopify-profiles", deleteAllShopifyProfiles);

shippingRouter.get("/get",Csvuplaods, listAllShopifyProfiles);
shippingRouter.get("/getProfiles", getShippingProfiles);
shippingRouter.get("/:userId", getUserActiveProfiles);

export default shippingRouter