import mongoose from 'mongoose';

const payoutConfigSchema = new mongoose.Schema({
  graceTime: Number, // in days
  payoutFrequency: {
    type: String,
    enum: ['daily', 'weekly', 'once', 'twice'],
    required: true,
  },
  firstPayoutDate: Date,
  secondPayoutDate: Date,
  weeklyDay: String,
});

export const PayoutConfig = mongoose.model('payout_configs', payoutConfigSchema);
