import { alertModel } from "../Models/alert.js";
import mongoose from "mongoose";
import { orderModel } from "../Models/order.js";


// export const getAllAlerts = async (req, res) => {
//   try {
//     const alerts = await alertModel.aggregate([
//       {
//         $sort: { createdAt: -1 },
//       },
//       {
//         $group: {
//           _id: {
//             userId: '$userId',
//             productId: '$productId',
//             type: '$type',
//           },
//           doc: { $first: '$$ROOT' },
//         },
//       },
//       {
//         $replaceRoot: { newRoot: '$doc' },
//       },

//       {
//         $lookup: {
//           from: 'users',
//           localField: 'userId',
//           foreignField: '_id',
//           as: 'user',
//         },
//       },
//       {
//         $unwind: '$user',
//       },

//       // 👇 SAME STRUCTURE AS getUserAlerts
//       {
//         $project: {
//           message: 1,
//           type: 1,
//           productId: 1,
//           createdAt: 1,
//           meta: 1,

//           user: {
//             _id: '$user._id',
//             name: {
//               $concat: ['$user.firstName', ' ', '$user.lastName'],
//             },
//             email: '$user.email',
//           },
//         },
//       },
//     ]);

//     res.json({
//       success: true,
//       count: alerts.length,
//       data: alerts,
//     });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: 'Error fetching alerts' });
//   }
// };


