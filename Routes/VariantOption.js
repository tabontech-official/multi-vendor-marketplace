import express from "express";
import multer from "multer";
import {
  getAllOptions,
  addOptions,
  importOptions,
  deleteOption,
  exportCsv,
} from "../controller/variantoption.js";
import { Csvuplaods } from "../middleware/multer.js";

const variantOptionRouter = express.Router();


variantOptionRouter.get("/getOptions", getAllOptions);

variantOptionRouter.post("/addOption", addOptions);

variantOptionRouter.post("/importOptions", Csvuplaods, importOptions);

variantOptionRouter.delete("/deleteOptions", deleteOption);

variantOptionRouter.get("/getCsvForOptions", exportCsv);

export default variantOptionRouter;
