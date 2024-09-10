import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import bodyParser from 'body-parser';
import morgan from 'morgan';
import authRouter from './Routes/auth.js';
import productRouter from './Routes/product.js';
console.log('Importing router from:', './Routes/router.js');

import Connect from './connection/connect.js'; // Import the Connect function

import setupSwagger from './swaggerConfig.js';

const app = express();
// Setup Swagger documentation
setupSwagger(app);
// Initialize MongoDB connection
Connect();
app.use(bodyParser.json()); // To handle JSON request bodies
app.use(bodyParser.urlencoded({ extended: true }))
app.use(morgan('combined'));
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json());
app.use('/auth',authRouter)
app.use('/product',productRouter)
app.get('/', (req, res) => {
  res.send('API is running...');
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Set up storage for multer
const uploadsDir = join(__dirname, 'uploads');

// Create the uploads directory if it doesn't exist
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}
export default app;
