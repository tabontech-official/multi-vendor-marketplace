import express from "express";
import {
  createSizeChart,
  getAllSizeCharts,
  deleteSizeChart,
  updateSizeChart,
  getAllSizeChartsForAdmin,
  getAllSizeChart,
} from "../controller/sizechart.js";
import { cpUploads } from "../middleware/upload.js";

const SizeChartRouter = express.Router();

SizeChartRouter.post("/create", cpUploads, createSizeChart);

SizeChartRouter.get("/all/:userId", getAllSizeCharts);
SizeChartRouter.get("/all", getAllSizeChart);

SizeChartRouter.get("/admin/all", getAllSizeChartsForAdmin);

SizeChartRouter.delete("/delete/:id", deleteSizeChart);

SizeChartRouter.put("/update/:id", cpUploads, updateSizeChart);

export default SizeChartRouter;
