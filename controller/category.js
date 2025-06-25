// import { categoryModel } from "../Models/category.js";

// const prefixCatNos = (items = [], start = { i: 1 }) => {
//   return items.map((item) => {
//     const updatedCatNo = item.catNo?.startsWith("cat-")
//       ? item.catNo
//       : `cat-${start.i++}`;

//     let children = [];
//     if (item.children && item.children.length > 0) {
//       children = prefixCatNos(item.children, start);
//     }

//     return {
//       ...item,
//       catNo: updatedCatNo,
//       children
//     };
//   });
// };

// export const createCategory = async (req, res) => {
//   try {
//     const { categories, description } = req.body;

//     const processedCategories = prefixCatNos(categories);

//     const existing = await categoryModel.findOne();
//     let saved;

//     if (existing) {
//       existing.categories = processedCategories;
//       existing.description = description;
//       saved = await existing.save();
//     } else {
//       saved = await categoryModel.create({
//         categories: processedCategories,
//         description
//       });
//     }

//     res.status(200).json({
//       message: existing
//         ? "Category tree updated successfully"
//         : "Category tree created successfully",
//       data: saved
//     });
//   } catch (err) {
//     console.error("Category tree save/update failed:", err);
//     res.status(500).json({ error: "Internal server error" });
//   }
// };


// export const getCategory = async (req, res) => {
//   try {
//     const result = await categoryModel.find();

//     // Check if result is non-empty
//     if (result && result.length > 0) {
//       // Send the result back with status 200
//       res.status(200).send(result);
//     } else {
//       // If no categories are found
//       res.status(404).json({ message: "No categories found" });
//     }
//   } catch (error) {
//     console.error("Error fetching categories:", error);
//     // Send an error message if there's an exception
//     res.status(500).json({ error: "Internal server error while fetching categories" });
//   }
// };
import { brandAssetModel } from "../Models/brandAsset.js";
import { shopifyConfigurationModel } from "../Models/buyCredit.js";
import { categoryModel } from "../Models/category.js";
import axios from 'axios';
const extractCategoryAndChildren = (categories) => {
  let allCategories = [];

  categories.forEach(category => {
    console.log('Processing category:', category);

    allCategories.push({ column: "TAG", relation: "EQUALS", condition: category.catNo });

    console.log('Added rule for category:', { column: "TAG", relation: "EQUALS", condition: category.catNo });

    if (category.children && category.children.length > 0) {
      console.log(`Recursively processing children for category: ${category.catNo}`);
      category.children.forEach(child => {
        console.log('Processing child category:', child);

        allCategories.push({ column: "TAG", relation: "EQUALS", condition: child.catNo });

        console.log('Added rule for child:', { column: "TAG", relation: "EQUALS", condition: child.catNo });

        if (child.children && child.children.length > 0) {
          console.log(`Recursively processing further children for child category: ${child.catNo}`);
          allCategories = allCategories.concat(extractCategoryAndChildren(child.children));
        }
      });
    }
  });

  console.log('Final list of all categories with rules:', allCategories);

  return allCategories;
};

const createShopifyCollection = async (description, title, categories) => {
  try {
    const shopifyConfig = await shopifyConfigurationModel.findOne();
    if (!shopifyConfig) {
      throw new Error("Shopify configuration not found.");
    }

    const ACCESS_TOKEN = shopifyConfig.shopifyAccessToken;
    const SHOPIFY_STORE_URL = shopifyConfig.shopifyStoreUrl;

    const smartCollectionConditions = extractCategoryAndChildren(categories);

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

    const variables = {
      collection: {
        title: title,
        descriptionHtml: description,  
        handle: "", 
        sortOrder: "BEST_SELLING", 
        ruleSet: {
          appliedDisjunctively: true,
          rules: smartCollectionConditions,
        },
      },
    };

    console.log('Sending GraphQL mutation with payload:', JSON.stringify(variables, null, 2));

    const response = await axios.post(
      `${SHOPIFY_STORE_URL}/admin/api/2023-10/graphql.json`,
      {
        query: mutation,
        variables: variables,
      },
      {
        headers: {
          'X-Shopify-Access-Token': ACCESS_TOKEN,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('Shopify API Response:', response.data);

    if (response.data.data.collectionCreate.collection) {
      return response.data.data.collectionCreate.collection.id;
    }

    if (response.data.errors) {
      console.error('Error creating collection:', response.data.errors);
      throw new Error("Error creating Shopify collection.");
    }
  } catch (error) {
    console.error("Error creating Shopify collection:", error.message);
    if (error.response) {
      console.error("Shopify API response error:", error.response.data);
    }
    throw new Error(error.message);
  }
};


export const createCategory = async (req, res) => {
  try {
    const { title, description, userId } = req.body; 

    const existingCategory = await categoryModel.findOne();
    if (!existingCategory) {
      return res.status(404).json({ error: "No categories found." });
    }

    const categories = existingCategory.categories;

    const smartCollectionConditions = extractCategoryAndChildren(categories);

    const createdCollections = [];
    for (const category of categories) {
      const collectionId = await createShopifyCollection(description, title, categories);

      const brandAsset = await brandAssetModel.findOneAndUpdate(
        { userId: userId }, 
        { shopifyCollectionId: collectionId, description: description ,sellerName:title}, 
        { new: true, upsert: true } 
      );

      createdCollections.push({ collectionId });  
    }

    return res.status(200).json({
      message: "Category tree and Shopify collections updated successfully",
      collections: createdCollections,  
    });
  } catch (err) {
    console.error("Category tree save/update failed:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};


// export const createCategory = async (req, res) => {
//   try {
//     const { title, description } = req.body;

//     const existingCategory = await categoryModel.findOne();
//     if (!existingCategory) {
//       return res.status(404).json({ error: "No categories found." });
//     }


//     const categories = existingCategory.categories;

//     const smartCollectionConditions = extractCategoryAndChildren(categories);

//     const createdCollections = [];
//     for (const category of categories) {

//       const collectionId = await createShopifyCollection(description, title, categories);


//       await brandAssetModel.findOneAndUpdate(
//         { userId: req.body.userId },
//         { shopifyCollectionId: collectionId }, 
//         { new: true, upsert: true }
//       );

//       createdCollections.push({ collectionId });  
//     }

//     return res.status(200).json({
//       message: "Category tree and Shopify collections updated successfully",
//       collections: createdCollections,  
//     });
//   } catch (err) {
//     console.error("Category tree save/update failed:", err);
//     res.status(500).json({ error: "Internal server error" });
//   }
// };




export const getCategory = async (req, res) => {
  try {
    const result = await categoryModel.find();

    if (result && result.length > 0) {
      res.status(200).send(result);
    } else {
      res.status(404).json({ message: "No categories found" });
    }
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ error: "Internal server error while fetching categories" });
  }
};

export const getCollectionData = async (req, res) => {
    try {
        const { userId } = req.params;

        const result = await brandAssetModel.findOne({ userId: userId });

        if (result) {
            res.status(200).send(result);
        } else {
            res.status(404).send({ message: "No brand asset found for the user." });
        }
    } catch (error) {
        console.error("Error fetching brand asset:", error);
        res.status(500).send({ message: "Internal server error" });
    }
};
