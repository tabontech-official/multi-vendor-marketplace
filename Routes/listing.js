import { addListing,upload } from "../controller/listing.js";
import express from 'express'
const listingRouter=express.Router()
listingRouter.post('/addList',upload.single('image'),addListing)

export default listingRouter;