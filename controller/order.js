import { authModel } from "../Models/auth.js";
import { orderModel } from "../Models/order.js";
import axios from 'axios'

// export const createOrder = async (req, res) => {
//     const orderData = req.body;
//     console.log("Incoming order data:", JSON.stringify(orderData, null, 2));

//     const { customer_email, customerName, line_items, shipping_address, shipping_lines } = orderData;

//     // Validate required fields
//     if (!customerName || !customer_email || !Array.isArray(line_items) || line_items.length === 0 || !orderData.id) {
//         return res.status(400).send({ message: 'Customer name, email, line items, and order ID are required' });
//     }

//     // Check if line items have correct structure
//     for (const item of line_items) {
//         if (!item.product_id || typeof item.quantity !== 'number') {
//             return res.status(400).send({ message: 'Each line item must have a valid product_id and quantity' });
//         }
//     }

//     try {
//         const productIds = line_items.map(item => item.product_id.toString());
//         const validItems = [];

//         const shopifyApiKey = process.env.SHOPIFY_API_KEY;
//         const shopifyPassword = process.env.SHOPIFY_ACCESS_TOKEN;
//         const shopifyStore = process.env.SHOPIFY_STORE_URL;

//         for (const productId of productIds) {
//             try {
//                 const response = await fetch(`https://${shopifyStore}/admin/api/2023-04/products/${productId}.json`, {
//                     method: 'GET',
//                     headers: {
//                         'Authorization': `Basic ${Buffer.from(`${shopifyApiKey}:${shopifyPassword}`).toString('base64')}`,
//                     }
//                 });

//                 if (response.ok) {
//                     const data = await response.json();
//                     if (data.product) {
//                         const item = line_items.find(item => item.product_id.toString() === productId);
//                         validItems.push({
//                             productId: productId,
//                             name: data.product.title, // Fetching product name
//                             quantity: item.quantity,
//                             price: parseFloat(item.price),
//                             sku: data.product.variants[0].sku || null, // SKU from the first variant
//                             // Add more fields as necessary
//                         });
//                     }
//                 } else {
//                     console.error(`Product ID ${productId} not found: ${response.statusText}`);
//                 }
//             } catch (error) {
//                 console.error(`Error fetching product ID ${productId}: ${error.message}`);
//             }
//         }

//         if (validItems.length === 0) {
//             return res.status(400).send({ message: 'No valid product IDs found in Shopify' });
//         }

//         const totalAmount = validItems.reduce((total, item) => total + item.price * item.quantity, 0);

//         const newOrder = new orderModel({
//             orderId: orderData.id.toString(),
//             customerEmail: customer_email,
//             customerName: customerName,
//             items: validItems,
//             totalAmount,
//             shippingAddress: {
//                 firstName: shipping_address.first_name,
//                 lastName: shipping_address.last_name,
//                 address1: shipping_address.address1,
//                 address2: shipping_address.address2 || null,
//                 city: shipping_address.city,
//                 province: shipping_address.province,
//                 country: shipping_address.country,
//                 zip: shipping_address.zip,
//                 phone: shipping_address.phone,
//                 company: shipping_address.company,
//                 latitude: shipping_address.latitude || null,
//                 longitude: shipping_address.longitude || null,
//             },
//             shippingLines: shipping_lines.map(line => ({
//                 title: line.title,
//                 price: parseFloat(line.price),
//                 discountedPrice: parseFloat(line.discounted_price || line.price),
//                 discount: parseFloat(line.discount || 0),
//                 currentDiscountedPriceSet: {
//                     shopMoney: {
//                         amount: parseFloat(line.current_discounted_price_set?.shop_money?.amount || 0),
//                         currency_code: 'USD'
//                     },
//                     presentmentMoney: {
//                         amount: parseFloat(line.current_discounted_price_set?.presentment_money?.amount || 0),
//                         currency_code: 'USD'
//                     }
//                 },
//                 isRemoved: line.is_removed || false,
//                 carrierIdentifier: line.carrier_identifier || null,
//                 code: line.code || null
//             })),
//             // Add any other fields you want to set
//         });

