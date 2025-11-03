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
    let { name, aliases, optionValues } = req.body;

    if (!name || !optionValues) {
      return res.status(400).json({
        success: false,
        message: "Missing fields: name or optionValues",
      });
    }

    // Clean and normalize inputs
    name = name.trim();

    if (typeof aliases === "string") {
      aliases = aliases.split(",").map((a) => a.trim());
    }

    if (!Array.isArray(aliases)) aliases = [];

    if (typeof optionValues === "string") {
      optionValues = optionValues.split(",").map((v) => v.trim());
    }

    aliases = [...new Set(aliases.filter((a) => a))];
    optionValues = [...new Set(optionValues.filter((v) => v))];

    if (!name || optionValues.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one valid name and one value are required.",
      });
    }

    // ✅ Check if variant option already exists (by main name)
    const existing = await VariantOption.findOne({
      name: { $regex: new RegExp(`^${name}$`, "i") },
    });

    if (existing) {
      existing.optionName = aliases; // update aliases
      existing.optionValues = optionValues; // update values
      await existing.save();

      return res.status(200).json({
        success: true,
        message: `Option "${name}" already existed and has been updated.`,
        data: existing,
      });
    }

    // ✅ Create new option
    const newOption = new VariantOption({
      name,
      optionName: aliases,
      optionValues,
    });

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

        let createdCount = 0;
        let updatedCount = 0;
        let failedCount = 0;
        const results = [];

        // 4️⃣ Process each row
        for (const [index, row] of allRows.entries()) {
          try {
            // ✅ Expecting headers: optionName, aliases, optionValues
            const optionName = row.optionName ? row.optionName.trim() : "";
            const aliases = row.aliases
              ? row.aliases.split(",").map((a) => a.trim()).filter(Boolean)
              : [];
            const optionValues = row.optionValues
              ? row.optionValues.split(",").map((v) => v.trim()).filter(Boolean)
              : [];

            if (!optionName || optionValues.length === 0) {
              failedCount++;
              results.push({
                success: false,
                row: index + 1,
                message: "Missing 'optionName' or 'optionValues'.",
              });
              continue;
            }

            // 🔍 Check for existing by main name (case-insensitive)
            const existing = await VariantOption.findOne({
              name: { $regex: new RegExp(`^${optionName}$`, "i") },
            });

            if (existing) {
              // 🆙 Update existing record
              existing.name = optionName;
              existing.optionName = aliases;
              existing.optionValues = optionValues;
              if (userId) existing.userId = userId;

              await existing.save();
              updatedCount++;

              results.push({
                success: true,
                action: "updated",
                row: index + 1,
                optionName,
                aliases,
                optionValues,
              });
            } else {
              // ➕ Create new record
              const newOption = new VariantOption({
                name: optionName,
                optionName: aliases,
                optionValues,
                ...(userId && { userId }),
              });

              await newOption.save();
              createdCount++;

              results.push({
                success: true,
                action: "created",
                row: index + 1,
                optionName,
                aliases,
                optionValues,
              });
            }
          } catch (rowError) {
            console.error(`Row ${index + 1} error:`, rowError.message);
            failedCount++;
            results.push({
              success: false,
              row: index + 1,
              message: rowError.message,
            });
          }
        }

        // 5️⃣ Summary Response
        return res.status(201).json({
          success: true,
          message: "CSV processed successfully.",
          totalRows: allRows.length,
          created: createdCount,
          updated: updatedCount,
          failed: failedCount,
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


export const exportCsv = async (req, res) => {
  try {
    const userId = req.userId; // optional, if auth used

    // 1️⃣ Fetch data (optionally filter by user)
    const query = userId ? { userId } : {};
    const options = await VariantOption.find(query).lean();

    if (!options.length) {
      return res.status(404).json({
        success: false,
        message: "No variant options found to export.",
      });
    }

    // 2️⃣ Prepare CSV headers
    const csvFields = ["optionName", "aliases", "optionValues"];
    const parser = new Parser({ fields: csvFields });

    // 3️⃣ Format data
    const csvData = options.map((opt) => ({
      optionName: opt.name || "",
      aliases: Array.isArray(opt.optionName)
        ? opt.optionName.join(", ")
        : opt.optionName || "",
      optionValues: Array.isArray(opt.optionValues)
        ? opt.optionValues.join(", ")
        : opt.optionValues || "",
    }));

    const csv = parser.parse(csvData);

    // 4️⃣ Send CSV file as attachment
    res.header("Content-Type", "text/csv");
    res.attachment("variant_options_export.csv");

    // 5️⃣ Log and send success summary
    console.log(`✅ Exported ${options.length} variant options.`);
    return res.status(200).send(csv);
  } catch (error) {
    console.error("❌ Error exporting variant options:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unexpected error during CSV export.",
      error: error.message,
    });
  }
};


export const updateOption = async (req, res) => {
  try {
    const { _id, name, optionName, optionValues } = req.body;

    // 🔹 Basic validation
    if (!_id) {
      return res
        .status(400)
        .json({ message: "Missing field: _id (option ID is required)" });
    }
    if (!name || !optionValues) {
      return res
        .status(400)
        .json({ message: "Missing fields: name or optionValues" });
    }

    // 🔹 Normalize inputs
    const cleanName = name.trim();

    let normalizedAliases =
      typeof optionName === "string"
        ? optionName
            .split(",")
            .map((n) => n.trim())
            .filter(Boolean)
        : Array.isArray(optionName)
        ? optionName.map((n) => n.trim()).filter(Boolean)
        : [];

    let normalizedValues =
      typeof optionValues === "string"
        ? optionValues
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean)
        : Array.isArray(optionValues)
        ? optionValues.map((v) => v.trim()).filter(Boolean)
        : [];

    if (!cleanName || normalizedValues.length === 0) {
      return res.status(400).json({
        message: "At least one valid option name and value are required.",
      });
    }

    // 🔹 Check if option exists
    const existingOption = await VariantOption.findById(_id);
    if (!existingOption) {
      return res.status(404).json({ message: "Option not found." });
    }

    // 🔹 Prevent duplicate main names in other records
    const duplicate = await VariantOption.findOne({
      _id: { $ne: _id },
      name: { $regex: new RegExp(`^${cleanName}$`, "i") },
    });
    if (duplicate) {
      return res.status(409).json({
        message: `Another option already exists with the name "${duplicate.name}".`,
      });
    }

    // 🔹 Update fields
    existingOption.name = cleanName;
    existingOption.optionName = normalizedAliases;
    existingOption.optionValues = normalizedValues;

    // 🔹 Save
    const updatedOption = await existingOption.save();

    return res.status(200).json({
      success: true,
      message: "Option updated successfully.",
      data: updatedOption,
    });
  } catch (error) {
    console.error("Error updating option:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error while updating option.",
      error: error.message,
    });
  }
};

