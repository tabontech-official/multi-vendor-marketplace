import { brandAssetModel } from '../Models/brandAsset.js';
import { shopifyConfigurationModel } from '../Models/buyCredit.js';
import { CartnumberModel } from '../Models/cartnumber.js';
import { categoryModel } from '../Models/category.js';
import axios from 'axios';
import fs from 'fs';
import { Parser } from 'json2csv';
import path from 'path';
import { listingModel } from '../Models/Listing.js';

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


    const updatedCategories = [];

    for (let cat of categories) {

      const productCount = await listingModel.countDocuments({
        tags: cat.catNo,
      });


      updatedCategories.push({
        ...cat._doc,
        productCount,
      });
    }

    return res.status(200).json(updatedCategories);

  } catch (error) {
    return res
      .status(500)
      .json({ error: "Internal server error while fetching categories" });
  }
};


export const uploadCsvForCategories = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "CSV file is required" });
    }

    const rows = [];

    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on("data", (row) => rows.push(row))
      .on("end", async () => {
        console.log("📥 CSV Import Started");
        const saved = [];
        const failed = [];

        for (let row of rows) {
          try {
            const { title, description, level, parentCatNo, handle } = row;

            const catNo = await generateUniqueCatNo();

            console.log(`➡ Creating category: ${title} (${catNo})`);

            const newCategory = new categoryModel({
              title,
              description,
              level,
              catNo,
              parentCatNo: parentCatNo || "",
            });

            await newCategory.save();

            const collectionRules = [
              {
                column: "TAG",
                relation: "EQUALS",
                condition: catNo,
              },
            ];

            const collectionId = await createShopifyCollection(
              description,
              title,
              collectionRules,
              handle
            );

            newCategory.categoryId = collectionId;
            await newCategory.save();

            console.log(`✅ Saved: ${title} | Shopify ID: ${collectionId}`);
            saved.push({ title, catNo, status: "success" });

          } catch (err) {
            console.error("❌ Error saving row:", err);
            failed.push({
              row,
              error: err.message,
            });
          }
        }

        fs.unlinkSync(req.file.path);

        return res.status(200).json({
          message: "CSV import completed",
          saved,
          failed,
        });
      });
  } catch (error) {
    console.error("🔥 Error processing CSV:", error);
    return res.status(500).json({
      error: "Internal server error while uploading CSV",
    });
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

    if (!categories || categories.length === 0) {
      return res
        .status(404)
        .json({ message: 'No categories found for export.' });
    }

    const rows = [];

    const getFullTitle = (cat) => {
      let title = cat.title;
      let parentCatNo = cat.parentCatNo;

      while (parentCatNo) {
        const parent = categories.find((c) => c.catNo === parentCatNo);
        if (parent) {
          title = parent.title + ' > ' + title;
          parentCatNo = parent.parentCatNo;
        } else {
          break;
        }
      }

      return title;
    };

    categories
      .filter((level1) => level1.level === 'level1')
      .forEach((level1) => {
        // Level 1 Row
        rows.push({
          catNo: level1.catNo,
          title: level1.title,
        });

        categories
          .filter(
            (level2) =>
              level2.parentCatNo === level1.catNo && level2.level === 'level2'
          )
          .forEach((level2) => {
            // Level 2 Row
            rows.push({
              catNo: level2.catNo,
              title: getFullTitle(level2),
            });

            categories
              .filter(
                (level3) =>
                  level3.parentCatNo === level2.catNo &&
                  level3.level === 'level3'
              )
              .forEach((level3) => {
                // Level 3 Row (immediately after Level 2)
                rows.push({
                  catNo: level3.catNo,
                  title: getFullTitle(level3),
                });
              });
          });
      });

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ message: 'No category hierarchy found for export.' });
    }

    const fields = ['catNo', 'title'];
    const parser = new Parser({ fields, header: false }); // ✅ No headers
    const csv = parser.parse(rows);

    const filename = `categories_export_${Date.now()}.csv`;
    const isVercel = process.env.VERCEL === '1';
    const exportDir = isVercel ? '/tmp' : path.join(process.cwd(), 'exports');

    if (!isVercel && !fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const filePath = path.join(exportDir, filename);
    fs.writeFileSync(filePath, csv);

    res.download(filePath, filename, (err) => {
      if (err) {
        console.error('Download error:', err);
        res.status(500).send('Error downloading file');
      }
      fs.unlinkSync(filePath);
    });
  } catch (error) {
    console.error('CSV Export Error:', error);
    res.status(500).json({ error: 'Server error during categories export.' });
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
