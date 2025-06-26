import express from 'express'
import { createCategory, delet, getCategory, getCollectionData } from '../controller/category.js'
import { cpUpload } from '../middleware/cloudinary.js'


const categoryRouter=express.Router()
categoryRouter.post('/createCategory',cpUpload,createCategory)

categoryRouter.get('/getCategory',getCategory)
categoryRouter.get('/getCollection/:userId',getCollectionData)
categoryRouter.delete('/',delet)
export default categoryRouter