import csv from "csv-parser";
import { Readable } from "stream";
import { shopifyConfigurationModel } from "../Models/buyCredit.js";
import { listingModel } from "../Models/Listing.js";
import { shopifyRequest } from "./product.js";

export const processInventoryBatch = async (batch) => {
  console.log("\n=================================================");
  console.log(`🚀 STARTING INVENTORY BATCH: ${batch.batchNo}`);
  console.log("=================================================\n");

  try {
    console.log("🔍 Loading Shopify configuration...");
    const config = await shopifyConfigurationModel.findOne();
    if (!config) throw new Error("Shopify config missing");

    const { shopifyApiKey, shopifyAccessToken, shopifyStoreUrl } = config;
    console.log("✅ Shopify config loaded\n");

    console.log("📄 Reading CSV file from buffer...");
    const rows = [];
    const stream = Readable.from(batch.fileBuffer);

    await new Promise((resolve, reject) => {
      stream
        .pipe(csv())
        .on("data", (row) => rows.push(row))
        .on("end", resolve)
        .on("error", reject);
    });

    console.log(`📊 Total Rows Found: ${rows.length}\n`);

    batch.summary = {
      total: rows.length,
      success: 0,
      failed: 0,
    };

    batch.results = [];
    await batch.save();

    console.log("🔄 Starting SKU processing...\n");

    for (const row of rows) {
      const sku = row["Variant SKU"]?.trim();
      const quantity = row["Variant Inventory Qty"]?.trim();
      const status = row["Status"]?.trim()?.toLowerCase();
      const price = row["Variant Price"]?.trim();
      const compareAtPrice = row["Variant Compare At Price"]?.trim();

      const startedAt = new Date();

      if (!sku) {
        console.log("⚠️ Skipping row — SKU missing\n");
        continue;
      }

      console.log("-------------------------------------------------");
      console.log(`🟢 Processing SKU: ${sku}`);
      console.log(`   ➜ Quantity: ${quantity || "N/A"}`);
      console.log(`   ➜ Price: ${price || "N/A"}`);
      console.log(`   ➜ Compare At: ${compareAtPrice || "N/A"}`);

      try {
        console.log("🔎 Searching product in DB...");
        const products = await listingModel.find({
          "variants.sku": sku,
        });

        if (!products.length) {
          console.log("❌ Product not found in DB");
          batch.results.push({
            sku,
            status: "error",
            message: "product_not_found",
            startedAt,
            completedAt: new Date(),
          });
          batch.summary.failed++;
          continue;
        }

        for (const product of products) {
          let variantUpdated = false;
          let statusUpdated = false;

          for (let variant of product.variants) {
            if (variant.sku !== sku) continue;

            console.log(`✅ Product Found | Variant ID: ${variant.id}`);

            try {
              // ================= INVENTORY UPDATE =================
              if (quantity) {
                console.log("📦 Fetching inventory_item_id...");

                const variantResponse = await shopifyRequest(
                  `${shopifyStoreUrl}/admin/api/2024-01/variants/${variant.id}.json`,
                  "GET",
                  null,
                  shopifyApiKey,
                  shopifyAccessToken
                );

                const inventoryItemId =
                  variantResponse?.variant?.inventory_item_id;

                if (!inventoryItemId)
                  throw new Error("missing_inventory_item_id");

                console.log("✅ inventory_item_id:", inventoryItemId);

                console.log("📍 Fetching inventory levels...");
                const inventoryLevelsRes = await shopifyRequest(
                  `${shopifyStoreUrl}/admin/api/2024-01/inventory_levels.json?inventory_item_ids=${inventoryItemId}`,
                  "GET",
                  null,
                  shopifyApiKey,
                  shopifyAccessToken
                );

                const locationId =
                  inventoryLevelsRes?.inventory_levels?.[0]?.location_id;

                if (!locationId)
                  throw new Error("no_inventory_level_found");

                console.log("✅ location_id:", locationId);

                console.log("📤 Updating inventory in Shopify...");

                await shopifyRequest(
                  `${shopifyStoreUrl}/admin/api/2024-01/inventory_levels/set.json`,
                  "POST",
                  {
                    location_id: locationId,
                    inventory_item_id: inventoryItemId,
                    available: parseInt(quantity),
                  },
                  shopifyApiKey,
                  shopifyAccessToken
                );

                variant.inventory_quantity = parseInt(quantity);
                variant.inventory_item_id = inventoryItemId;
                variant.location_id = locationId;

                variantUpdated = true;
                console.log("✅ Inventory updated successfully");
              }

              // ================= PRICE UPDATE =================
              if (price || compareAtPrice) {
                console.log("💰 Updating price in Shopify...");

                await shopifyRequest(
                  `${shopifyStoreUrl}/admin/api/2024-01/variants/${variant.id}.json`,
                  "PUT",
                  {
                    variant: {
                      id: variant.id,
                      ...(price && { price: parseFloat(price) }),
                      ...(compareAtPrice && {
                        compare_at_price: parseFloat(compareAtPrice),
                      }),
                    },
                  },
                  shopifyApiKey,
                  shopifyAccessToken
                );

                if (price) variant.price = parseFloat(price);
                if (compareAtPrice)
                  variant.compare_at_price = parseFloat(compareAtPrice);

                variantUpdated = true;
                console.log("✅ Price updated successfully");
              }
            } catch (err) {
              console.log(`🔥 ERROR processing SKU ${sku}`);
              console.log("Error:", err.message);

              batch.results.push({
                sku,
                status: "error",
                message: err.message,
                startedAt,
                completedAt: new Date(),
              });
              batch.summary.failed++;
            }
          }

          // ================= STATUS UPDATE =================
          if (status && ["active", "draft", "archived"].includes(status)) {
            try {
              console.log("🔄 Updating product status...");

              await shopifyRequest(
                `${shopifyStoreUrl}/admin/api/2024-01/products/${product.id}.json`,
                "PUT",
                { product: { id: product.id, status } },
                shopifyApiKey,
                shopifyAccessToken
              );

              product.status = status;
              statusUpdated = true;

              console.log("✅ Product status updated");
            } catch (err) {
              console.log("❌ Status update failed:", err.message);
              batch.summary.failed++;
            }
          }

          if (variantUpdated || statusUpdated) {
            console.log("💾 Saving changes to local DB...");
            await product.save({ optimisticConcurrency: false });
            console.log("✅ Local DB updated");
          }
        }

        batch.results.push({
          sku,
          status: "success",
          startedAt,
          completedAt: new Date(),
        });

        batch.summary.success++;
        console.log(`🎉 SKU ${sku} processed successfully\n`);

      } catch (err) {
        console.log("🔥 Unexpected Error:", err.message);
        batch.summary.failed++;
      }

      await batch.save();
    }

    console.log("\n📊 Batch Summary");
    console.log("Success:", batch.summary.success);
    console.log("Failed:", batch.summary.failed);

    batch.status =
      batch.summary.failed > 0 && batch.summary.success > 0
        ? "completed"
        : batch.summary.failed > 0
        ? "failed"
        : "completed";

    batch.completedAt = new Date();
    batch.fileBuffer = undefined;

    await batch.save();

    console.log("\n=================================================");
    console.log(`✅ INVENTORY BATCH COMPLETED: ${batch.batchNo}`);
    console.log("=================================================\n");

  } catch (err) {
    console.log("\n🔥 BATCH LEVEL ERROR");
    console.log("Message:", err.message);

    batch.status = "failed";
    batch.error = err.message;
    batch.completedAt = new Date();
    batch.fileBuffer = undefined;

    await batch.save();
  }
};