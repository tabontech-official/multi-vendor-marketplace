import express from "express";
import multer from "multer";
import {
  getAllOptions,
  addOptions,
  importOptions,
  deleteOption,
  exportCsv,
  updateOption,
} from "../controller/variantoption.js";
import { Csvuplaods } from "../middleware/multer.js";

const variantOptionRouter = express.Router();


variantOptionRouter.get("/getOptions", getAllOptions);

variantOptionRouter.post("/addOptions", addOptions);

variantOptionRouter.post("/importOptions", Csvuplaods, importOptions);

variantOptionRouter.delete("/deleteOptions", deleteOption);

variantOptionRouter.get("/getCsvForOptions", exportCsv);
variantOptionRouter.put("/updateOption", updateOption);

export default variantOptionRouter;