export const getAllAlerts = async (req, res) => {
  try {
    const HIGH_REFUND_RATE_THRESHOLD = 15;
    const HIGH_REFUND_QTY_THRESHOLD = 3;
    const LATE_SHIPPING_DAYS = 2;

    const savedAlerts = await alertModel.aggregate([
      {
        $sort: { createdAt: -1 },
      },
      {
        $group: {
          _id: {
            userId: '$userId',
            productId: '$productId',
            type: '$type',
          },
          doc: { $first: '$$ROOT' },
        },
      },
      {
        $replaceRoot: { newRoot: '$doc' },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
        },
      },
      {
        $unwind: {
          path: '$user',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          message: 1,
          type: 1,
          productId: 1,
          orderId: 1,
          referenceId: 1,
          createdAt: 1,
          meta: 1,

          user: {
            _id: '$user._id',
            name: {
              $trim: {
                input: {
                  $concat: [
                    { $ifNull: ['$user.firstName', ''] },
                    ' ',
                    { $ifNull: ['$user.lastName', ''] },
                  ],
                },
              },
            },
            email: '$user.email',
          },
        },
      },
    ]);

    const orders = await orderModel.find({}).lean();

    const productStatsMap = new Map();
    const operationalIssues = [];

    const getLineItemId = (item) => {
      return item?.id || item?.lineItemId || item?.line_item_id || null;
    };

    const getSnapshotByLineItem = (order, lineItem) => {
      const snapshots = order.ProductSnapshot || [];

      return snapshots.find((snap) => {
        return (
          String(snap.variantId) === String(lineItem.variant_id) ||
          String(snap.productId) === String(lineItem.product_id)
        );
      });
    };

    const getProductName = (snapshot, lineItem) => {
      return (
        snapshot?.product?.title ||
        lineItem?.title ||
        lineItem?.name ||
        'Product'
      );
    };

    const getVariantTitle = (snapshot, lineItem) => {
      return snapshot?.variant?.title || lineItem?.variant_title || '';
    };

    const getMerchantUser = (snapshot) => {
      return {
        _id: snapshot?.merchantId || null,
        name: 'System',
        email: '',
      };
    };

    const defaultHighRefundRateMessage =
      'High refund rate detected. Product may have sizing, quality, or expectation mismatch issues.';

    const defaultHighRefundProductMessage =
      'High refunded product detected. This product has an unusually high number of refunded units and should be reviewed.';

    for (const order of orders) {
      const lineItems = Array.isArray(order.lineItems) ? order.lineItems : [];
      const refunds = Array.isArray(order.refunds) ? order.refunds : [];

      for (const lineItem of lineItems) {
        const lineItemId = getLineItemId(lineItem);
        if (!lineItemId) continue;

        const snapshot = getSnapshotByLineItem(order, lineItem);

        const productId =
          lineItem.product_id || snapshot?.productId || 'unknown-product';

        const variantId =
          lineItem.variant_id || snapshot?.variantId || 'unknown-variant';

        const key = `${productId}-${variantId}`;

        const productName = getProductName(snapshot, lineItem);
        const variantTitle = getVariantTitle(snapshot, lineItem);

        const soldQty = Number(lineItem.quantity || 0);
        const price = Number(lineItem.price || snapshot?.variant?.price || 0);

        if (!productStatsMap.has(key)) {
          productStatsMap.set(key, {
            productId: String(productId),
            variantId: String(variantId),
            productName,
            variantTitle,
            merchantId: snapshot?.merchantId || null,

            totalSoldQty: 0,
            totalSoldAmount: 0,

            totalRefundedQty: 0,
            totalRefundedAmount: 0,
            refundOrders: new Set(),

            latestRefundAt: null,
            latestOrderId: null,

            latestRefundReason: '',
            refundReasons: new Set(),
          });
        }

        const stats = productStatsMap.get(key);

        stats.totalSoldQty += soldQty;
        stats.totalSoldAmount += soldQty * price;

        for (const refund of refunds) {
          const matchedRefundItems = (refund.refundItems || []).filter(
            (refundItem) => String(refundItem.lineItemId) === String(lineItemId)
          );

          if (!matchedRefundItems.length) continue;

          const refundReason = refund?.reason?.trim() || '';

          if (refundReason) {
            stats.refundReasons.add(refundReason);
          }

          for (const refundItem of matchedRefundItems) {
            stats.totalRefundedQty += Number(refundItem.quantity || 0);
            stats.totalRefundedAmount += Number(refundItem.amount || 0);
            stats.refundOrders.add(String(order.orderId));

            const refundedAt = refund.refundedAt || refund.createdAt;

            if (
              refundedAt &&
              (!stats.latestRefundAt ||
                new Date(refundedAt) > new Date(stats.latestRefundAt))
            ) {
              stats.latestRefundAt = refundedAt;
              stats.latestOrderId = order.orderId;
              stats.latestRefundReason = refundReason;
            }
          }
        }
      }

const orderCreatedAt = order.createdAt || order.created_at;

      if (orderCreatedAt && Array.isArray(order.fulfillments)) {
        for (const fulfillment of order.fulfillments) {
          const fulfilledAt =
            fulfillment.created_at ||
            fulfillment.createdAt ||
            fulfillment.processed_at;

          if (!fulfilledAt) continue;

          const diffMs =
            new Date(fulfilledAt).getTime() -
            new Date(orderCreatedAt).getTime();

          const diffDays = diffMs / (1000 * 60 * 60 * 24);

          if (diffDays > LATE_SHIPPING_DAYS) {
            operationalIssues.push({
              _id: `late_shipping-${order.orderId}-${fulfillment.id || fulfilledAt}`,
              type: 'late_shipping',
              message: `Order #${
                order.shopifyOrderNo || order.orderId
              } shipped late. Dispatch took ${diffDays.toFixed(1)} days.`,
              productId: null,
              orderId: String(order.orderId),
              referenceId: String(order.shopifyOrderNo || order.orderId),
              createdAt: fulfilledAt,
              meta: {
                daysToShip: Number(diffDays.toFixed(1)),
                thresholdDays: LATE_SHIPPING_DAYS,
                fulfillmentId: fulfillment.id || null,
              },
              user: {
                _id: null,
                name: 'System',
                email: '',
              },
            });
          }
        }
      }
for (const lineItem of lineItems) {
  const fulfilledAt = lineItem.fulfilledAt;

  if (!orderCreatedAt || !fulfilledAt) continue;

  const diffMs =
    new Date(fulfilledAt).getTime() -
    new Date(orderCreatedAt).getTime();

  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays > LATE_SHIPPING_DAYS) {
    const snapshot = getSnapshotByLineItem(order, lineItem);

    operationalIssues.push({
      _id: `late_shipping-${order.orderId}-${lineItem.id}`,
      type: 'late_shipping',
      message: `Order #${
        order.shopifyOrderNo || order.orderId
      } shipped late. Dispatch took ${diffDays.toFixed(1)} days.`,
      productId: String(lineItem.product_id || snapshot?.productId || ''),
      orderId: String(order.orderId),
      referenceId: String(order.shopifyOrderNo || order.orderId),
      createdAt: fulfilledAt,
      meta: {
        productName: getProductName(snapshot, lineItem),
        variantTitle: getVariantTitle(snapshot, lineItem),
        daysToShip: Number(diffDays.toFixed(1)),
        thresholdDays: LATE_SHIPPING_DAYS,
        orderCreatedAt,
        fulfilledAt,
        fulfilledQuantity: Number(lineItem.fulfilled_quantity || 0),
      },
      user: getMerchantUser(snapshot),
    });
  }
}
    }

    for (const stats of productStatsMap.values()) {
      if (stats.totalRefundedQty <= 0) continue;

      const refundRate =
        stats.totalSoldQty > 0
          ? (stats.totalRefundedQty / stats.totalSoldQty) * 100
          : 0;

      const latestRefundReason = stats.latestRefundReason?.trim() || '';

      const refundReasons = Array.from(stats.refundReasons || []).filter(
        Boolean
      );

      if (stats.totalRefundedQty >= HIGH_REFUND_QTY_THRESHOLD) {
        operationalIssues.push({
          _id: `high_refund_product-${stats.productId}-${stats.variantId}`,
          type: 'high_refund_product',

          message: latestRefundReason || defaultHighRefundProductMessage,

          productId: stats.productId,
          orderId: stats.latestOrderId ? String(stats.latestOrderId) : null,
          referenceId: stats.productId,
          createdAt: stats.latestRefundAt || new Date(),
          meta: {
            productName: stats.productName,
            variantTitle: stats.variantTitle,
            totalSoldQty: stats.totalSoldQty,
            totalRefundedQty: stats.totalRefundedQty,
            totalRefundedAmount: Number(stats.totalRefundedAmount.toFixed(2)),
            refundOrdersCount: stats.refundOrders.size,
            refundRate: Number(refundRate.toFixed(2)),

            refundReason: latestRefundReason,
            refundReasons,
            defaultMessage: defaultHighRefundProductMessage,
          },
          user: {
            _id: stats.merchantId,
            name: 'System',
            email: '',
          },
        });
      }

      if (refundRate >= HIGH_REFUND_RATE_THRESHOLD) {
        operationalIssues.push({
          _id: `high_refund_rate-${stats.productId}-${stats.variantId}`,
          type: 'high_refund_rate',

          message: latestRefundReason || defaultHighRefundRateMessage,

          productId: stats.productId,
          orderId: stats.latestOrderId ? String(stats.latestOrderId) : null,
          referenceId: stats.productId,
          createdAt: stats.latestRefundAt || new Date(),
          meta: {
            productName: stats.productName,
            variantTitle: stats.variantTitle,
            totalSoldQty: stats.totalSoldQty,
            totalRefundedQty: stats.totalRefundedQty,
            totalRefundedAmount: Number(stats.totalRefundedAmount.toFixed(2)),
            refundOrdersCount: stats.refundOrders.size,
            refundRate: Number(refundRate.toFixed(2)),

            refundReason: latestRefundReason,
            refundReasons,
            defaultMessage: defaultHighRefundRateMessage,
          },
          user: {
            _id: stats.merchantId,
            name: 'System',
            email: '',
          },
        });
      }
    }

    const mergedMap = new Map();

    [...savedAlerts, ...operationalIssues].forEach((item) => {
      const key = `${item.type}-${
        item.productId || item.orderId || item.referenceId || item._id
      }`;

      const existing = mergedMap.get(key);

      if (
        !existing ||
        new Date(item.createdAt) > new Date(existing.createdAt)
      ) {
        mergedMap.set(key, item);
      }
    });

    const finalAlerts = Array.from(mergedMap.values()).sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    return res.json({
      success: true,
      count: finalAlerts.length,
      savedAlertsCount: savedAlerts.length,
      computedIssuesCount: operationalIssues.length,
      data: finalAlerts,
    });
  } catch (err) {
    console.error('Error fetching operational alerts:', err);

    return res.status(500).json({
      success: false,
      message: 'Error fetching operational alerts',
      error: err.message,
    });
  }
};

