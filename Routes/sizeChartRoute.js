import express from "express";
import {
  createSizeChart,
  getAllSizeCharts,
  deleteSizeChart,
  updateSizeChart,
} from "../controller/sizechart.js";
import { cpUploads } from "../middleware/upload.js";

const SizeChartRouter = express.Router();

SizeChartRouter.post("/create", cpUploads, createSizeChart);

SizeChartRouter.get("/all/:userId", getAllSizeCharts);

SizeChartRouter.delete("/delete/:id", deleteSizeChart);

SizeChartRouter.put("/update/:id", cpUploads, updateSizeChart);

export default SizeChartRouter;
