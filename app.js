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
import promoRouter from './Routes/promotion.js';
import consultationRouter from './Routes/consultation.js';
import apiCredentialsRouter from './Routes/apiCredentials.js';
import notificationRouter from './Routes/notification.js';
import { financeCron } from './controller/financeCron.js';
const app = express();
// Setup Swagger documentation
setupSwagger(app);
// Initialize MongoDB connection
Connect();
productSubscriptionExpiration();
// financeCron()
app.use(bodyParser.json()); // To handle JSON request bodies
app.use(bodyParser.urlencoded({ extended: true }));
app.use(morgan('combined'));
app.use(helmet());
app.use(compression());
// app.use(cors());
app.use(cors({
  origin: true, 
  credentials: true, 
}));

app.use('/uploads', express.static('uploads'));
app.use(express.json({limit:"5000000mb"}));
app.use('/auth', authRouter);
app.use('/product', productRouter);
app.use('/order', orderRouter);
app.use('/promo', promoRouter);
app.use('/consultation', consultationRouter);
app.use('/generateAcessKeys', apiCredentialsRouter);
app.use('/notifications', notificationRouter);


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
