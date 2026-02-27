import cron from 'node-cron';
import * as XLSX from 'xlsx';
import { getCategoryHierarchyFlexible, shopifyRequest } from './product.js';
import csvImportBatchSchema from '../Models/csvImportBatchSchema.js';
import { shopifyConfigurationModel } from '../Models/buyCredit.js';
import { listingModel } from '../Models/Listing.js';
import { shippingProfileModel } from '../Models/shippingProfileModel.js';
import { authModel } from '../Models/auth.js';
import { sendEmail } from '../middleware/sendEmail.js';

export const startCsvImportWorker = () => {
  console.log('✅ CSV Import Worker Running Every 3 Seconds');

  cron.schedule('*/3 * * * * *', async () => {
    try {
      const batch = await csvImportBatchSchema.findOneAndUpdate(
        { status: 'pending' },
        { status: 'processing', lockedAt: new Date() },
        { new: true }
      );

      if (!batch) return;

      const userId = batch.userId;
      let batchLevelError = null;
      try {
        /* ================= SHOPIFY CONFIG ================= */

        const config = await shopifyConfigurationModel.findOne();
        if (!config) throw new Error('Shopify config missing');

        const { shopifyApiKey, shopifyAccessToken, shopifyStoreUrl } = config;

        /* ================= READ EXCEL ================= */

        const workbook = XLSX.read(batch.fileBuffer, { type: 'buffer' });
        const rows = XLSX.utils.sheet_to_json(
          workbook.Sheets[workbook.SheetNames[0]],
          { defval: '' }
        );

        if (!rows.length) throw new Error('Excel empty');

        /* ================= GROUP BY HANDLE ================= */

        const grouped = {};
        rows.forEach((row) => {
          const handle = row['Product URL']?.trim();
          if (!handle) return;
          if (!grouped[handle]) grouped[handle] = [];
          grouped[handle].push(row);
        });

        // const results = [];
        batch.results = [];
        batch.summary = {
          total: Object.keys(grouped).length,
          success: 0,
          failed: 0,
        };
        await batch.save();
        /* ================= LOOP PRODUCTS ================= */

        for (const handle in grouped) {
          console.log('\n================ PRODUCT START ================');

          const productRows = grouped[handle];
          const firstRow = productRows[0];
          const generateHandle = (value) => {
            return value
              ?.toString()
              .toLowerCase()
              .trim()
              .replace(/[^a-z0-9]+/g, '-') // spaces + special chars → -
              .replace(/^-+|-+$/g, ''); // remove start/end hyphen
          };

          const cleanHandle = generateHandle(handle);
          console.log('🔗 HANDLE:', handle);
          console.log('🔗 CLEAN HANDLE:', cleanHandle);
          console.log('📦 ROW COUNT FOR THIS PRODUCT:', productRows.length);
          const productStartTime = new Date();
          try {
            console.log('🟢 Processing:', handle);

            const trackQuantity =
              String(firstRow['Track Quantity']).toUpperCase() === 'TRUE';

            const shippingShortId = firstRow['Shipping Profile ID'] || null;
            const isPhysical = !!shippingShortId;

            /* ================= VARIANTS ================= */

            /* ================= OPTIONS + VARIANTS (FIXED) ================= */

            const optionNamesRaw = [
              firstRow['Option1 Name'],
              firstRow['Option2 Name'],
              firstRow['Option3 Name'],
            ].filter(Boolean);

            const hasRealOptions = optionNamesRaw.length > 0;
            console.log('\n🎛 OPTION NAMES RAW:', optionNamesRaw);
            console.log('🎛 HAS REAL OPTIONS:', hasRealOptions);
            let options = [];
            let variants = [];

            /* ================= NO OPTIONS CASE ================= */

            if (!hasRealOptions) {
              // ✅ Shopify requires only ONE default variant
              options = [{ name: 'Title', values: ['Default Title'] }];

              variants = [
                {
                  sku: firstRow['SKU'] || null,
                  barcode: firstRow['Barcode'] || null,
                  price: firstRow['Price'] || '0.00',
                  compare_at_price: firstRow['Compare At Price'] || null,
                  inventory_management: trackQuantity ? 'shopify' : null,
                  inventory_quantity: trackQuantity
                    ? parseInt(firstRow['Inventory Qty']) || 0
                    : 0,
                  requires_shipping: isPhysical,
                  taxable: isPhysical,
                  weight: isPhysical ? parseFloat(firstRow['Weight']) || 0 : 0,
                  weight_unit: isPhysical
                    ? firstRow['Weight Unit'] || 'kg'
                    : null,
                  option1: 'Default Title',
                },
              ];
            } else {
              /* ================= OPTIONS EXIST CASE ================= */
              // ✅ Build options dynamically
              options = optionNamesRaw.map((name, index) => ({
                name,
                values: [
                  ...new Set(
                    productRows
                      .map((r) => r[`Option${index + 1} Value`]?.trim())
                      .filter((v) => v && v !== '')
                  ),
                ],
              }));

              const seenCombinations = new Set();

              variants = productRows
                .map((row) => {
                  const option1 = row['Option1 Value']?.trim();
                  const option2 = row['Option2 Value']?.trim() || null;
                  const option3 = row['Option3 Value']?.trim() || null;

                  // ❌ SKIP ROW IF REQUIRED OPTION IS MISSING
                  if (!option1) {
                    console.log('⚠️ Skipping row due to missing option1:', row);
                    return null;
                  }

                  const combinationKey = `${option1}-${option2}-${option3}`;

                  if (seenCombinations.has(combinationKey)) {
                    console.log(
                      '⚠️ Duplicate combination skipped:',
                      combinationKey
                    );
                    return null;
                  }

                  seenCombinations.add(combinationKey);

                  return {
                    sku: row['SKU'] || null,
                    barcode: row['Barcode'] || null,
                    price: row['Price'] || '0.00',
                    compare_at_price: row['Compare At Price'] || null,
                    inventory_management: trackQuantity ? 'shopify' : null,
                    inventory_quantity: trackQuantity
                      ? parseInt(row['Inventory Qty']) || 0
                      : 0,
                    requires_shipping: isPhysical,
                    taxable: isPhysical,
                    weight: isPhysical ? parseFloat(row['Weight']) || 0 : 0,
                    weight_unit: isPhysical ? row['Weight Unit'] || 'kg' : null,
                    option1,
                    option2,
                    option3,
                  };
                })
                .filter(Boolean);
            }
            console.log('\n================ VARIANT DEBUG ================');
            console.log('🧪 FINAL OPTIONS:', JSON.stringify(options, null, 2));
            console.log(
              '🧪 FINAL VARIANTS:',
              JSON.stringify(variants, null, 2)
            );
            console.log('🧪 VARIANT COUNT:', variants.length);

            if (!variants || variants.length === 0) {
              console.log(
                '❌ ERROR: VARIANTS ARRAY IS EMPTY BEFORE SHOPIFY CALL'
              );
            }
            /* ================= OPTIONS ================= */
            const metafieldsArray = [];

            for (let i = 1; i <= 4; i++) {
              const label = firstRow[`Custom Label ${i}`];
              const value = firstRow[`Custom Value ${i}`];

              if (label && value) {
                metafieldsArray.push({
                  label: label.trim(),
                  value: value.trim(),
                  key: `custom_${i}`,
                });
              }
            }

            console.log('🧩 CSV Custom Fields:', metafieldsArray);
            const optionNames = [
              firstRow['Option1 Name'],
              firstRow['Option2 Name'],
              firstRow['Option3 Name'],
            ].filter(Boolean);

            /* ================= CATEGORIES ================= */

            // const categoriesRaw = firstRow['Categories'];
            // const categoryArray = categoriesRaw
            //   ? categoriesRaw.split(',').map((c) => c.trim())
            //   : [];

            // const tagsArray = [
            //   ...categoryArray,
            //   `user_${userId}`,
            //   `vendor_${firstRow['Vendor']}`,
            // ];
            /* ================= CATEGORIES ================= */

            console.log('\n📂 PROCESSING CSV CATEGORIES');

            const categoriesRaw = firstRow['Categories'];

            const categoryNames = categoriesRaw
              ? categoriesRaw.split(',').map((c) => c.trim())
              : [];

            console.log('📥 CSV Category Names:', categoryNames);

            // 🔥 Get catNo hierarchy
            const categoryResult =
              await getCategoryHierarchyFlexible(categoryNames);

            const categoryTagNos = categoryResult.catNos;
            const categoryTitles = categoryResult.titles;
            const tagsArray = [
              ...categoryTagNos,
              `user_${userId}`,
              `vendor_${firstRow['Vendor']}`,
            ];

            console.log('🏷 Final Shopify Tags:', tagsArray);

            console.log('\n💾 SAVING TO MONGO');
            console.log('📦 Categories (Names):', categoryNames);
            console.log('🏷 Tags (CatNos + user + vendor):', tagsArray);

            // const createRes = await shopifyRequest(
            //   `${shopifyStoreUrl}/admin/api/2024-01/products.json`,
            //   'POST',
            //   {
            //     product: {
            //       title: firstRow['Title'],
            //       body_html: firstRow['Description'] || '',
            //       vendor: firstRow['Vendor'] || '',
            //       product_type: firstRow['Product Type'] || '',
            //       status:
            //         String(firstRow['Status']).toLowerCase() === 'active'
            //           ? 'active'
            //           : 'draft',
            //       handle: cleanHandle,
            //       options,
            //       variants,
            //       tags: tagsArray,
            //     },
            //   },
            //   shopifyApiKey,
            //   shopifyAccessToken
            // );

            const existingProduct = await listingModel.findOne({
              userId: userId,
              'seo.handle': cleanHandle,
            });
            // 🔥 CHECK IF PRODUCT HAS ANY IMAGE
            const hasFeaturedImage = productRows.some(
              (row) =>
                row['Featured Image'] && row['Featured Image'].trim() !== ''
            );

            const hasVariantImages = productRows.some((row) =>
              [
                'Variant Image 1',
                'Variant Image 2',
                'Variant Image 3',
                'Variant Image 4',
                'Variant Image 5',
              ].some((key) => row[key] && row[key].trim() !== '')
            );

            const hasAnyImage = hasFeaturedImage || hasVariantImages;

            // Final Status Logic
            const finalStatus =
              hasAnyImage &&
              String(firstRow['Status']).toLowerCase() === 'active'
                ? 'active'
                : 'draft';
            console.log('🔍 Existing Product:', existingProduct);
            let createdProduct;

            if (existingProduct?.shopifyId) {
              console.log(
                '🔄 Existing product found. Updating instead of creating.'
              );

              const updateRes = await shopifyRequest(
                `${shopifyStoreUrl}/admin/api/2024-01/products/${existingProduct.shopifyId}.json`,
                'PUT',
                {
                  product: {
                    id: existingProduct.shopifyId,
                    title: firstRow['Title'],
                    body_html: firstRow['Description'] || '',
                    vendor: firstRow['Vendor'] || '',
                    product_type: firstRow['Product Type'] || '',
                    // status:
                    //   String(firstRow['Status']).toLowerCase() === 'active'
                    //     ? 'active'
                    //     : 'draft',
                    status: finalStatus,
                    handle: cleanHandle,
                    options,
                    variants,
                    tags: tagsArray,
                  },
                },
                shopifyApiKey,
                shopifyAccessToken
              );

              createdProduct = updateRes.product;

              console.log('✅ Shopify Product Updated:', createdProduct.id);
            } else {
              console.log('🆕 Creating New Product');

              const createRes = await shopifyRequest(
                `${shopifyStoreUrl}/admin/api/2024-01/products.json`,
                'POST',
                {
                  product: {
                    title: firstRow['Title'],
                    body_html: firstRow['Description'] || '',
                    vendor: firstRow['Vendor'] || '',
                    product_type: firstRow['Product Type'] || '',
                    status:
                      String(firstRow['Status']).toLowerCase() === 'active'
                        ? 'active'
                        : 'draft',
                    handle: cleanHandle,
                    options,
                    variants,
                    tags: tagsArray,
                  },
                },
                shopifyApiKey,
                shopifyAccessToken
              );

              createdProduct = createRes.product;

              console.log('✅ Shopify Product Created:', createdProduct.id);
            }

            console.log('✅ Shopify Product Created:', createdProduct.id);

            for (const field of metafieldsArray) {
              try {
                await shopifyRequest(
                  `${shopifyStoreUrl}/admin/api/2024-01/products/${createdProduct.id}/metafields.json`,
                  'POST',
                  {
                    metafield: {
                      namespace: 'custom',
                      key: field.key,
                      value: `${field.label}_${field.value}`,
                      type: 'single_line_text_field',
                    },
                  },
                  shopifyApiKey,
                  shopifyAccessToken
                );

                console.log(`✅ Shopify Metafield Created: ${field.key}`);
              } catch (err) {
                console.log('❌ Metafield Error:', err.message);
              }
            }

            if (trackQuantity && createdProduct?.variants?.length) {
              for (let i = 0; i < createdProduct.variants.length; i++) {
                const variant = createdProduct.variants[i];
                const inventoryItemId = variant.inventory_item_id;

                const inventoryLevelsRes = await shopifyRequest(
                  `${shopifyStoreUrl}/admin/api/2024-01/inventory_levels.json?inventory_item_ids=${inventoryItemId}`,
                  'GET',
                  null,
                  shopifyApiKey,
                  shopifyAccessToken
                );

                const locationId =
                  inventoryLevelsRes?.inventory_levels?.[0]?.location_id;

                if (locationId) {
                  await shopifyRequest(
                    `${shopifyStoreUrl}/admin/api/2024-01/inventory_levels/set.json`,
                    'POST',
                    {
                      location_id: locationId,
                      inventory_item_id: inventoryItemId,
                      available: parseInt(productRows[i]['Inventory Qty']) || 0,
                    },
                    shopifyApiKey,
                    shopifyAccessToken
                  );
                }
              }
            }

            /* ================= SHIPPING PROFILE ================= */

            let shippingProfileData = null;

            if (shippingShortId) {
              const profile = await shippingProfileModel.findOne({
                shortId: shippingShortId,
              });

              if (profile?.profileId) {
                const variantGIDs = createdProduct.variants.map(
                  (v) => `gid://shopify/ProductVariant/${v.id}`
                );

                await shopifyRequest(
                  `${shopifyStoreUrl}/admin/api/2024-01/graphql.json`,
                  'POST',
                  {
                    query: `
                  mutation deliveryProfileUpdate($id: ID!, $profile: DeliveryProfileInput!) {
                    deliveryProfileUpdate(id: $id, profile: $profile) {
                      profile { id }
                      userErrors { field message }
                    }
                  }
                `,
                    variables: {
                      id: profile.profileId,
                      profile: { variantsToAssociate: variantGIDs },
                    },
                  },
                  shopifyApiKey,
                  shopifyAccessToken
                );

                shippingProfileData = profile;
                console.log('🚚 Shipping Profile Attached');
              }
            }

            /* ================= IMAGE HANDLING (LIKE updateImages) ================= */

            console.log('\n🖼 CSV IMAGE PROCESSING START');

            const groupImages =
              String(firstRow['Variant Grouped Images']).toUpperCase() ===
              'TRUE';

            const productId = createdProduct.id;
            /* ================= CLEAN IMAGE LOGIC ================= */

            console.log('\n🖼 CSV IMAGE PROCESSING START');

            const imageMap = {};

            /* 1️⃣ Collect ALL images (media + variant together) */

            productRows.forEach((row, index) => {
              const variant = createdProduct.variants[index];

              // Featured Image
              if (row['Featured Image']) {
                const url = row['Featured Image'].trim();

                if (!imageMap[url]) {
                  imageMap[url] = { variantIds: [] };
                }
              }

              // Variant Images
              const variantImageUrls = [
                row['Variant Image 1'],
                row['Variant Image 2'],
                row['Variant Image 3'],
                row['Variant Image 4'],
                row['Variant Image 5'],
              ].filter(Boolean);

              variantImageUrls.forEach((url) => {
                const cleanUrl = url.trim();

                if (!imageMap[cleanUrl]) {
                  imageMap[cleanUrl] = { variantIds: [] };
                }

                imageMap[cleanUrl].variantIds.push(variant.id);
              });
            });

            console.log('🧩 Final Image Map:', imageMap);

            /* 2️⃣ Delete Existing Shopify Images */

            const existingShopify = await shopifyRequest(
              `${shopifyStoreUrl}/admin/api/2024-01/products/${productId}.json`,
              'GET',
              null,
              shopifyApiKey,
              shopifyAccessToken
            );

            for (const img of existingShopify.product.images) {
              await shopifyRequest(
                `${shopifyStoreUrl}/admin/api/2024-01/products/${productId}/images/${img.id}.json`,
                'DELETE',
                null,
                shopifyApiKey,
                shopifyAccessToken
              );
            }

            console.log('🧨 Old Shopify Images Deleted');

            /* 3️⃣ Upload Each URL ONLY ONCE */

            const variantImageMap = {};
            const uploadedImages = [];

            const GROUP_BY_OPTION_INDEX = 0; // color grouping

            const getGroupedAlt = (variant) => {
              const option = createdProduct.options[GROUP_BY_OPTION_INDEX];
              if (!option) return 'variant-image';

              const value = variant[`option${GROUP_BY_OPTION_INDEX + 1}`];

              const index = option.values.findIndex(
                (v) => v.toLowerCase() === value?.toLowerCase()
              );

              return index === -1
                ? 'variant-image'
                : `t4option${GROUP_BY_OPTION_INDEX}_${index}`;
            };

            for (const [url, data] of Object.entries(imageMap)) {
              //   if (url.includes('cdn.shopify.com')) {
              //     console.log('⏭ Skipping Shopify CDN image:', url);
              //     continue;
              //   }
              try {
                let altText = 'variant-image';

                if (groupImages && data.variantIds.length) {
                  const firstVariant = createdProduct.variants.find(
                    (v) => v.id === data.variantIds[0]
                  );

                  altText = getGroupedAlt(firstVariant);
                }

                const upload = await shopifyRequest(
                  `${shopifyStoreUrl}/admin/api/2024-01/products/${productId}/images.json`,
                  'POST',
                  {
                    image: {
                      src: url,
                      alt: altText,
                      variant_ids: data.variantIds,
                    },
                  },
                  shopifyApiKey,
                  shopifyAccessToken
                );

                uploadedImages.push(upload.image);

                data.variantIds.forEach((variantId) => {
                  if (!variantImageMap[variantId]) {
                    variantImageMap[variantId] = [];
                  }

                  variantImageMap[variantId].push({
                    src: url,
                    imageId: upload.image.id,
                    alt: upload.image.alt,
                    position: variantImageMap[variantId].length + 1,
                    created_at: new Date(),
                  });
                });
              } catch (imageErr) {
                console.log('⚠️ Image Upload Failed, Skipping:', url);
                console.log('⚠️ Reason:', imageErr.message);

                continue; // 🔥 only skip this image
              }
            }
            const featuredImageUrls = [
              ...new Set(
                productRows
                  .map((row) => row['Featured Image']?.trim())
                  .filter(Boolean)
              ),
            ];
            console.log('🎯 Featured Only URLs:', featuredImageUrls);

            // const featuredImageObject = uploadedImages.find(
            //   (img) => img.src === featuredImageUrl
            // );

            console.log('✅ Shopify Images Synced Correctly');

            /* ===== 1️⃣ Collect Media Images ===== */

            /* ================= FETCH FULL PRODUCT ================= */

            const fullProductRes = await shopifyRequest(
              `${shopifyStoreUrl}/admin/api/2024-01/products/${createdProduct.id}.json`,
              'GET',
              null,
              shopifyApiKey,
              shopifyAccessToken
            );

            const fullProduct = fullProductRes.product;

            /* ================= SAVE CLEAN STRUCTURE TO DB ================= */
            const hasSku = productRows.some(
              (row) => row['SKU'] && row['SKU'].trim() !== ''
            );

            const baseSku = hasSku ? productRows[0]['SKU'] : null;
            const baseBarcode = hasSku ? productRows[0]['Barcode'] : null;
            const dbProduct = {
              id: fullProduct.id,
              shopifyId: fullProduct.id,
              title: fullProduct.title,
              body_html: fullProduct.body_html,
              vendor: fullProduct.vendor,
              product_type: fullProduct.product_type,
              created_at: fullProduct.created_at,
              status: fullProduct.status,
              metafields: metafieldsArray.map((m) => ({
                label: m.label,
                value: m.value,
              })),

              tags: fullProduct.tags
                ? fullProduct.tags.split(',').map((t) => t.trim())
                : [],

              categories: categoryTitles,

              options: fullProduct.options.map((opt) => ({
                name: opt.name,
                values: opt.values,
              })),

              variants: fullProduct.variants.map((v) => ({
                id: v.id,
                title: v.title,
                option1: v.option1,
                option2: v.option2,
                option3: v.option3,
                price: v.price,
                compare_at_price: v.compare_at_price,
                inventory_management: v.inventory_management,
                inventory_quantity: v.inventory_quantity,
                sku: v.sku,
                barcode: v.barcode,
                inventory_item_id: v.inventory_item_id,
                weight: v.weight,
                weight_unit: v.weight_unit,
                image_id: v.image_id,
                isParent: false,
                VariantStatus: 'inactive',
              })),
              approvalStatus: 'approved',

              // images: uploadedImages
              //   .filter((img) => {
              //     const fileName = img.src.split('/').pop().split('?')[0];

              //     return featuredImageUrls.some(
              //       (url) => url.split('/').pop().split('?')[0] === fileName
              //     );
              //   })
              //   .map((img, index) => ({
              //     id: img.id?.toString(),
              //     product_id: fullProduct.id?.toString(),
              //     position: index + 1,
              //     created_at: new Date(),
              //     updated_at: new Date(),
              //     alt: img.alt || null,
              //     width: img.width || null,
              //     height: img.height || null,
              //     src: img.src,
              //   })),

              images: fullProduct.images.map((img) => ({
                id: img.id?.toString(),
                product_id: fullProduct.id?.toString(),
                position: img.position,
                created_at: new Date(img.created_at),
                updated_at: new Date(img.updated_at || new Date()),
                alt: img.alt || null,
                width: img.width || null,
                height: img.height || null,
                src: img.src, // ✅ Shopify CDN URL
              })),
              variantImages: Object.entries(variantImageMap).map(
                ([variantId, images]) => ({
                  variantId,
                  images,
                })
              ),

              inventory: {
                track_quantity: trackQuantity,
                quantity: trackQuantity
                  ? parseInt(productRows[0]['Inventory Qty']) || 0
                  : 0,
                continue_selling: true,
                has_sku: hasSku,
                sku: baseSku,
                barcode: baseBarcode,
              },
              shipping: {
                track_shipping: isPhysical,
                weight: isPhysical
                  ? parseFloat(productRows[0]['Weight']) || 0
                  : 0,
                weight_unit: productRows[0]['Weight Unit'] || 'kg',
                freeShipping: false,
                profile: shippingProfileData || null,
              },
              seo: {
                title: fullProduct.title,
                description: '',
                handle: cleanHandle,
              },
              userId,
              shopifyResponse: fullProductRes,
            };

            await listingModel.findOneAndUpdate(
              { shopifyId: fullProduct.id },
              {
                ...dbProduct,
                metafields: metafieldsArray.map((m) => ({
                  label: m.label,
                  value: m.value,
                })),
              },
              { upsert: true, new: true }
            );

            console.log('💾 Product Saved Correctly');

            batch.results.push({
              handle: cleanHandle,
              status: 'success',
              startedAt: productStartTime,
              completedAt: new Date(),
            });

            batch.summary.success += 1;
            await batch.save();
          } catch (productErr) {
            console.log('❌ Product Error:', productErr.message);

            batch.results.push({
              handle: cleanHandle,
              status: 'error',
              message: productErr.message,
              startedAt: productStartTime,
              completedAt: new Date(),
            });

            batch.summary.failed += 1;
            await batch.save();

            continue; // move to next product
          }
        }

        // batch.status = 'completed';
        // batch.results = results;
        // batch.completedAt = new Date();
        // batch.fileBuffer = undefined;
        // await batch.save();
        if (batch.summary.failed > 0 && batch.summary.success > 0) {
          batch.status = 'completed'; // partial success
        } else if (batch.summary.failed > 0) {
          batch.status = 'failed';
        } else {
          batch.status = 'completed';
        }

        batch.completedAt = new Date();
        batch.fileBuffer = undefined;

        await batch.save();

        try {
          const user = await authModel.findById(userId);

          if (
            user &&
            user.email &&
            typeof user.email === 'string' &&
            user.email.trim() !== ''
          ) {
            const failedList =
              batch.results
                ?.filter((r) => r.status === 'error')
                ?.map((r) => `<li>${r.handle} — ${r.message}</li>`)
                ?.join('') || '';

            await sendEmail({
              to: user.email,
              subject: `Batch ${batch.batchNo} Import Completed`,
              html: `
              <h2>CSV Import Summary</h2>
              <p><strong>Batch No:</strong> ${batch.batchNo}</p>
              <p><strong>Total Products:</strong> ${batch.summary?.total || 0}</p>
              <p style="color:green;">
                <strong>Successfully Uploaded:</strong> ${batch.summary?.success || 0}
              </p>
              <p style="color:red;">
                <strong>Failed:</strong> ${batch.summary?.failed || 0}
              </p>

              ${
                batch.summary?.failed > 0
                  ? `<h3 style="color:red;">Failed Products</h3><ul>${failedList}</ul>`
                  : `<p style="color:green;">All products uploaded successfully 🎉</p>`
              }

              ${
                batchLevelError
                  ? `<p style="color:red;"><strong>Batch Error:</strong> ${batchLevelError.message}</p>`
                  : ''
              }

              <hr/>
              <p>This is an automated notification.</p>
            `,
            });

            console.log('📧 Batch completion email sent');
          }
        } catch (mailErr) {
          console.log('❌ Email sending failed:', mailErr.message);
        }
      } catch (err) {
        console.log('🔥 Batch Level Error:', err.message);

        batchLevelError = err;

        batch.status = 'failed';
        batch.error = err.message;
        batch.completedAt = new Date();
        batch.fileBuffer = undefined;

        await batch.save();
      }
    } catch (err) {
      console.log('Worker Error:', err.message);
    }
  });
};
