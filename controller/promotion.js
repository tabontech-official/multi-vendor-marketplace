import { PromoModel } from '../Models/Promotions.js';
import { listingModel } from '../Models/Listing.js';
import { authModel } from '../Models/auth.js';

export const addPromotion = async (req, res) => {
  try {
    const {
      promoName,
      startDate,
      endDate,
      productSku,
      promoPrice,
      status,
      userId,
    } = req.body;

    const product = await listingModel.findOne({ 'variants.sku': productSku });

    if (!product) {
      return res
        .status(404)
        .json({ message: 'Product with this SKU not found.' });
    }

    const variant = product.variants.find((v) => v.sku === productSku);

    const userRole = await authModel.findById(userId);
    const createdRole = userRole.role;

    const newPromotion = new PromoModel({
      promoName,
      startDate,
      endDate,
      productSku,
      promoPrice,
      status,
      productName: product.title || '',
      currentStock: variant?.inventory_quantity?.toString() || '0',
      currentPrice: variant.price,
      userId,
      createdRole,
    });

    await newPromotion.save();

    product.promoPrice = promoPrice;
    await product.save();

    res
      .status(201)
      .json({ message: 'Promotion added and product updated successfully.' });
  } catch (error) {
    console.error('Error in addPromotion:', error);
    res.status(500).json({ message: 'Server error while adding promotion.' });
  }
};

export const getAllPromotions = async (req, res) => {
  try {
    const result = await PromoModel.find();
    res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching promotions:', error);
    res.status(500).json({ message: 'Failed to fetch promotions.' });
  }
};

export const deletePromotion = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedData = await PromoModel.findByIdAndDelete(id);

    if (!deletedData) {
      return res.status(404).json({ message: 'Promotion not found.' });
    }

    res.status(200).json({ message: 'Promotion deleted successfully.' });
  } catch (error) {
    console.error('Error deleting promotion:', error);
    res.status(500).json({ message: 'Server error while deleting promotion.' });
  }
};

export const addPromotionDataFromProductDb = async (req, res) => {
  try {
    const { id } = req.params;
    const { promoPrice, startDate, endDate, userId } = req.body;

    const product = await listingModel.findById(id);
    if (!product) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    const variant = product.variants?.[0];
    if (!variant) {
      return res
        .status(400)
        .json({ message: 'No variants found for this product.' });
    }
    const user = await authModel.findById(userId);
    const createdRole = user.role;

    const result = new PromoModel({
      promoPrice,
      productName: product.title,
      productSku: variant.sku,
      currentStock: variant.inventory_quantity,
      currentPrice: variant.price,
      startDate,
      endDate,
      status: 'active',
      createdRole,
      userId,
    });

    await result.save();

    res
      .status(201)
      .json({ message: 'Promotion created successfully.', data: result });
  } catch (error) {
    console.error('Error in addPromotionDataFromProductDb:', error);
    res.status(500).json({ message: 'Server error while creating promotion.' });
  }
};
