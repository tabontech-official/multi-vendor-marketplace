import crypto from 'crypto'

export function verifyShopifyWebhook(req, res, next) {
    // Extract the HMAC signature from the request headers
    const hmac = req.get('X-Shopify-Hmac-Sha256');
    console.log('Received HMAC:', hmac);
  
    // Secret from environment variables
    const secret = process.env.SHOPIFY_API_SECRET;
  
    if (!secret) {
      console.error('SHOPIFY_API_SECRET is not defined.');
      return res.status(500).send('Internal Server Error');
    }
  
    // Convert the request body to a JSON string
    const body = req.rawBody ? req.rawBody.toString() : JSON.stringify(req.body);
    console.log('Request Body:', body);
    // Compute the HMAC hash
    const computedHash = crypto
      .createHmac('sha256', secret)
      .update(body, 'utf8')
      .digest('base64');
    console.log('Computed HMAC:', computedHash);
  
    // Compare the computed HMAC with the received HMAC
    if (computedHash === hmac) {
      next(); // HMACs match, proceed to the next middleware or route handler
    } else {
      res.status(403).send('Forbidden'); // HMACs do not match, respond with a 403 status
    }
  }