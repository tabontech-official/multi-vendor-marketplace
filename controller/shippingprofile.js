import { shippingProfileModel } from '../Models/shippingProfileModel.js';
import { shopifyRequest } from './product.js';
import { shopifyConfigurationModel } from '../Models/buyCredit.js';
import { userShippingProfileModel } from '../Models/userShippingProfileModel.js';
import { listingModel } from '../Models/Listing.js';

export const createBulkShippingProfiles = async (req, res) => {
  try {
    console.log('🚀 [START] Bulk creation of 99 Shopify Shipping Profiles...');

    const shopifyConfiguration = await shopifyConfigurationModel.findOne();
    if (!shopifyConfiguration)
      return res
        .status(404)
        .json({ error: 'Shopify configuration not found.' });

    const { shopifyApiKey, shopifyAccessToken, shopifyStoreUrl } =
      shopifyConfiguration;

    const locationIds = [
      'gid://shopify/Location/79719268608',
      'gid://shopify/Location/79949168896',
    ];

    const createdProfiles = [];
    const skippedProfiles = [];
    const failedProfiles = [];

    for (let i = 1; i <= 99; i++) {
      const profileName = `p${i}`;
      const rateName = 'Express';
      const ratePrice = Number((i - 0.01).toFixed(2));

      const createProfileMutation = {
        query: `
          mutation CreateDeliveryProfile($profile: DeliveryProfileInput!) {
            deliveryProfileCreate(profile: $profile) {
              profile { id name }
              userErrors { field message }
            }
          }
        `,
        variables: {
          profile: {
            name: profileName,
            locationGroupsToCreate: [
              {
                locationsToAdd: locationIds,
                zonesToCreate: [
                  {
                    name: 'Oceania',
                    countries: [
                      {
                        code: 'AU',
                        restOfWorld: false,
                        provinces: [
                          { code: 'ACT' },
                          { code: 'NSW' },
                          { code: 'NT' },
                          { code: 'QLD' },
                          { code: 'SA' },
                          { code: 'TAS' },
                          { code: 'VIC' },
                          { code: 'WA' },
                        ],
                      },
                    ],
                    methodDefinitionsToCreate: [
                      {
                        name: rateName,
                        active: true,
                        rateDefinition: {
                          price: {
                            amount: ratePrice.toString(),
                            currencyCode: 'AUD',
                          },
                        },
                        weightConditionsToCreate: [],
                        priceConditionsToCreate: [],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        },
      };

      try {
        const response = await shopifyRequest(
          `${shopifyStoreUrl}/admin/api/2024-07/graphql.json`,
          'POST',
          createProfileMutation,
          shopifyApiKey,
          shopifyAccessToken
        );

        const result = response?.data?.deliveryProfileCreate;
        const errors = result?.userErrors || [];

        if (errors.length > 0) {
          const errMsg = errors[0]?.message || 'Unknown error.';

          if (errMsg.includes('Name has already been taken')) {
            skippedProfiles.push({ profileName, reason: 'Already exists' });
          } else {
            failedProfiles.push({ profileName, ratePrice, error: errMsg });
          }

          await new Promise((r) => setTimeout(r, 1200));
          continue;
        }

        const profile = result?.profile;
        if (!profile?.id) {
          console.error(
            `❌ Shopify did not return a profile ID for ${profileName}`
          );
          failedProfiles.push({
            profileName,
            ratePrice,
            error: 'No profile ID',
          });
          await new Promise((r) => setTimeout(r, 1200));
          continue;
        }

        console.log(`✅ Created profile "${profile.name}" (ID: ${profile.id})`);

        // 5️⃣ Save to MongoDB only successful creations
        await shippingProfileModel.create({
          profileId: profile.id,
          profileName: profile.name,
          rateName,
          ratePrice,
          shopifyResponse: response,
          status: 'created',
        });

        createdProfiles.push({
          profileId: profile.id,
          profileName,
          ratePrice,
        });

        // 6️⃣ Wait to respect Shopify rate limits
        await new Promise((r) => setTimeout(r, 1500));
      } catch (err) {
        console.error(`⚠️ API Error creating ${profileName}: ${err.message}`);
        failedProfiles.push({ profileName, ratePrice, error: err.message });
        await new Promise((r) => setTimeout(r, 1500));
      }
    }

    // 7️⃣ Summary
    console.log(
      `\n✅ Bulk creation complete → Created: ${createdProfiles.length}, Skipped: ${skippedProfiles.length}, Failed: ${failedProfiles.length}`
    );

    return res.status(200).json({
      success: true,
      message: 'Bulk creation of 99 Shopify delivery profiles completed.',
      createdCount: createdProfiles.length,
      skippedCount: skippedProfiles.length,
      failedCount: failedProfiles.length,
      createdProfiles,
      skippedProfiles,
      failedProfiles,
    });
  } catch (error) {
    console.error('🚨 [FATAL] Error in bulk creation:', error);
    res.status(500).json({ error: error.message });
  }
};

export const createShopifyProfile = async (req, res) => {
  try {
    console.log("🚀 [START] Creating Shopify Shipping Profile 'p1'");

    // 1️⃣ Load Shopify credentials
    const shopifyConfiguration = await shopifyConfigurationModel.findOne();
    if (!shopifyConfiguration)
      return res
        .status(404)
        .json({ error: 'Shopify configuration not found.' });

    const { shopifyApiKey, shopifyAccessToken, shopifyStoreUrl } =
      shopifyConfiguration;

    // 👉 replace with your valid location IDs
    const locationIds = [
      'gid://shopify/Location/79719268608',
      'gid://shopify/Location/79949168896',
    ];

    // 2️⃣ GraphQL mutation (exactly like Shopify's Admin payload)
    const createProfileMutation = {
      query:
        'mutation CreateDeliveryProfile($profile: DeliveryProfileInput!) { deliveryProfileCreate(profile: $profile) { profile { id name } userErrors { field message } } }',
      variables: {
        profile: {
          name: 'p1',
          locationGroupsToCreate: [
            {
              locationsToAdd: [
                'gid://shopify/Location/79719268608',
                'gid://shopify/Location/79949168896',
              ],
              zonesToCreate: [
                {
                  name: 'Oceania',
                  countries: [
                    {
                      code: 'AU',
                      restOfWorld: false,
                      provinces: [
                        { code: 'ACT' },
                        { code: 'NSW' },
                        { code: 'NT' },
                        { code: 'QLD' },
                        { code: 'SA' },
                        { code: 'TAS' },
                        { code: 'VIC' },
                        { code: 'WA' },
                      ],
                    },
                  ],
                  methodDefinitionsToCreate: [
                    {
                      name: 'Express',
                      active: true,
                      rateDefinition: {
                        price: { amount: '1', currencyCode: 'AUD' },
                      },
                      weightConditionsToCreate: [],
                      priceConditionsToCreate: [],
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
    };

    console.log('📤 Sending create profile request to Shopify...');

    const response = await shopifyRequest(
      `${shopifyStoreUrl}/admin/api/2024-07/graphql.json`,
      'POST',
      createProfileMutation,
      shopifyApiKey,
      shopifyAccessToken
    );

    console.log('🧾 Shopify Response:', JSON.stringify(response, null, 2));

    const result = response?.data?.deliveryProfileCreate;
    const errors = result?.userErrors || [];

    if (errors.length > 0) {
      console.error('❌ Shopify returned userErrors:', errors);
      return res.status(400).json({ success: false, errors });
    }

    const profile = result?.profile;
    console.log(`✅ Created profile "${profile?.name}" (ID: ${profile?.id})`);

    // // 3️⃣ Save to MongoDB
    // await shippingProfileModel.create({
    //   profileId: profile?.id,
    //   profileName: profile?.name,
    //   rateName: "Express",
    //   ratePrice: 1,
    //   shopifyResponse: response,
    //   status: "created",
    // });

    return res.status(200).json({
      success: true,
      message: 'Shopify delivery profile created successfully.',
      profile,
    });
  } catch (error) {
    console.error('🚨 [FATAL] Error creating Shopify shipping profile:', error);
    res.status(500).json({ error: error.message });
  }
};

export const deleteAllShopifyProfiles = async (req, res) => {
  try {
    console.log('🚀 [START] Deleting all Shopify Shipping Profiles...');

    // 1️⃣ Load Shopify credentials
    const shopifyConfiguration = await shopifyConfigurationModel.findOne();
    if (!shopifyConfiguration)
      return res
        .status(404)
        .json({ error: 'Shopify configuration not found.' });

    const { shopifyApiKey, shopifyAccessToken, shopifyStoreUrl } =
      shopifyConfiguration;

    // 2️⃣ Get all delivery profiles
    const allProfilesQuery = {
      query: `
        {
          deliveryProfiles(first: 250) {
            edges {
              node {
                id
                name
              }
            }
          }
        }
      `,
    };

    console.log('📤 Fetching all shipping profiles...');

    const response = await shopifyRequest(
      `${shopifyStoreUrl}/admin/api/2024-07/graphql.json`,
      'POST',
      allProfilesQuery,
      shopifyApiKey,
      shopifyAccessToken
    );

    const profiles = response?.data?.deliveryProfiles?.edges || [];
    console.log(`📦 Found ${profiles.length} profiles.`);

    if (profiles.length === 0)
      return res.status(200).json({ message: 'No shipping profiles found.' });

    // 3️⃣ Filter out the default profile
    const deletableProfiles = profiles.filter(
      ({ node }) => !node.id.includes('gid://shopify/DeliveryProfile/default')
    );

    if (deletableProfiles.length === 0)
      return res
        .status(200)
        .json({ message: 'Only default profile found — nothing to delete.' });

    const deleted = [];
    const failed = [];

    console.log(`🧹 Found ${deletableProfiles.length} deletable profiles.`);

    // 4️⃣ Delete each using the new mutation
    for (const [index, { node }] of deletableProfiles.entries()) {
      const { id, name } = node;
      console.log(
        `\n🟢 [${index + 1}/${deletableProfiles.length}] Deleting profile: ${name} (${id})`
      );

      const deleteMutation = {
        query: `
          mutation DeleteDeliveryProfile($id: ID!) {
            deliveryProfileRemove(id: $id) {
              job {
                id
                done
              }
              userErrors {
                field
                message
              }
            }
          }
        `,
        variables: { id },
      };

      try {
        const delResponse = await shopifyRequest(
          `${shopifyStoreUrl}/admin/api/2024-07/graphql.json`,
          'POST',
          deleteMutation,
          shopifyApiKey,
          shopifyAccessToken
        );

        console.log(
          '🧾 Raw deletion response:',
          JSON.stringify(delResponse, null, 2)
        );

        const removeData = delResponse?.data?.deliveryProfileRemove;

        if (removeData?.job?.id) {
          console.log(
            `✅ Deletion job started for ${name} (Job ID: ${removeData.job.id})`
          );
          deleted.push({ id, name, jobId: removeData.job.id });
        } else {
          const msg =
            removeData?.userErrors?.[0]?.message ||
            delResponse?.errors?.[0]?.message ||
            'Unknown error';
          console.log(`❌ Failed to delete ${name}: ${msg}`);
          failed.push({ id, name, error: msg });
        }

        // Slow down for rate limits
        await new Promise((r) => setTimeout(r, 1000));
      } catch (err) {
        console.error(`⚠️ Error deleting ${name}: ${err.message}`);
        failed.push({ id, name, error: err.message });
      }
    }

    console.log(
      `\n✅ Completed → Deleted: ${deleted.length}, Failed: ${failed.length}`
    );

    return res.status(200).json({
      message: 'Shopify delivery profile deletion completed.',
      deletedCount: deleted.length,
      failedCount: failed.length,
      deleted,
      failed,
    });
  } catch (error) {
    console.error(
      '🚨 [FATAL] Error deleting Shopify shipping profiles:',
      error
    );
    return res.status(500).json({ error: error.message });
  }
};

export const listAllShopifyProfiles = async (req, res) => {
  try {
    const shopifyConfiguration = await shopifyConfigurationModel.findOne();
    const { shopifyApiKey, shopifyAccessToken, shopifyStoreUrl } =
      shopifyConfiguration;

    const listProfilesQuery = {
      query: `
        {
          deliveryProfiles(first: 100) {
            edges {
              node {
                id
                name
                default
                profileItemsCount
              }
            }
          }
        }
      `,
    };

    const response = await shopifyRequest(
      `${shopifyStoreUrl}/admin/api/2024-07/graphql.json`,
      'POST',
      listProfilesQuery,
      shopifyApiKey,
      shopifyAccessToken
    );

    const profiles = response?.data?.deliveryProfiles?.edges || [];
    res.status(200).json({ count: profiles.length, profiles });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};



export const getShippingProfiles = async (req, res) => {
  try {
    const profiles = await shippingProfileModel.find().sort({ ratePrice: 1 });

    // 🧠 Remove duplicates by profileName (or profileId)
    const uniqueProfiles = profiles.filter(
      (p, index, self) =>
        index ===
        self.findIndex(
          (x) =>
            x.profileId === p.profileId || // unique by Shopify profile
            x.profileName?.toLowerCase() === p.profileName?.toLowerCase()
        )
    );

    res.status(200).json(uniqueProfiles);
  } catch (error) {
    console.error("Error fetching shipping profiles:", error);
    res.status(500).json({ message: "Server error fetching shipping profiles" });
  }
};


export const activateShippingProfile = async (req, res) => {
  try {
    const { userId, profile } = req.body;

    let userRecord = await userShippingProfileModel.findOne({ userId });

    if (!userRecord) {
      userRecord = new userShippingProfileModel({
        userId,
        activeProfiles: [profile],
      });
    } else {
      // prevent duplicates
      const alreadyActive = userRecord.activeProfiles.some(
        (p) => p.profileId === profile.profileId
      );
      if (!alreadyActive) {
        userRecord.activeProfiles.push(profile);
      }
    }

    await userRecord.save();

    res.status(200).json({
      message: "Profile activated successfully",
      data: userRecord,
    });
  } catch (error) {
    console.error("Error activating profile:", error);
    res.status(500).json({ message: "Failed to activate profile" });
  }
};


export const deactivateShippingProfile = async (req, res) => {
  try {
    const { userId, profileId } = req.body;

    const userRecord = await userShippingProfileModel.findOne({ userId });
    if (!userRecord) {
      return res.status(404).json({ message: "User profile not found" });
    }

    userRecord.activeProfiles = userRecord.activeProfiles.filter(
      (p) => p.profileId !== profileId
    );

    await userRecord.save();

    res.status(200).json({
      message: "Profile deactivated successfully",
      data: userRecord,
    });
  } catch (error) {
    console.error("Error deactivating profile:", error);
    res.status(500).json({ message: "Failed to deactivate profile" });
  }
};
  


export const getUserActiveProfiles = async (req, res) => {
  try {
    const { userId } = req.params;

    const record = await userShippingProfileModel.findOne({ userId });

    if (!record || !record.activeProfiles.length) {
      return res.status(200).json([]); // return empty array if none active
    }

    res.status(200).json(record.activeProfiles);
  } catch (error) {
    console.error("Error fetching user active profiles:", error);
    res
      .status(500)
      .json({ message: "Server error fetching user active profiles" });
  }
};


export const getShippingProfilesWithCounts = async (req, res) => {
  try {
    console.log("🟦 [ADMIN API] getShippingProfilesWithCounts — START");

    const profiles = await shippingProfileModel.find().sort({ ratePrice: 1 });
    console.log(`✅ Found ${profiles.length} shipping profiles.`);

    const profilesWithCounts = await Promise.all(
      profiles.map(async (profile) => {
        const count = await listingModel.countDocuments({
          "shipping.profile.profileId": profile.profileId,
        });

        return {
          ...profile.toObject(),
          productCount: count,
        };
      })
    );

    res.status(200).json({
      message: "All shipping profiles with linked product counts fetched successfully.",
      profiles: profilesWithCounts,
    });

    console.log("✅ [ADMIN API] Successfully fetched shipping profile counts.");
  } catch (error) {
    console.error("❌ [ADMIN API] Error fetching shipping profiles with counts:", error);
    res.status(500).json({
      message: "Server error while fetching shipping profiles with product counts.",
      error: error.message,
    });
  } finally {
    console.log("🟨 [ADMIN API] getShippingProfilesWithCounts — END\n");
  }
};