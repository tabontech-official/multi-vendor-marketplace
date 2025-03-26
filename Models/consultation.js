import mongoose from "mongoose";

const consultationSchema=new mongoose.Schema({
    fullName:{
        type:String
    },
    email:{
        type:String
    },
    storeUrl:{
        type:String
    },
    consultataionType:{
        type:String
    },
    goals:{
        type:String
    },
    userId:{
        type:mongoose.Schema.Types.ObjectId
    }
})

export const consultationModel=mongoose.model("consultationCollection",consultationSchema)