import { productModel } from "../Models/product.js"
import cron from 'node-cron';
export const  productSubscriptionExpiration=()=>{
    cron.schedule('0 */2 * * *',  () => {
        const currentDate=new Date()
        productModel.updateMany({subscriptionEndDate:{
            $lte:currentDate
        }},{status:'inactive'})

    })
}