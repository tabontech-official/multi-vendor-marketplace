// import multer from 'multer';
// import path from 'path';
// import fs from 'fs';

// const ensureDirectoryExists = (directory) => {
//   if (!fs.existsSync(directory)) {
//     fs.mkdirSync(directory, { recursive: true });
//   }
// };

// // Set up storage for files
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     const uploadPath = 'uploads/pdfs/';
//     ensureDirectoryExists(uploadPath); 
//     cb(null, uploadPath);
//   },
//   filename: (req, file, cb) => {
//     const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
//     cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
//   },
// });

// const pdfFilter = (req, file, cb) => {
//   if (file.mimetype === 'application/pdf') {
//     cb(null, true);
//   } else {
//     cb(new Error('Only PDF files are allowed'), false);
//   }
// };

// const pdfUpload = multer({
//   storage,
//   fileFilter: pdfFilter,
// });

// export default pdfUpload;

import multer from 'multer';
import path from 'path';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Make sure this folder exists
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  },
});

export const Csvuplaods = multer({
  storage,
  limits: { fileSize: 30 * 1024 * 1024 },
}).single('file'); // Use .single if only uploading CSV
