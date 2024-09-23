import { authModel } from "../Models/auth.js";
import { orderModel } from "../Models/order.js";
import { productModel } from "../Models/product.js";
import fetch from 'node-fetch';

export const createOrder = async (req, res) => {
    const orderData = req.body;
    console.log("Incoming order data:", JSON.stringify(orderData, null, 2));

    const { 
        customer_email, 
        customerName, 
        line_items, 
        shipping_address, 
        shipping_lines 
    } = orderData;

    // Validate required fields
    if (!customerName || !customer_email || !Array.isArray(line_items) || line_items.length === 0 || !orderData.id) {
        return res.status(400).send({ message: 'Customer name, email, line items, and order ID are required' });
    }

    if (!shipping_address || !shipping_address.first_name || !shipping_address.last_name || !shipping_address.address1) {
        return res.status(400).send({ message: 'Shipping address must include first name, last name, and address1' });
    }

    // Check line items structure
    for (const item of line_items) {
        if (!item.product_id || typeof item.quantity !== 'number' || !item.price) {
            return res.status(400).send({ message: 'Each line item must have valid product_id, quantity, and price' });
        }
    }

    try {
        const validItems = await Promise.all(line_items.map(async item => {
            const productData = await fetchProductData(item);
            return {
                productId: item.product_id.toString(),
                name: productData.name,
                quantity: item.quantity,
                price: parseFloat(item.price),
                sku: productData.sku,
                requiresShipping: productData.requires_shipping || true,
                taxable: productData.taxable || true,
                totalDiscount: 0, // Set if applicable
                totalDiscountSet: {
                    shopMoney: {
                        amount: 0,
                        currency_code: 'USD'
                    },
                    presentmentMoney: {
                        amount: 0,
                        currency_code: 'USD'
                    }
                },
                grams: productData.grams || 0,
            };
        }));
        
        const totalAmount = validItems.reduce((total, item) => total + item.price * item.quantity, 0);

        const newOrder = new orderModel({
            orderId: orderData.id.toString(),
            customerEmail: customer_email,
            customerName: customerName,
            items: validItems,
            totalAmount,
            shippingAddress: {
                firstName: shipping_address.first_name,
                lastName: shipping_address.last_name,
                address1: shipping_address.address1,
                address2: shipping_address.address2 || null,
                city: shipping_address.city,
                province: shipping_address.province,
                country: shipping_address.country,
                zip: shipping_address.zip,
                phone: shipping_address.phone,
                company: shipping_address.company,
                latitude: shipping_address.latitude || null,
                longitude: shipping_address.longitude || null,
            },
            shippingLines: shipping_lines.map(line => ({
                title: line.title,
                price: parseFloat(line.price),
                discountedPrice: parseFloat(line.discounted_price || line.price),
                discount: parseFloat(line.discount || 0),
                currentDiscountedPriceSet: {
                    shopMoney: {
                        amount: parseFloat(line.current_discounted_price_set?.shop_money?.amount || 0),
                        currency_code: 'USD'
                    },
                    presentmentMoney: {
                        amount: parseFloat(line.current_discounted_price_set?.presentment_money?.amount || 0),
                        currency_code: 'USD'
                    }
                },
                isRemoved: line.is_removed || false,
            })),
        });

        // Calculate subscription end date based on item quantities
        newOrder.subscriptionEndDate = new Date();
        validItems.forEach(item => {
            newOrder.subscriptionEndDate.setMonth(newOrder.subscriptionEndDate.getMonth() + item.quantity);
        });

        await newOrder.save();

        // Update inventory based on purchased items
        await Promise.all(validItems.map(item => updateInventory(item)));

        // Send response with order details
        res.status(201).send({
            message: 'Order saved successfully',
            orderId: newOrder.orderId,
            createdAt: newOrder.createdAt,
            subscriptionEndDate: newOrder.subscriptionEndDate,
            totalAmount,
            items: validItems,
            shippingAddress: newOrder.shippingAddress,
            shippingLines: newOrder.shippingLines,
        });
    } catch (error) {
        console.error('Error saving order:', error);
        res.status(500).send({ message: 'Error saving order', error: error.message });
    }
};

// Helper function to fetch product data



const fetchProductData = async (item) => {
    const shopifyApiKey = process.env.SHOPIFY_API_KEY;
    const shopifyPassword = process.env.SHOPIFY_ACCESS_TOKEN;
    const shopifyStore = process.env.SHOPIFY_STORE_URL;
    
    try {
        const response = await fetch(`https://${shopifyStore}/admin/api/2023-04/products/${item.product_id}.json`, {
            method: 'GET',
            headers: {
                'Authorization': `Basic ${Buffer.from(`${shopifyApiKey}:${shopifyPassword}`).toString('base64')}`,
            }
        });

        if (response.ok) {
            const data = await response.json();
            if (data.product) {
                return {
                    productId: item.product_id.toString(),
                    name: data.product.title,
                    quantity: item.quantity,
                    price: parseFloat(item.price),
                    sku: data.product.sku,
                    requiresShipping: data.product.requires_shipping || true,
                    taxable: data.product.taxable || true,
                    totalDiscount: 0,
                };
            }
        }
    } catch (error) {
        console.error(`Error fetching product ID ${item.product_id}: ${error.message}`);
    }
    throw new Error(`Product ID ${item.product_id} not found`);
};

const updateInventory = async (item) => {
    const product = await productModel.findOne({ shopifyId: item.productId });
    if (product) {
        product.inventory_quantity -= item.quantity;
        product.status = product.inventory_quantity > 0 ? 'active' : 'inactive';
        if (product.inventory_quantity === 0) {
            product.subscriptionEndDate = null;
        }
        await product.save();
    }
};






export const getOrderById = async (req, res) => {
    const { shopifyUserId } = req.params; // Get shopifyUserId from URL parameters

    if (!shopifyUserId) {
        return res.status(400).send({ message: 'Shopify User ID is required' });
    }

    try {
        // Fetch orders associated with the shopifyUserId
        const orders = await orderModel.find({ customerEmail: shopifyUserId });

        if (orders.length === 0) {
            return res.status(404).send({ message: 'No subscriptions found for this Shopify user' });
        }

        // Filter orders to return only subscription-related information
        const subscriptionData = orders.map(order => ({
            orderId: order.orderId,
            totalAmount: order.totalAmount,
            subscriptionEndDate: order.subscriptionEndDate,
            items: order.items,
            createdAt: order.createdAt,
        }));

        res.status(200).send({ message: 'Subscriptions fetched successfully', subscriptions: subscriptionData });
    } catch (error) {
        console.error('Error fetching subscriptions:', error);
        res.status(500).send({ message: 'Error fetching subscriptions', error: error.message });
    }
};