//         // Calculate subscription end date based on item quantities
//         newOrder.subscriptionEndDate = new Date();
//         validItems.forEach(item => {
//             if (item.quantity > 0) {
//                 newOrder.subscriptionEndDate.setMonth(newOrder.subscriptionEndDate.getMonth() + item.quantity);
//             }
//         });

//         await newOrder.save();

//         // Update inventory based on purchased items
//         for (const item of validItems) {
//             const product = await productModel.findOne({ shopifyId: item.productId });
//             if (product) {
//                 product.inventory_quantity -= item.quantity;
//                 product.status = product.inventory_quantity > 0 ? 'active' : 'inactive';
//                 if (product.inventory_quantity === 0) {
//                     product.subscriptionEndDate = null;
//                 }
//                 await product.save();
//             }
//         }

//         // Send response with order details
//         res.status(201).send({
//             message: 'Order saved successfully',
//             orderId: newOrder.orderId,
//             createdAt: newOrder.createdAt,
//             subscriptionEndDate: newOrder.subscriptionEndDate,
//             totalAmount: totalAmount,
//             items: validItems,
//         });
//     } catch (error) {
//         console.error('Error saving order:', error);
//         res.status(500).send({ message: 'Error saving order', error: error.message });
//     }
// };

async function checkProductExists(productId) {
    const url = `https://${process.env.SHOPIFY_API_KEY}:${process.env.SHOPIFY_ACCESS_TOKEN}@${process.env.SHOPIFY_STORE_URL}/admin/api/2023-01/products/${productId}.json`;
    
    try {
      const response = await axios.get(url);
      return response.data.product ? true : false;
    } catch (error) {
      console.error('Error checking product existence:', error);
      return false; // Product doesn't exist or an error occurred
    }
  }

  export const createOrder = async (req, res) => {
    try {
      const orderData = req.body;
      const productId = orderData.line_items[0].product_id; // Assuming single product per order
  
      // Check if product exists in Shopify
      const productExists = await checkProductExists(productId);
      if (!productExists) {
        return res.status(404).send('Product does not exist');
      }
  
      // Calculate expiration date based on quantity
      const quantity = orderData.line_items[0].quantity;
      const expirationDate = new Date();
      expirationDate.setMonth(expirationDate.getMonth() + quantity); // Extend by quantity months
  
      // Save order to MongoDB
      const order = new orderModel({
        orderId: orderData.id,
        customer: orderData.customer,
        lineItems: orderData.line_items,
        createdAt: orderData.created_at,
        expiresAt: expirationDate, // Add expiration date field
      });
  
      await order.save();
  
      // Find user by email
      const user = await authModel.findOne({ email: orderData.customer.email });
      if (!user) {
        return res.status(404).send('User not found');
      }
  
      // Update user's subscription
      if (user.subscription) {
        user.subscription.quantity = (user.subscription.quantity || 0) + quantity; // Add to existing quantity
        user.subscription.expiresAt = expirationDate; // Update the expiration date
      } else {
        user.subscription = {
          quantity,
          expiresAt: expirationDate, // Set expiration date if subscription doesn't exist
        };
      }
  
      await user.save(); // Save the updated user
  
      // Respond with order details including expiresAt
      res.status(200).json({
        message: 'Order saved and user updated',
        expiresAt: expirationDate,
        orderId: orderData.id
      });
    } catch (error) {
      console.error('Error saving order:', error);
      res.status(500).send('Error saving order');
    }
  };
  
  

export const getOrderById = async (req, res) => {
    const { email } = req.params; // Get the email from the request parameters

    try {
        // Use find to fetch all orders associated with the provided email
        const orders = await orderModel.find({ 'customer.email': email }); // Adjusted to match the structure

        if (orders.length > 0) {
            res.status(200).send({
                message: 'Successfully fetched orders',
                data: orders
            });
        } else {
            res.status(404).send({ message: 'No orders found for this email' });
        }
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).send({ message: 'Error fetching orders' });
    }
};


export const deleteUser=async(req,res)=>{
  orderModel.deleteMany().then(result=>{
    if(result){
      res.status(200).send('delted')
    }
  })
}