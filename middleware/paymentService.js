// paymentService.js
import Stripe from 'stripe'; // Replace with your actual Stripe secret key

const stripe = Stripe('your_stripe_secret_key');
export const processPayment = async (paymentDetails) => {
  try {
    const { amount, currency, paymentMethodId } = paymentDetails;

    // Create a payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      payment_method: paymentMethodId,
      confirm: true,
    });

    return {
      success: true,
      subscriptionId: paymentIntent.id, // Use the payment intent ID
    };
  } catch (error) {
    console.error('Payment error:', error);
    return { success: false };
  }
};


