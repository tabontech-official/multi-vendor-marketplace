import { authModel } from '../Models/auth.js';
import Stripe from 'stripe';
const stripe = new Stripe('your_stripe_secret_key');

export const createSubscription = async (req, res) => {
  const { userId, paymentMethodId, priceId } = req.body;

  try {
    const user = await authModel.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const customer = await stripe.customers.create({
      payment_method: paymentMethodId,
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId }],
      expand: ['latest_invoice.payment_intent'],
    });

    user.subscription.id = subscription.id;
    user.subscription.status = subscription.status;
    user.subscription.startDate = new Date(
      subscription.current_period_start * 1000
    );
    user.subscription.endDate = new Date(
      subscription.current_period_end * 1000
    );
    user.hasPaidSubscription = true;
    await user.save();

    res.json(subscription);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const checkSubscriptionValidity = async (req, res, next) => {
  const userId = req.user.id; // Assumes you are using authentication middleware to set req.user

  try {
    const user = await authModel.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.hasPaidSubscription && user.subscription) {
      const now = new Date();
      if (user.subscription.endDate > now) {
        return next(); // Subscription is valid, proceed to the next middleware or route handler
      } else {
        return res
          .status(403)
          .json({
            message: 'Subscription expired. Please renew your subscription.',
          });
      }
    } else {
      return res.status(403).json({ message: 'No active subscription found.' });
    }
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
