import { brandAssetModel } from '../Models/brandAsset.js';
import { shopifyConfigurationModel } from '../Models/buyCredit.js';
import { CartnumberModel } from '../Models/cartnumber.js';
import { categoryModel } from '../Models/category.js';
import axios from 'axios';
import fs from 'fs';
import { Parser } from 'json2csv';
import path from 'path';
import { listingModel } from '../Models/Listing.js';
import csv from "csv-parser";
import { Readable } from "stream";

const generateUniqueCatNo = async () => {
  try {
    const categories = await categoryModel.find({}, 'catNo').lean();

    let maxNumber = 0;

    categories.forEach((cat) => {
      const numberPart = parseInt(cat.catNo.replace('cat_', ''));
      if (!isNaN(numberPart) && numberPart > maxNumber) {
        maxNumber = numberPart;
      }
    });

    const newCatNo = `cat_${maxNumber + 1}`;
    return newCatNo;
  } catch (error) {
    console.error('Error generating unique catNo:', error);
    throw new Error('Failed to generate unique catNo');
  }
};

export const createCategory = async (req, res) => {
  try {
    const { title, description, categories, handle } = req.body;

    if (!categories || categories.length === 0) {
      return res.status(400).json({ error: 'Categories are required' });
    }

    const savedCategories = [];
    const collectionRules = [];

    console.log('Starting category saving process...');

    for (const [index, category] of categories.entries()) {
      const catNo = await generateUniqueCatNo();
      console.log(`Generating catNo for category ${category.title}: ${catNo}`);

      const categoryToSave = new categoryModel({
        title: category.title,
        description: category.description,
        level: category.level,
        catNo,
        parentCatNo: category.parentCatNo || '',
      });

      await categoryToSave.save();

      savedCategories.push(categoryToSave);

      console.log(`Adding collection rules for category ${category.title}`);

      if (category.level === 'level1') {
        collectionRules.push({
          column: 'TAG',
          relation: 'EQUALS',
          condition: catNo,
        });
      } else if (category.level === 'level2') {
        collectionRules.push({
          column: 'TAG',
          relation: 'EQUALS',
          condition: catNo,
        });

        if (category.parentCatNo) {
          console.error(
            `Level 2 category should not have a parentCatNo: ${category.title}`
          );
        }
      } else if (category.level === 'level3') {
        collectionRules.push({
          column: 'TAG',
          relation: 'EQUALS',
          condition: catNo,
        });

        // Log an error if parentCatNo is present, but not required
        if (category.parentCatNo) {
          console.error(
            `Level 3 category should not have a parentCatNo: ${category.title}`
          );
        }
      }
    }

    const validCollectionRules = collectionRules.filter(
      (rule) => rule.condition
    );

    if (validCollectionRules.length === 0) {
      return res.status(400).json({
        error: 'No valid collection rules to create Shopify collection',
      });
    }

    const collectionId = await createShopifyCollection(
      description,
      title,
      validCollectionRules,
      handle
    );
    for (const savedCategory of savedCategories) {
      savedCategory.categoryId = collectionId;
      await savedCategory.save();
      console.log(
        `Updated category ${savedCategory.title} with collectionId ${collectionId}`
      );
    }

    res.status(200).json({
      message: 'Categories saved successfully and Shopify collection created',
      collections: collectionId,
    });
  } catch (error) {
    console.error('Error creating category tree:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const createShopifyCollection = async (
  description,
  title,
  collectionRules,
  handle
) => {
  try {
    console.log('Fetching Shopify configuration...');
    const shopifyConfig = await shopifyConfigurationModel.findOne();
    if (!shopifyConfig) {
      console.log('Shopify configuration not found.');
      throw new Error('Shopify configuration not found.');
    }

    const ACCESS_TOKEN = shopifyConfig.shopifyAccessToken;
    const SHOPIFY_STORE_URL = shopifyConfig.shopifyStoreUrl;

    console.log(
      'Creating Shopify collection with the following rules:',
      collectionRules
    );

    const mutation = `
      mutation CreateCollection($collection: CollectionInput!) {
        collectionCreate(input: $collection) {
          collection {
            id
            title
            handle
            descriptionHtml
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const collectionHandle = handle || title.toLowerCase().replace(/\s+/g, '-');

    const variables = {
      collection: {
        title: title,
        descriptionHtml: description,
        handle: collectionHandle,
        ruleSet: {
          appliedDisjunctively: true,
          rules: collectionRules,
        },
      },
    };

    const response = await axios.post(
      `${SHOPIFY_STORE_URL}/admin/api/2023-10/graphql.json`,
      { query: mutation, variables: variables },
      {
        headers: {
          'X-Shopify-Access-Token': ACCESS_TOKEN,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('Shopify API Response:', response.data);

    if (
      response.data &&
      response.data.data &&
      response.data.data.collectionCreate
    ) {
      const collectionCreate = response.data.data.collectionCreate;

      if (
        collectionCreate.userErrors &&
        collectionCreate.userErrors.length > 0
      ) {
        console.error('Shopify User Errors:', collectionCreate.userErrors);
        throw new Error(
          `Error creating collection: ${collectionCreate.userErrors[0].message}`
        );
      }

      if (collectionCreate.collection) {
        return collectionCreate.collection.id;
      } else {
        throw new Error('Error: No collection created, no ID returned.');
      }
    } else {
      throw new Error('Shopify API response missing collectionCreate field.');
    }
  } catch (error) {
    console.error('Error creating Shopify collection:', error.message);
    throw new Error('Error creating Shopify collection.');
  }
};

const extractCategoryAndChildren = (categories) => {
  return categories.map((category) => {
    return {
      column: 'TAG',
      relation: 'EQUALS',
      condition: category.catNo, // Use catNo to filter products by category
    };
  });
};

// export const getCategory = async (req, res) => {
//   try {
//     const result = await categoryModel.find();

//     if (result && result.length > 0) {
//       res.status(200).send(result);
//     } else {
//       res.status(404).json({ message: 'No categories found' });
//     }
//   } catch (error) {
//     console.error('Error fetching categories:', error);
//     res
//       .status(500)
//       .json({ error: 'Internal server error while fetching categories' });
//   }
// };


export const getCategory = async (req, res) => {
  try {
    const categories = await categoryModel.find();

    if (!categories.length) {
      return res.status(404).json({ message: "No categories found" });
    }

    // Run productCount queries in parallel
    const updatedCategories = await Promise.all(
      categories.map(async (cat) => {
        const productCount = await listingModel.countDocuments({
          tags: cat.catNo,
        });

        return {
          ...cat._doc,     // includes createdAt & updatedAt
          productCount,
        };
      })
    );

    return res.status(200).json(updatedCategories);

  } catch (error) {
    return res
      .status(500)
      .json({ error: "Internal server error while fetching categories" });
  }
};



// export const uploadCsvForCategories = async (req, res) => {
//   try {
//     if (!req.file) {
//       return res.status(400).json({ error: "CSV file is required" });
//     }

//     const rows = [];

//     // Convert buffer to stream
//     const stream = Readable.from(req.file.buffer.toString());

//     stream
//       .pipe(csv())
//       .on("data", (row) => rows.push(row))
//       .on("end", async () => {
//         console.log("📥 CSV Import Started");

//         const saved = [];
//         const failed = [];

//         for (let row of rows) {
//           try {
//             const { title, description, level, parentCatNo, handle } = row;

//             if (!title || !level) {
//               failed.push({ row, error: "Missing required fields" });
//               continue;
//             }

//             const catNo = await generateUniqueCatNo();

//             console.log(`➡ Creating category: ${title} (${catNo})`);

//             const newCategory = new categoryModel({
//               title,
//               description,
//               level,
//               catNo,
//               parentCatNo: parentCatNo || "",
//             });

//             await newCategory.save();

//             // SHOPIFY RULES
//             const collectionRules = [
//               {
//                 column: "TAG",
//                 relation: "EQUALS",
//                 condition: catNo,
//               },
//             ];

//             const collectionId = await createShopifyCollection(
//               description,
//               title,
//               collectionRules,
//               handle
//             );

//             newCategory.categoryId = collectionId;
//             await newCategory.save();

//             saved.push({
//               title,
//               catNo,
//               status: "success",
//             });

//           } catch (err) {
//             console.error("❌ Error:", err);
//             failed.push({ row, error: err.message });
//           }
//         }

//         return res.status(200).json({
//           message: "CSV import completed",
//           saved,
//           failed,
//         });
//       });
//   } catch (error) {
//     console.error("🔥 Error processing CSV:", error);
//     return res.status(500).json({
//       error: "Internal server error while uploading CSV",
//     });
//   }
// };


export const uploadCsvForCategories = async (req, res) => {
  try {
    console.log("🔥 CSV Upload API Hit");

    const file = req.file;

    if (!file || !file.buffer) {
      console.log("❌ No file or buffer found");
      return res.status(400).json({ error: "CSV file is required" });
    }

    console.log("📄 File received. Size:", file.buffer.length);

    const rows = [];
    const stream = Readable.from(file.buffer);

    stream
      .pipe(csv())
      .on("data", (row) => {
        console.log("➡ CSV Row:", row);
        rows.push(row);
      })
      .on("end", async () => {
        console.log("📥 CSV Parsing Completed. Total rows:", rows.length);

        const saved = [];
        const failed = [];

        for (let row of rows) {
          console.log("\n==============================");
          console.log("🚀 Processing Row:", row);

          try {
            const { title, description, level, parentCatNo, handle } = row;

            if (!title || !level) {
              console.log("❌ Missing required fields:", row);
              failed.push({ row, error: "Missing required fields" });
              continue;
            }

            console.log(`📌 Level: ${level}, Parent: ${parentCatNo}`);

            // 🔍 Debug: Check parentCatNo exists for Level 2
            if (level == "2") {
              const parent = await categoryModel.findOne({ catNo: parentCatNo });
              console.log("🔎 Parent Lookup:", parent);

              if (!parent) {
                console.log("❌ Parent category not found for Level 2");
                failed.push({
                  row,
                  error: "Parent category not found for Level 2",
                });
                continue;
              }
            }

            // ========= Generate catNo ==========
            const catNo = await generateUniqueCatNo();
            console.log(`✨ Generated catNo: ${catNo}`);

            // ========= MongoDB Save ==========
            console.log("💾 Saving new category in DB...");

            const newCategory = new categoryModel({
              title,
              description,
              level,
              catNo,
              parentCatNo: parentCatNo || "",
            });

            await newCategory.save();
            console.log("✅ Saved in MongoDB");

            // ========= Shopify Rules ==========
            const collectionRules = [
              {
                column: "TAG",
                relation: "EQUALS",
                condition: catNo,
              },
            ];

            console.log("🛒 Creating Shopify Collection with rules:", collectionRules);

            const collectionId = await createShopifyCollection(
              description,
              title,
              collectionRules,
              handle
            );

            console.log("🆔 Shopify Collection Created:", collectionId);

            newCategory.categoryId = collectionId;
            await newCategory.save();

            console.log("📌 Category updated with Shopify collectionId");

            saved.push({
              title,
              catNo,
              status: "success",
            });

          } catch (err) {
            console.error("❌ Error while saving row:", row, " Error:", err);
            failed.push({
              row,
              error: err.message,
            });
          }
        }

        console.log("\n==============================");
        console.log("🎉 CSV Import Completed");
        console.log("✔ Saved:", saved.length);
        console.log("❌ Failed:", failed.length);

        return res.status(200).json({
          message: "CSV import completed",
          saved,
          failed,
        });
      });
  } catch (error) {
    console.error("🔥 Fatal CSV processing error:", error);
    return res.status(500).json({
      error: "Internal server error while uploading CSV",
    });
  }
};



export const replaceAndDeleteCategory = async (req, res) => {
  try {
    console.log("======== 🟦 CATEGORY REPLACEMENT STARTED 🟦 ========");

    const { replaceData } = req.body;

    if (!replaceData || !Array.isArray(replaceData)) {
      return res.status(400).json({ error: "Invalid request" });
    }

    const cfg = await shopifyConfigurationModel.findOne();
    const ACCESS_TOKEN = cfg.shopifyAccessToken;
    const STORE_URL = cfg.shopifyStoreUrl;

    for (const item of replaceData) {
      const { oldCategoryId, newCategoryId } = item;

      console.log(`\n🔄 Processing: OLD=${oldCategoryId} → NEW=${newCategoryId}`);

      const oldCat = await categoryModel.findById(oldCategoryId);
      const newCat = await categoryModel.findById(newCategoryId);

      if (!oldCat || !newCat) {
        console.log("❌ Category not found");
        continue;
      }

      console.log(`📌 OLD TAG = ${oldCat.catNo}`);
      console.log(`📌 NEW TAG = ${newCat.catNo}`);

      // ============================================================
      // STEP 1 → FETCH PRODUCTS WHICH ACTUALLY HAVE OLD TAG
      // ============================================================
      const products = await listingModel.find({ tags: oldCat.catNo });
      console.log(`🔍 Found ${products.length} products with OLD TAG`);

      for (const product of products) {
        const beforeTags = [...product.tags];

        // Remove old
        product.tags = product.tags.filter((t) => t !== oldCat.catNo);

        // Add new
        if (!product.tags.includes(newCat.catNo))
          product.tags.push(newCat.catNo);

        await product.save();

        console.log(
          `✔ Updated Mongo Product ${product._id}: ${beforeTags.join(",")} → ${product.tags.join(",")}`
        );

        // ============================================================
        // STEP 1B → ALSO UPDATE TAGS IN SHOPIFY PRODUCT
        // ============================================================
        if (product.productId) {
          console.log(`🔵 Updating Shopify Product: ${product.productId}`);

          try {
            await axios.put(
              `${STORE_URL}/admin/api/2024-04/products/${product.productId}.json`,
              {
                product: {
                  id: product.productId,
                  tags: product.tags.join(", "),
                },
              },
              {
                headers: {
                  "X-Shopify-Access-Token": ACCESS_TOKEN,
                  "Content-Type": "application/json",
                },
              }
            );

            console.log("   ✔ Shopify tags updated");
          } catch (err) {
            console.error(
              "   ❌ Shopify tag update failed:",
              err.response?.data || err.message
            );
          }
        }
      }

      // ============================================================
      // STEP 2 → FIX HIERARCHY
      // ============================================================
      console.log("\n🟧 Fixing hierarchy...");

      if (oldCat.level === "level1" || oldCat.level === "level2") {
        await categoryModel.updateMany(
          { parentCatNo: oldCat.catNo },
          { $set: { parentCatNo: newCat.catNo } }
        );
        console.log("✔ Children categories updated");
      }

      // ============================================================
      // STEP 3 → DELETE SHOPIFY COLLECTION
      // ============================================================
      if (oldCat.categoryId) {
        console.log(`🟥 Deleting Shopify Collection: ${oldCat.categoryId}`);

        const mutation = `
          mutation collectionDelete($input: CollectionDeleteInput!) {
            collectionDelete(input: $input) {
              deletedCollectionId
              userErrors { field message }
            }
          }
        `;

        try {
          await axios.post(
            `${STORE_URL}/admin/api/2024-04/graphql.json`,
            { query: mutation, variables: { input: { id: oldCat.categoryId } } },
            {
              headers: {
                "X-Shopify-Access-Token": ACCESS_TOKEN,
                "Content-Type": "application/json",
              },
            }
          );
          console.log("✔ Shopify Collection Deleted");
        } catch (err) {
          console.log("❌ Shopify Delete Error", err.response?.data || err.message);
        }
      }

      // ============================================================
      // STEP 4 → DELETE OLD CATEGORY
      // ============================================================
      await categoryModel.findByIdAndDelete(oldCategoryId);
      console.log(`✔ Deleted OLD category: ${oldCat.title}`);
    }

    console.log("======== 🟩 PROCESS COMPLETED 🟩 ========");

    res.status(200).json({
      message:
        "Tags updated in DB + Shopify, hierarchy fixed, old categories removed",
    });
  } catch (error) {
    console.error("🔥 ERROR:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};






export const getCollectionData = async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await brandAssetModel.findOne({ userId: userId });

    if (result) {
      res.status(200).send(result);
    } else {
      res.status(404).send({ message: 'No brand asset found for the user.' });
    }
  } catch (error) {
    console.error('Error fetching brand asset:', error);
    res.status(500).send({ message: 'Internal server error' });
  }
};

export const delet = async (req, res) => {
  try {
    const result = await categoryModel.deleteMany();
    if (result) {
      res.status(200).send('deleted');
    }
  } catch (error) {}
};

export const getSingleCategory = async (req, res) => {
  const { categoryId } = req.params;

  try {
    const selectedCategory = await categoryModel.findOne({ catNo: categoryId });

    if (!selectedCategory) {
      return res.status(404).json({ message: 'Category not found' });
    }

    let categoriesToFetch = [categoryId];

    if (selectedCategory.level === 'level2' && selectedCategory.parentCatNo) {
      categoriesToFetch.push(selectedCategory.parentCatNo);
    }

    if (selectedCategory.level === 'level3' && selectedCategory.parentCatNo) {
      const parentCategory = await categoryModel.findOne({
        catNo: selectedCategory.parentCatNo,
      });

      if (parentCategory && parentCategory.parentCatNo) {
        categoriesToFetch.push(parentCategory.parentCatNo);
      }
    }

    const categories = await categoryModel.find({
      catNo: { $in: categoriesToFetch },
    });

    const filteredCategories = categories.filter(
      (cat) => cat.catNo === categoryId
    );

    return res.status(200).json(filteredCategories[0] || {});
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error' });
  }
};

export const exportCsvForCategories = async (req, res) => {
  try {
    const categories = await categoryModel.find();

    if (!categories.length) {
      return res.status(404).json({ message: "No categories found for export." });
    }

    const normalize = (val) => (val ? val.toString().trim().toLowerCase() : "");

    const formatLevel = (level) => {
      const lvl = normalize(level);
      if (lvl === "level1" || lvl === "1" || lvl === "level 1") return "Level 1";
      if (lvl === "level2" || lvl === "2" || lvl === "level 2") return "Level 2";
      if (lvl === "level3" || lvl === "3" || lvl === "level 3") return "Level 3";
      return level; // default if dirty
    };

    const rows = [];

    const getFullTitle = (cat) => {
      let title = cat.title;
      let parentCatNo = cat.parentCatNo;

      while (parentCatNo) {
        const parent = categories.find((c) => c.catNo === parentCatNo);
        if (parent) {
          title = parent.title + " > " + title;
          parentCatNo = parent.parentCatNo;
        } else break;
      }
      return title;
    };

    const level1Cats = categories.filter((c) =>
      ["level1", "1", "level 1"].includes(normalize(c.level))
    );

    if (!level1Cats.length) {
      return res.status(404).json({
        message: "No Level 1 categories found for export.",
      });
    }

    level1Cats.forEach((level1) => {
      rows.push({
        catNo: level1.catNo,
        title: level1.title,
        level: "Level 1",
      });

      const level2Cats = categories.filter(
        (c) =>
          c.parentCatNo === level1.catNo &&
          ["level2", "2", "level 2"].includes(normalize(c.level))
      );

      level2Cats.forEach((level2) => {
        rows.push({
          catNo: level2.catNo,
          title: getFullTitle(level2),
          level: "Level 2",
        });

        const level3Cats = categories.filter(
          (c) =>
            c.parentCatNo === level2.catNo &&
            ["level3", "3", "level 3"].includes(normalize(c.level))
        );

        level3Cats.forEach((level3) => {
          rows.push({
            catNo: level3.catNo,
            title: getFullTitle(level3),
            level: "Level 3",
          });
        });
      });
    });

    if (!rows.length) {
      return res.status(404).json({
        message: "No category hierarchy found for export.",
      });
    }

    const fields = ["catNo", "title", "level"];
    const parser = new Parser({ fields, header: true });
    const csv = parser.parse(rows);

    const filename = `categories_export_${Date.now()}.csv`;
    const isVercel = process.env.VERCEL === "1";
    const exportDir = isVercel ? "/tmp" : path.join(process.cwd(), "exports");

    if (!isVercel && !fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const filePath = path.join(exportDir, filename);
    fs.writeFileSync(filePath, csv);

    res.download(filePath, filename, (err) => {
      if (err) {
        console.error("Download error:", err);
        res.status(500).send("Error downloading file");
      }
      fs.unlinkSync(filePath);
    });
  } catch (error) {
    console.error("CSV Export Error:", error);
    res.status(500).json({ error: "Server error during categories export." });
  }
};



export const deleteCollection = async (req, res) => {
  const { categoryIds } = req.body;

  try {
    const shopifyConfig = await shopifyConfigurationModel.findOne();
    if (!shopifyConfig) {
      console.log('Shopify configuration not found.');
      throw new Error('Shopify configuration not found.');
    }

    const ACCESS_TOKEN = shopifyConfig.shopifyAccessToken;
    const SHOPIFY_STORE_URL = shopifyConfig.shopifyStoreUrl;

    if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
      return res.status(400).json({ error: 'No category IDs provided.' });
    }

    const categories = await categoryModel.find({ _id: { $in: categoryIds } });

    if (!categories || categories.length === 0) {
      return res.status(404).json({ error: 'No matching categories found.' });
    }

    const uniqueShopifyGIDs = [
      ...new Set(
        categories
          .map((cat) =>
            cat.categoryId &&
            cat.categoryId.includes('gid://shopify/Collection/')
              ? cat.categoryId
              : null
          )
          .filter(Boolean)
      ),
    ];

    console.log(
      'Deleting Shopify Collections (GraphQL GIDs):',
      uniqueShopifyGIDs
    );

    for (const gid of uniqueShopifyGIDs) {
      const mutation = `
        mutation collectionDelete($input: CollectionDeleteInput!) {
          collectionDelete(input: $input) {
            deletedCollectionId
            shop {
              id
              name
            }
            userErrors {
              field
              message
            }
          }
        }
      `;

      const variables = {
        input: {
          id: gid,
        },
      };

      try {
        const response = await axios.post(
          `${SHOPIFY_STORE_URL}/admin/api/2024-04/graphql.json`,
          { query: mutation, variables },
          {
            headers: {
              'X-Shopify-Access-Token': ACCESS_TOKEN,
              'Content-Type': 'application/json',
            },
          }
        );

        const result = response.data;

        if (result.data.collectionDelete.userErrors.length > 0) {
          console.error(
            `Shopify Error Deleting Collection ${gid}:`,
            result.data.collectionDelete.userErrors
          );
        } else {
          console.log(`Deleted Shopify Collection: ${gid}`);
        }
      } catch (shopifyErr) {
        console.error(`Shopify API Error for ${gid}:`, shopifyErr.message);
      }
    }

    await categoryModel.deleteMany({ _id: { $in: categoryIds } });
    console.log(`Deleted categories from DB: ${categoryIds.join(', ')}`);

    return res.json({
      success: true,
      message:
        'Selected categories and their Shopify collections deleted via GraphQL.',
    });
  } catch (error) {
    console.error('Delete Error:', error.message);
    return res
      .status(500)
      .json({ error: 'Something went wrong during deletion' });
  }
};


export const updateCategory = async (req, res) => {
  try {
    const { replaceData } = req.body;

    if (!replaceData || !Array.isArray(replaceData) || replaceData.length === 0) {
      return res.status(400).json({ error: "replaceData must be a non-empty array" });
    }

    const shopifyConfig = await shopifyConfigurationModel.findOne();
    if (!shopifyConfig) {
      return res.status(500).json({ error: "Shopify configuration missing in DB" });
    }

    const ACCESS_TOKEN = shopifyConfig.shopifyAccessToken;
    const SHOPIFY_STORE_URL = shopifyConfig.shopifyStoreUrl;

    for (let item of replaceData) {
      const { categoryId, newName } = item;

      if (!categoryId) return res.status(400).json({ error: "Category ID is required" });

      const category = await categoryModel.findById(categoryId);
      if (!category) continue;

      category.title = newName;
      category.description = ""; 
      await category.save();


      if (category.categoryId) {
        const mutation = `
          mutation UpdateCollection($input: CollectionInput!) {
            collectionUpdate(input: $input) {
              collection {
                id
                title
                descriptionHtml
              }
              userErrors {
                field
                message
              }
            }
          }
        `;

        const variables = {
          input: {
            id: category.categoryId,   
            title: newName,
            descriptionHtml: "",     
          },
        };

        try {
          const shopifyRes = await axios.post(
            `${SHOPIFY_STORE_URL}/admin/api/2024-04/graphql.json`,
            { query: mutation, variables },
            {
              headers: {
                "X-Shopify-Access-Token": ACCESS_TOKEN,
                "Content-Type": "application/json",
              },
            }
          );

          const errors =
            shopifyRes.data?.data?.collectionUpdate?.userErrors || [];

          if (errors.length > 0) {
            console.error("Shopify Error:", errors);
          }
        } catch (err) {
          console.error("Shopify Update Error:", err.message);
        }
      }
    }

    return res.status(200).json({
      message: "Categories updated in DB & Shopify",
    });

  } catch (error) {
    console.error("Update Instead Delete Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

