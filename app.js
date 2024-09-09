import compression from 'compression';
import cors from 'cors';
import express, { Router } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import router from './Routes/router.js'
import Connect from './connection/connect.js'; // Import the Connect function

import setupSwagger from './swaggerConfig.js';

const app = express();
// Setup Swagger documentation
setupSwagger(app);
// Initialize MongoDB connection
Connect();

app.use(morgan('combined'));
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json());
app.use('/auth',router.auth)
app.get('/', (req, res) => {
  res.send('API is running...');
});

export default app;
