import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import bodyParser from 'body-parser';
import morgan from 'morgan';
import authRouter from './Routes/auth.js';
import productRouter from './Routes/product.js';
import Connect from './connection/connect.js'; // Import the Connect function

import setupSwagger from './swaggerConfig.js';

const app = express();
// Setup Swagger documentation
setupSwagger(app);
// Initialize MongoDB connection
Connect();
app.use(bodyParser.json()); // To handle JSON request bodies
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.raw({ type: 'application/json' }));

app.use(morgan('combined'));
app.use(helmet());
app.use(compression());
app.use(cors());
app.use('/uploads', express.static('uploads'));
app.use(express.json());
app.use('/auth', authRouter);
app.use('/product', productRouter);

app.get('/', (req, res) => {
  res.send('API is running...');
});

export default app;
