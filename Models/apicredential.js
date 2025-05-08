import mongoose from 'mongoose'
const apiCredentialSchema=new mongoose.Schema({
    apiKey:{
        type:String
    },
    apiSecretKey:{
        type:String
    },
    userId:{
        type:mongoose.Schema.Types.ObjectId
    }

})

export const apiCredentialModel=mongoose.model('apiCredential',apiCredentialSchema)