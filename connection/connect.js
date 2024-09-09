import chalk from 'chalk';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const { cyan, yellow, red } = chalk;

const connected = cyan;
const error = yellow;
const disconnected = red;

const Connect = () => {
  mongoose.connect(process.env.DB_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 50000, // Optional: increase timeout
  });

  mongoose.connection.on('connected', () => {
    console.log(connected('MongoDB connected'));
  });

  mongoose.connection.on('error', (err) => {
    console.error(error('MongoDB connection error:'), err);
  });

  mongoose.connection.on('disconnected', () => {
    console.log(disconnected('MongoDB disconnected'));
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    await mongoose.connection.close();
    console.log(disconnected('MongoDB disconnected due to app termination'));
    process.exit(0);
  });
};

export default Connect;
