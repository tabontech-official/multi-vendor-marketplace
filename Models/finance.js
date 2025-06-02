import mongoose from 'mongoose';

const payoutConfigSchema = new mongoose.Schema(
  {
    firstPayoutDate: {
      type: Date,
      required: true,
    },
    secondPayoutDate: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export const PayoutConfig = mongoose.model('payout_configs', payoutConfigSchema);
