import { VariantOption } from '../Models/VariantOption.js';
import csv from "csv-parser";
import { Readable } from "stream";
import { Parser } from 'json2csv';
import mongoose from 'mongoose';


export const getAllOptions = async (req, res) => {
  try {
    const options = await VariantOption.find();
    res.json(options);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error fetching options' });
  }
};

export const addOptions = async (req, res) => {
  try {
    let { optionName, optionValues } = req.body;

    if (!optionName || !optionValues)
      return res.status(400).json({ message: 'Missing fields' });

    if (typeof optionName === 'string') {
      optionName = optionName.split(',').map((n) => n.trim());
    }
    if (typeof optionValues === 'string') {
      optionValues = optionValues.split(',').map((v) => v.trim());
    }

    const newOption = new VariantOption({ optionName, optionValues });
    await newOption.save();

    res.status(201).json(newOption);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error creating option' });
  }
};

export const importOptions = async (req, res) => {
  try {
    const file = req.file;
    const userId = req.userId; 

    if (!file || !file.buffer) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    if (userId && !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid userId format." });
    }

    const allRows = [];
    const stream = Readable.from(file.buffer);

    stream
      .pipe(csv())
      .on("data", (row) => {
        allRows.push(row);
      })
      .on("end", async () => {
        try {
          if (allRows.length === 0) {
            return res
              .status(400)
              .json({ error: "The uploaded CSV is empty or invalid." });
          }

          const results = [];
          let successCount = 0;
          let failCount = 0;

          for (const row of allRows) {
            try {
              const optionNames = row.optionName
                ? row.optionName.split(",").map((v) => v.trim())
                : [];
              const optionValues = row.optionValues
                ? row.optionValues.split(",").map((v) => v.trim())
                : [];

              if (!optionNames.length || !optionValues.length) {
                results.push({
                  success: false,
                  row,
                  message: "Missing optionName or optionValues",
                });
                failCount++;
                continue;
              }

              const optionDoc = new VariantOption({
                optionName: optionNames,
                optionValues: optionValues,
                ...(userId && { userId }), 
              });

              await optionDoc.save();

              results.push({
                success: true,
                optionName: optionNames,
                optionValues: optionValues,
              });
              successCount++;
            } catch (rowError) {
              console.error("Row error:", rowError.message);
              results.push({
                success: false,
                message: rowError.message,
              });
              failCount++;
            }
          }

          return res.status(201).json({
            message: "CSV processed successfully",
            totalRows: allRows.length,
            successCount,
            failCount,
            results,
          });
        } catch (processingError) {
          console.error("Processing error:", processingError.message);
          return res.status(500).json({
            error: "Error processing CSV content.",
            details: processingError.message,
          });
        }
      })
      .on("error", (streamError) => {
        console.error("Stream error:", streamError.message);
        return res.status(500).json({
          error: "Error reading CSV stream.",
          details: streamError.message,
        });
      });
  } catch (error) {
    console.error("Server error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unexpected error during CSV import.",
      error: error.message || "Unknown error",
    });
  }
};

export const deleteOption=async(req,res)=>{
     try {
    const { optionIds } = req.body;
    if (!optionIds || !Array.isArray(optionIds)) {
      return res.status(400).json({ message: "Invalid request body" });
    }
    await VariantOption.deleteMany({ _id: { $in: optionIds } });
    res.json({ message: "Options deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error deleting options" });
  } 
}

export const exportCsv=async(req,res)=>{
   try {
    const options = await VariantOption.find().lean();
    if (!options.length) {
      return res.status(404).json({ message: "No data available" });
    }

    const csvFields = ["optionName", "optionValues"];
    const parser = new Parser({ fields: csvFields });
    const csv = parser.parse(
      options.map((opt) => ({
        optionName: opt.optionName.join(", "),
        optionValues: opt.optionValues.join(", "),
      }))
    );

    res.header("Content-Type", "text/csv");
    res.attachment("variant_options.csv");
    return res.send(csv);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error exporting CSV" });
  } 
}