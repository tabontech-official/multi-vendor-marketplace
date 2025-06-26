import { brandAssetModel } from '../Models/brandAsset.js';
import { shopifyConfigurationModel } from '../Models/buyCredit.js';
import { CartnumberModel } from '../Models/cartnumber.js';
import { categoryModel } from '../Models/category.js';
import axios from 'axios';

// let catNumber = 1; 

// const generateUniqueCatNo = (level, parentCatNo = '') => {
//   const catNo = `cat_${catNumber}`;
//   catNumber++;
//   return catNo;
// };

// export const createCategory = async (req, res) => {
//   try {
//     const { title, description, categories } = req.body;

//     if (!categories || categories.length === 0) {
//       return res.status(400).json({ error: 'Categories are required' });
//     }

//     const savedCategories = [];
//     const collectionRules = [];

//     console.log('Starting category saving process...');

//     for (const [index, category] of categories.entries()) {
//       const catNo = generateUniqueCatNo(category.level);

//       console.log(`Generating catNo for category ${category.title}: ${catNo}`);

//       const categoryToSave = new categoryModel({
//         title: category.title,
//         description: category.description,
//         level: category.level,
//         catNo,
//         parentCatNo: category.parentCatNo || '',
//       });

//       await categoryToSave.save();

//       savedCategories.push(categoryToSave);

//       console.log(`Adding collection rules for category ${category.title}`);

//       if (category.level === 'level1') {
//         if (catNo) {
//           collectionRules.push({
//             column: 'TAG',
//             relation: 'EQUALS',
//             condition: catNo,
//           });
//         } else {
//           console.error(
//             `Missing catNo for Level 1 category: ${category.title}`
//           );
//         }
//       } else if (category.level === 'level2') {
//         if (catNo) {
//           collectionRules.push({
//             column: 'TAG',
//             relation: 'EQUALS',
//             condition: catNo,
//           });
//           if (category.parentCatNo) {
//             collectionRules.push({
//               column: 'TAG',
//               relation: 'EQUALS',
//               condition: category.parentCatNo,
//             });
//           } else {
//             console.error(
//               `Level 2 category missing parentCatNo: ${category.title}`
//             );
//           }
//         } else {
//           console.error(
//             `Missing catNo for Level 2 category: ${category.title}`
//           );
//         }
//       } else if (category.level === 'level3') {
//         if (catNo) {
//           collectionRules.push({
//             column: 'TAG',
//             relation: 'EQUALS',
//             condition: catNo,
//           });
//           if (category.parentCatNo) {
//             collectionRules.push({
//               column: 'TAG',
//               relation: 'EQUALS',
//               condition: category.parentCatNo,
//             });

//             const parentLevel2 = await categoryModel.findOne({
//               catNo: category.parentCatNo,
//               level: 'level2',
//             });

//             if (parentLevel2) {
//               if (parentLevel2.parentCatNo) {
//                 collectionRules.push({
//                   column: 'TAG',
//                   relation: 'EQUALS',
//                   condition: parentLevel2.parentCatNo,
//                 });
//               } else {
//                 console.error(
//                   `Level 2 category missing parentCatNo for Level 3 category: ${category.title}`
//                 );
//               }
//             } else {
//               console.error(
//                 `Level 2 category with catNo ${category.parentCatNo} not found for Level 3 category: ${category.title}`
//               );
//             }
//           } else {
//             console.error(
//               `Level 3 category missing parentCatNo: ${category.title}`
//             );
//           }
//         } else {
//           console.error(
//             `Missing catNo for Level 3 category: ${category.title}`
//           );
//         }
//       }
//     }

//     const validCollectionRules = collectionRules.filter(
//       (rule) => rule.condition
//     );

//     if (validCollectionRules.length === 0) {
//       return res.status(400).json({
//         error: 'No valid collection rules to create Shopify collection',
//       });
//     }

//     const collectionId = await createShopifyCollection(
//       description,
//       title,
//       validCollectionRules
//     );

//     res.status(200).json({
//       message: 'Categories saved successfully and Shopify collection created',
//       collections: collectionId,
//     });
//   } catch (error) {
//     console.error('Error creating category tree:', error);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// };

const generateUniqueCatNo = async () => {
  try {
    const lastCategory = await categoryModel.findOne().sort({ catNo: -1 }).limit(1);

    let newCatNumber = 1;
    if (lastCategory) {
      const lastCatNo = lastCategory.catNo;
      const numberPart = parseInt(lastCatNo.split('_')[1]);
      newCatNumber = numberPart + 1;
    }

    return `cat_${newCatNumber}`;
  } catch (error) {
    console.error('Error generating catNo:', error);
    throw new Error('Error generating catNo');
  }
};

export const createCategory = async (req, res) => {
  try {
    const { title, description, categories } = req.body;

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
          collectionRules.push({
            column: 'TAG',
            relation: 'EQUALS',
            condition: category.parentCatNo,
          });
        } else {
          console.error(`Level 2 category missing parentCatNo: ${category.title}`);
        }
      } else if (category.level === 'level3') {
        collectionRules.push({
          column: 'TAG',
          relation: 'EQUALS',
          condition: catNo, 
        });

        if (category.parentCatNo) {
          collectionRules.push({
            column: 'TAG',
            relation: 'EQUALS',
            condition: category.parentCatNo, 
          });

          const parentLevel2 = await categoryModel.findOne({
            catNo: category.parentCatNo,
            level: 'level2',
          });

          if (parentLevel2 && parentLevel2.parentCatNo) {
            collectionRules.push({
              column: 'TAG',
              relation: 'EQUALS',
              condition: parentLevel2.parentCatNo,
            });
          } else {
            console.error(`Level 2 category missing parentCatNo for Level 3 category: ${category.title}`);
          }
        } else {
          console.error(`Level 3 category missing parentCatNo: ${category.title}`);
        }
      }
    }

    const validCollectionRules = collectionRules.filter((rule) => rule.condition);

    if (validCollectionRules.length === 0) {
      return res.status(400).json({
        error: 'No valid collection rules to create Shopify collection',
      });
    }

    const collectionId = await createShopifyCollection(description, title, validCollectionRules);

    res.status(200).json({
      message: 'Categories saved successfully and Shopify collection created',
      collections: collectionId,
    });
  } catch (error) {
    console.error('Error creating category tree:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};


const createShopifyCollection = async (description, title, collectionRules) => {
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

    const variables = {
      collection: {
        title: title,
        descriptionHtml: description,
        handle: title.toLowerCase().replace(/\s+/g, '-'),
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

export const getCategory = async (req, res) => {
  try {
    const result = await categoryModel.find();

    if (result && result.length > 0) {
      res.status(200).send(result);
    } else {
      res.status(404).json({ message: 'No categories found' });
    }
  } catch (error) {
    console.error('Error fetching categories:', error);
    res
      .status(500)
      .json({ error: 'Internal server error while fetching categories' });
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
