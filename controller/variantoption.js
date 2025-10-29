import { VariantOption } from '../Models/VariantOption.js';
import csv from "csv-parser";
import { Readable } from "stream";
import { Parser } from 'json2csv';

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
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const results = [];

    const stream = Readable.from(req.file.buffer);

    stream
      .pipe(csv())
      .on("data", (row) => {
        const optionNames = row.optionName
          ? row.optionName.split(",").map((v) => v.trim())
          : [];
        const optionValues = row.optionValues
          ? row.optionValues.split(",").map((v) => v.trim())
          : [];

        if (optionNames.length && optionValues.length) {
          results.push({ optionName: optionNames, optionValues: optionValues });
        }
      })
      .on("end", async () => {
        try {
          await VariantOption.insertMany(results);
          res.status(201).json({
            message: "CSV imported successfully",
            count: results.length,
          });
        } catch (dbError) {
          console.error("DB Error:", dbError);
          res
            .status(500)
            .json({ message: "Error inserting options into database" });
        }
      })
      .on("error", (err) => {
        console.error("Stream error:", err);
        res.status(500).json({ message: "Error processing CSV" });
      });
  } catch (error) {
    console.error("Import Error:", error);
    res.status(500).json({ message: "Unexpected error importing CSV" });
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