import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import bodyParser from 'body-parser';
import morgan from 'morgan';
import authRouter from './Routes/auth.js';
import productRouter from './Routes/product.js';
import orderRouter from './Routes/order.js';
import Connect from './connection/connect.js'; // Import the Connect function
import setupSwagger from './swaggerConfig.js';
import { productSubscriptionExpiration } from './controller/scheduleFunction.js';

const app = express();
// Setup Swagger documentation
setupSwagger(app);
// Initialize MongoDB connection
Connect();
productSubscriptionExpiration();
app.use(bodyParser.json()); // To handle JSON request bodies
app.use(bodyParser.urlencoded({ extended: true }));
app.use(morgan('combined'));
app.use(helmet());
app.use(compression());
// app.use(cors());
app.use(cors({
  origin: true, // Allow all origins
  credentials: true, // Allow cookies if needed
}));

app.use('/uploads', express.static('uploads'));
app.use(express.json({limit:"5000000mb"}));
app.use('/auth', authRouter);
app.use('/product', productRouter);
app.use('/order', orderRouter);
app.use((req, res, next) => {
  res.setTimeout(300000, () => {  // 300000 ms = 5 minutes
    res.status(504).send('Request timed out');
  });
  next();
});
app.get('/', (req, res) => {
  res.send('API is running...')
});

export default app;


// {
//   "version": 2,
//   "builds": [{ "src": "app.js", "use": "@vercel/node" }],
//   "routes": [{ "src": "/(.*)", "dest": "/app.js" }]
// }
