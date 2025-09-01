
// import { apiCredentialModel } from "../Models/apicredential.js";

// export const verifyToken = async (req, res, next) => {
//   const apiKey = req.headers["x-api-key"];
//   const apiSecretKey = req.headers["x-api-secret"];

//   if (!apiKey || !apiSecretKey) {
//     return res.status(401).json({ error: "API key and secret are required" });
//   }

//   const credential = await apiCredentialModel.findOne({ apiKey, apiSecretKey });

//   if (!credential) {
//     return res.status(403).json({ error: "Invalid API credentials" });
//   }

//   req.userId = credential.userId;
//   next();
// };
import { apiCredentialModel } from "../Models/apicredential.js";

export const verifyToken = async (req, res, next) => {
  const apiKey = req.headers["x-api-key"];
  const apiSecretKey = req.headers["x-api-secret"];

  if (!apiKey || !apiSecretKey) {
    return res.status(401).json({ error: "API key and secret are required" });
  }

  const credential = await apiCredentialModel.findOne({ apiKey, apiSecretKey });

  if (!credential) {
    return res.status(403).json({ error: "Invalid API credentials" });
  }

  req.userId = credential.userId; 
  next();
};
