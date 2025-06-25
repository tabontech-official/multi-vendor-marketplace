import express from 'express'
import { createCategory, getCategory, getCollectionData } from '../controller/category.js'


const categoryRouter=express.Router()
categoryRouter.post('/createCategory',createCategory)

categoryRouter.get('/getCategory',getCategory)
categoryRouter.get('/getCollection/:userId',getCollectionData)

export default categoryRouter