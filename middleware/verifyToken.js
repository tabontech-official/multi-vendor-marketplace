// import jwt from 'jsonwebtoken';

// export const verifyToken = (req, res, next) => {
//   const authHeader = req.headers['authorization'];
//   if (!authHeader || !authHeader.startsWith('Bearer ')) {
//     return res.status(401).json({ error: 'No token provided' });
//   }

//   const token = authHeader.split(' ')[1];

//   try {
//     const decoded = jwt.verify(token, process.env.SECRET_KEY);
//     req.user = decoded.payLoad; 
//     next();
//   } catch (err) {
//     return res.status(403).json({ error: 'Invalid or expired token' });
//   }
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
