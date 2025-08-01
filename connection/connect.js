// import chalk from 'chalk';
// import dotenv from 'dotenv';
// import mongoose from 'mongoose';

// dotenv.config();

// const { cyan, yellow, red } = chalk;

// const connected = cyan;
// const error = yellow;
// const disconnected = red;

// // const Connect = () => {
// //   mongoose.connect(process.env.DB_URL, {

// //   });
// const Connect = () => {
//   mongoose.connect("mongodb+srv://multivendor:test123@cluster0.k1cc1.mongodb.net", {
//     useNewUrlParser: true,
//     useUnifiedTopology: true,
//     serverSelectionTimeoutMS: 10000, // 10 seconds timeout
//   });
//   mongoose.connection.on('connected', () => {
//     console.log(connected('MongoDB connected'));
//   });

//   mongoose.connection.on('error', (err) => {
//     console.error(error('MongoDB connection error:'), err);
//   });

//   mongoose.connection.on('disconnected', () => {
//     console.log(disconnected('MongoDB disconnected'));
//   });

//   // Graceful shutdown
//   process.on('SIGINT', async () => {
//     await mongoose.connection.close();
//     console.log(disconnected('MongoDB disconnected due to app termination'));
//     process.exit(0);
//   });
// };

// export default Connect;


import chalk from 'chalk';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const { cyan, yellow, red } = chalk;

let isConnected = false;

const Connect = async () => {
  if (isConnected) {
    console.log(cyan('✅ MongoDB already connected, reusing connection.'));
    return;
  }

  try {
    const conn = await mongoose.connect(process.env.DB_URL || "mongodb+srv://multivendor:test123@cluster0.k1cc1.mongodb.net", {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000,
    });

    isConnected = true;
    console.log(cyan('✅ MongoDB connected to:'), conn.connection.host);

    mongoose.connection.on('disconnected', () => {
      console.log(red('MongoDB disconnected'));
      isConnected = false;
    });

    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log(red('MongoDB disconnected due to app termination'));
      process.exit(0);
    });

  } catch (err) {
    console.error(yellow('❌ MongoDB connection error:'), err);
  }
};

export default Connect;
