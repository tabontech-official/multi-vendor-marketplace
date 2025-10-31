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

    if (!optionName || !optionValues) {
      return res.status(400).json({
        success: false,
        message: "Missing fields: optionName or optionValues",
      });
    }

    if (typeof optionName === "string") {
      optionName = optionName.split(",").map((n) => n.trim());
    }
    if (typeof optionValues === "string") {
      optionValues = optionValues.split(",").map((v) => v.trim());
    }

    optionName = [...new Set(optionName.filter((n) => n))];
    optionValues = [...new Set(optionValues.filter((v) => v))];

    if (optionName.length === 0 || optionValues.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one valid name and one value are required.",
      });
    }

    const existing = await VariantOption.findOne({
      optionName: { $regex: new RegExp(optionName.join("|"), "i") },
    });

    if (existing) {
      existing.optionName = optionName;
      existing.optionValues = optionValues;

      await existing.save();

      return res.status(200).json({
        success: true,
        message: `Option "${optionName.join(", ")}" already existed and has been fully updated.`,
        data: existing,
      });
    }

    const newOption = new VariantOption({ optionName, optionValues });
    await newOption.save();

    return res.status(201).json({
      success: true,
      message: "New option created successfully.",
      data: newOption,
    });
  } catch (error) {
    console.error("Error creating/updating option:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error while creating or updating option.",
      error: error.message,
    });
  }
};



export const importOptions = async (req, res) => {
  try {
    const file = req.file;
    const userId = req.userId; // optional if using auth middleware

    // 1️⃣ Validate file
    if (!file || !file.buffer) {
      return res.status(400).json({ success: false, message: "No file uploaded." });
    }

    // 2️⃣ Validate userId format (if exists)
    if (userId && !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid userId format." });
    }

    // 3️⃣ Parse CSV
    const allRows = [];
    const stream = Readable.from(file.buffer);

    stream
      .pipe(csv())
      .on("data", (row) => {
        allRows.push(row);
      })
      .on("end", async () => {
        if (allRows.length === 0) {
          return res.status(400).json({
            success: false,
            message: "The uploaded CSV is empty or invalid.",
          });
        }

        let successCount = 0;
        let updatedCount = 0;
        let failCount = 0;
        const results = [];

        // 4️⃣ Process each row
        for (const [index, row] of allRows.entries()) {
          try {
            let optionName = row.optionName
              ? row.optionName.split(",").map((n) => n.trim()).filter(Boolean)
              : [];
            let optionValues = row.optionValues
              ? row.optionValues.split(",").map((v) => v.trim()).filter(Boolean)
              : [];

            if (!optionName.length || !optionValues.length) {
              results.push({
                success: false,
                row: index + 1,
                message: "Missing optionName or optionValues",
              });
              failCount++;
              continue;
            }

            // 5️⃣ Check for existing option (case-insensitive)
            const existing = await VariantOption.findOne({
              optionName: { $regex: new RegExp(optionName.join("|"), "i") },
            });

            if (existing) {
              // 6️⃣ Update existing option (replace both name & values)
              existing.optionName = optionName;
              existing.optionValues = optionValues;
              if (userId) existing.userId = userId;

              await existing.save();
              updatedCount++;

              results.push({
                success: true,
                action: "updated",
                row: index + 1,
                optionName,
                optionValues,
              });
            } else {
              // 7️⃣ Create new option
              const newOption = new VariantOption({
                optionName,
                optionValues,
                ...(userId && { userId }),
              });

              await newOption.save();
              successCount++;

              results.push({
                success: true,
                action: "created",
                row: index + 1,
                optionName,
                optionValues,
              });
            }
          } catch (rowError) {
            console.error(`Row ${index + 1} error:`, rowError.message);
            results.push({
              success: false,
              row: index + 1,
              message: rowError.message,
            });
            failCount++;
          }
        }

        // 8️⃣ Send summary response
        return res.status(201).json({
          success: true,
          message: "CSV processed successfully.",
          totalRows: allRows.length,
          created: successCount,
          updated: updatedCount,
          failed: failCount,
          results,
        });
      })
      .on("error", (err) => {
        console.error("CSV Stream error:", err.message);
        return res.status(500).json({
          success: false,
          message: "Error reading CSV file.",
          error: err.message,
        });
      });
  } catch (error) {
    console.error("Server error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unexpected error during CSV import.",
      error: error.message,
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


export const updateOption = async (req, res) => {
  try {
    const { _id, optionName, optionValues } = req.body;

    if (!_id) {
      return res.status(400).json({ message: "Missing field: _id (option ID is required)" });
    }
    if (!optionName || !optionValues) {
      return res.status(400).json({ message: "Missing fields: optionName or optionValues" });
    }

    let normalizedNames =
      typeof optionName === "string"
        ? optionName.split(",").map((n) => n.trim())
        : optionName;
    let normalizedValues =
      typeof optionValues === "string"
        ? optionValues.split(",").map((v) => v.trim())
        : optionValues;

    normalizedNames = [...new Set(normalizedNames.filter((n) => n))];
    normalizedValues = [...new Set(normalizedValues.filter((v) => v))];

    if (normalizedNames.length === 0 || normalizedValues.length === 0) {
      return res.status(400).json({
        message: "At least one valid option name and value are required.",
      });
    }

    const existingOption = await VariantOption.findById(_id);
    if (!existingOption) {
      return res.status(404).json({ message: "Option not found." });
    }

    const duplicate = await VariantOption.findOne({
      _id: { $ne: _id },
      optionName: { $in: normalizedNames },
    });
    if (duplicate) {
      return res.status(409).json({
        message: `Another option already exists with similar name(s): ${duplicate.optionName.join(", ")}`,
      });
    }

    existingOption.optionName = normalizedNames;
    existingOption.optionValues = normalizedValues;

    const updatedOption = await existingOption.save();

    return res.status(200).json({
      success: true,
      message: "Option updated successfully",
      data: updatedOption,
    });
  } catch (error) {
    console.error("Error updating option:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error while updating option",
      error: error.message,
    });
  }
};