// export const getUserAlerts = async (req, res) => {
  
//   try {
//     const userId = req.userId;

//     const alerts = await alertModel.aggregate([
//       {
//         $match: {
//           userId: new mongoose.Types.ObjectId(userId),
//         },
//       },
//       {
//         $sort: { createdAt: -1 },
//       },
//       {
//         $group: {
//           _id: {
//             productId: '$productId',
//             type: '$type',
//           },
//           doc: { $first: '$$ROOT' },
//         },
//       },
//       {
//         $replaceRoot: { newRoot: '$doc' },
//       },
//       {
//         $lookup: {
//           from: 'users',
//           localField: 'userId',
//           foreignField: '_id',
//           as: 'user',
//         },
//       },
//       {
//         $unwind: '$user',
//       },
//       {
//         $project: {
//           message: 1,
//           type: 1,
//           productId: 1,
//           createdAt: 1,
//           meta: 1,

//           user: {
//             _id: '$user._id',
//             name: {
//               $concat: ['$user.firstName', ' ', '$user.lastName'],
//             },
//             email: '$user.email',
//           },
//         },
//       },
//     ]);

//     res.json({
//       success: true,
//       count: alerts.length,
//       data: alerts,
//     });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: 'Error fetching user alerts' });
//   }
// };


export const getUserAlerts = async (req, res) => {
  try {
    const userId = req.userId;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID',
      });
    }

    const merchantObjectId = new mongoose.Types.ObjectId(userId);

    const HIGH_REFUND_RATE_THRESHOLD = 15;
    const HIGH_REFUND_QTY_THRESHOLD = 3;
    const LATE_SHIPPING_DAYS = 2;

    /* =====================================================
       1. SAVED ALERTS FROM alertModel FOR THIS USER
    ===================================================== */
    const savedAlerts = await alertModel.aggregate([
      {
        $match: {
          userId: merchantObjectId,
        },
      },
      {
        $sort: { createdAt: -1 },
      },
      {
        $group: {
          _id: {
            productId: '$productId',
            type: '$type',
          },
          doc: { $first: '$$ROOT' },
        },
      },
      {
        $replaceRoot: { newRoot: '$doc' },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
        },
      },
      {
        $unwind: {
          path: '$user',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          message: 1,
          type: 1,
          productId: 1,
          orderId: 1,
          referenceId: 1,
          createdAt: 1,
          meta: 1,

          user: {
            _id: '$user._id',
            name: {
              $trim: {
                input: {
                  $concat: [
                    { $ifNull: ['$user.firstName', ''] },
                    ' ',
                    { $ifNull: ['$user.lastName', ''] },
                  ],
                },
              },
            },
            email: '$user.email',
          },
        },
      },
    ]);

    /* =====================================================
       2. FETCH ORDERS
    ===================================================== */
    const orders = await orderModel.find({}).lean();

    const productStatsMap = new Map();
    const operationalIssues = [];

    const getLineItemId = (item) => {
      return item?.id || item?.lineItemId || item?.line_item_id || null;
    };

    const getSnapshotByLineItem = (order, lineItem) => {
      const snapshots = order.ProductSnapshot || [];

      return snapshots.find((snap) => {
        return (
          String(snap.variantId) === String(lineItem.variant_id) ||
          String(snap.productId) === String(lineItem.product_id)
        );
      });
    };

    const getProductName = (snapshot, lineItem) => {
      return (
        snapshot?.product?.title ||
        lineItem?.title ||
        lineItem?.name ||
        'Product'
      );
    };

    const getVariantTitle = (snapshot, lineItem) => {
      return snapshot?.variant?.title || lineItem?.variant_title || '';
    };

    const getMerchantUser = (snapshot) => {
      return {
        _id: snapshot?.merchantId || userId,
        name: 'System',
        email: '',
      };
    };

    const defaultHighRefundRateMessage =
      'High refund rate detected. Product may have sizing, quality, or expectation mismatch issues.';

    const defaultHighRefundProductMessage =
      'High refunded product detected. This product has an unusually high number of refunded units and should be reviewed.';

    /* =====================================================
       3. LOOP ORDERS BUT ONLY CURRENT MERCHANT ITEMS
    ===================================================== */
    for (const order of orders) {
      const lineItems = Array.isArray(order.lineItems) ? order.lineItems : [];
      const refunds = Array.isArray(order.refunds) ? order.refunds : [];
      const orderCreatedAt = order.createdAt || order.created_at;

      for (const lineItem of lineItems) {
        const lineItemId = getLineItemId(lineItem);
        if (!lineItemId) continue;

        const snapshot = getSnapshotByLineItem(order, lineItem);

        if (!snapshot) continue;

        const snapshotMerchantId = snapshot?.merchantId?.toString();

        if (snapshotMerchantId !== String(userId)) {
          continue;
        }

        const productId =
          lineItem.product_id || snapshot?.productId || 'unknown-product';

        const variantId =
          lineItem.variant_id || snapshot?.variantId || 'unknown-variant';

        const key = `${productId}-${variantId}`;

        const productName = getProductName(snapshot, lineItem);
        const variantTitle = getVariantTitle(snapshot, lineItem);

        const soldQty = Number(
          lineItem.original_quantity ||
            lineItem.current_quantity ||
            lineItem.quantity ||
            0
        );

        const price = Number(lineItem.price || snapshot?.variant?.price || 0);

        if (!productStatsMap.has(key)) {
          productStatsMap.set(key, {
            productId: String(productId),
            variantId: String(variantId),
            productName,
            variantTitle,
            merchantId: snapshot?.merchantId || userId,

            totalSoldQty: 0,
            totalSoldAmount: 0,

            totalRefundedQty: 0,
            totalRefundedAmount: 0,
            refundOrders: new Set(),

            latestRefundAt: null,
            latestOrderId: null,

            latestRefundReason: '',
            refundReasons: new Set(),
          });
        }

        const stats = productStatsMap.get(key);

        stats.totalSoldQty += soldQty;
        stats.totalSoldAmount += soldQty * price;

        /* =====================================================
           REFUND STATS FOR THIS LINE ITEM
        ===================================================== */
        for (const refund of refunds) {
          const matchedRefundItems = (refund.refundItems || []).filter(
            (refundItem) => String(refundItem.lineItemId) === String(lineItemId)
          );

          if (!matchedRefundItems.length) continue;

          const refundReason = refund?.reason?.trim() || '';

          if (refundReason) {
            stats.refundReasons.add(refundReason);
          }

          for (const refundItem of matchedRefundItems) {
            stats.totalRefundedQty += Number(refundItem.quantity || 0);
            stats.totalRefundedAmount += Number(refundItem.amount || 0);
            stats.refundOrders.add(String(order.orderId));

            const refundedAt = refund.refundedAt || refund.createdAt;

            if (
              refundedAt &&
              (!stats.latestRefundAt ||
                new Date(refundedAt) > new Date(stats.latestRefundAt))
            ) {
              stats.latestRefundAt = refundedAt;
              stats.latestOrderId = order.orderId;
              stats.latestRefundReason = refundReason;
            }
          }
        }

        /* =====================================================
           LATE SHIPPING FROM lineItem.fulfilledAt
        ===================================================== */
        const fulfilledAt = lineItem.fulfilledAt;

        if (orderCreatedAt && fulfilledAt) {
          const diffMs =
            new Date(fulfilledAt).getTime() -
            new Date(orderCreatedAt).getTime();

          const diffDays = diffMs / (1000 * 60 * 60 * 24);

          if (diffDays > LATE_SHIPPING_DAYS) {
            operationalIssues.push({
              _id: `late_shipping-${order.orderId}-${lineItem.id}`,
              type: 'late_shipping',
              message: `Order #${
                order.shopifyOrderNo || order.orderId
              } shipped late. Dispatch took ${diffDays.toFixed(1)} days.`,
              productId: String(lineItem.product_id || snapshot?.productId || ''),
              orderId: String(order.orderId),
              referenceId: String(order.shopifyOrderNo || order.orderId),
              createdAt: fulfilledAt,
              meta: {
                productName: getProductName(snapshot, lineItem),
                variantTitle: getVariantTitle(snapshot, lineItem),
                daysToShip: Number(diffDays.toFixed(1)),
                thresholdDays: LATE_SHIPPING_DAYS,
                orderCreatedAt,
                fulfilledAt,
                fulfilledQuantity: Number(lineItem.fulfilled_quantity || 0),
              },
              user: getMerchantUser(snapshot),
            });
          }
        }
      }

      /* =====================================================
         OPTIONAL: OLD order.fulfillments FALLBACK
         Only if fulfillment belongs to merchant is hard to know.
         Better to avoid this for merchant API because it may include
         other merchant items from same order.
      ===================================================== */
    }

    /* =====================================================
       4. HIGH REFUND PRODUCTS + HIGH REFUND RATE
    ===================================================== */
    for (const stats of productStatsMap.values()) {
      if (stats.totalRefundedQty <= 0) continue;

      const refundRate =
        stats.totalSoldQty > 0
          ? (stats.totalRefundedQty / stats.totalSoldQty) * 100
          : 0;

      const latestRefundReason = stats.latestRefundReason?.trim() || '';

      const refundReasons = Array.from(stats.refundReasons || []).filter(
        Boolean
      );

      if (stats.totalRefundedQty >= HIGH_REFUND_QTY_THRESHOLD) {
        operationalIssues.push({
          _id: `high_refund_product-${stats.productId}-${stats.variantId}`,
          type: 'high_refund_product',

          message: latestRefundReason || defaultHighRefundProductMessage,

          productId: stats.productId,
          orderId: stats.latestOrderId ? String(stats.latestOrderId) : null,
          referenceId: stats.productId,
          createdAt: stats.latestRefundAt || new Date(),
          meta: {
            productName: stats.productName,
            variantTitle: stats.variantTitle,
            totalSoldQty: stats.totalSoldQty,
            totalRefundedQty: stats.totalRefundedQty,
            totalRefundedAmount: Number(stats.totalRefundedAmount.toFixed(2)),
            refundOrdersCount: stats.refundOrders.size,
            refundRate: Number(refundRate.toFixed(2)),

            refundReason: latestRefundReason,
            refundReasons,
            defaultMessage: defaultHighRefundProductMessage,
          },
          user: {
            _id: stats.merchantId,
            name: 'System',
            email: '',
          },
        });
      }

      if (refundRate >= HIGH_REFUND_RATE_THRESHOLD) {
        operationalIssues.push({
          _id: `high_refund_rate-${stats.productId}-${stats.variantId}`,
          type: 'high_refund_rate',

          message: latestRefundReason || defaultHighRefundRateMessage,

          productId: stats.productId,
          orderId: stats.latestOrderId ? String(stats.latestOrderId) : null,
          referenceId: stats.productId,
          createdAt: stats.latestRefundAt || new Date(),
          meta: {
            productName: stats.productName,
            variantTitle: stats.variantTitle,
            totalSoldQty: stats.totalSoldQty,
            totalRefundedQty: stats.totalRefundedQty,
            totalRefundedAmount: Number(stats.totalRefundedAmount.toFixed(2)),
            refundOrdersCount: stats.refundOrders.size,
            refundRate: Number(refundRate.toFixed(2)),

            refundReason: latestRefundReason,
            refundReasons,
            defaultMessage: defaultHighRefundRateMessage,
          },
          user: {
            _id: stats.merchantId,
            name: 'System',
            email: '',
          },
        });
      }
    }

    /* =====================================================
       5. MERGE SAVED ALERTS + COMPUTED ISSUES
    ===================================================== */
    const mergedMap = new Map();

    [...savedAlerts, ...operationalIssues].forEach((item) => {
      const key = `${item.type}-${
        item.productId || item.orderId || item.referenceId || item._id
      }`;

      const existing = mergedMap.get(key);

      if (
        !existing ||
        new Date(item.createdAt) > new Date(existing.createdAt)
      ) {
        mergedMap.set(key, item);
      }
    });

    const finalAlerts = Array.from(mergedMap.values()).sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    return res.json({
      success: true,
      count: finalAlerts.length,
      savedAlertsCount: savedAlerts.length,
      computedIssuesCount: operationalIssues.length,
      data: finalAlerts,
    });
  } catch (err) {
    console.error('Error fetching user operational alerts:', err);

    return res.status(500).json({
      success: false,
      message: 'Error fetching user alerts',
      error: err.message,
    });
  }
};