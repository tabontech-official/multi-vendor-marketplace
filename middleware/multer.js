import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Ensure the directory exists
const ensureDirectoryExists = (directory) => {
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
};

// Set up storage for files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = 'uploads/pdfs/'; // Directory to store PDF files
    ensureDirectoryExists(uploadPath); // Ensure the directory exists
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

// Filter to allow only PDF files
const pdfFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed'), false);
  }
};

// Multer instance
const pdfUpload = multer({
  storage,
  fileFilter: pdfFilter,
});

export default pdfUpload;

