// import express from "express"
// import { Csvuplaods } from "../middleware/multer.js";
// import { activateShippingProfile, createBulkShippingProfiles, createShopifyProfile, deactivateShippingProfile, deleteAllShopifyProfiles, getShippingProfiles, getShippingProfilesWithCounts, getUserActiveProfiles, listAllShopifyProfiles } from "../controller/shippingprofile.js";
// const shippingRouter=express.Router()


// shippingRouter.post("/add-shipping-profiles",Csvuplaods, createBulkShippingProfiles);
// shippingRouter.post("/add-shippings",Csvuplaods, createShopifyProfile);
// shippingRouter.post("/activate", activateShippingProfile);
// shippingRouter.post("/deactivate", deactivateShippingProfile);

// shippingRouter.delete("/delete-all-shopify-profiles", deleteAllShopifyProfiles);

// shippingRouter.get("/get",Csvuplaods, listAllShopifyProfiles);
// shippingRouter.get("/getProfiles", getShippingProfiles);
// shippingRouter.get("/:userId", getUserActiveProfiles);
// shippingRouter.get("/adminShiipingCount", getShippingProfilesWithCounts);

// export default shippingRouter

import express from "express";
import {
  activateShippingProfile,
  createBulkShippingProfiles,
  createShopifyProfile,
  deactivateShippingProfile,
  deleteAllShopifyProfiles,
  getShippingProfiles,
  getShippingProfilesWithCounts,
  getUserActiveProfiles,
  listAllShopifyProfiles,
} from "../controller/shippingprofile.js";

const shippingRouter = express.Router();

shippingRouter.post("/add-shipping-profiles",  createBulkShippingProfiles);
shippingRouter.post("/add-shippings",  createShopifyProfile);
shippingRouter.post("/activate", activateShippingProfile);
shippingRouter.post("/deactivate", deactivateShippingProfile);

shippingRouter.delete("/delete-all-shopify-profiles", deleteAllShopifyProfiles);

shippingRouter.get("/get",  listAllShopifyProfiles);
shippingRouter.get("/getProfiles", getShippingProfiles);

shippingRouter.get("/get/admin", getShippingProfilesWithCounts);

shippingRouter.get("/:userId", getUserActiveProfiles);

export default shippingRouter;
