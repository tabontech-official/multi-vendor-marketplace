import multer from 'multer';
import path from 'path';

// Set up storage for uploaded files
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // Ensure this directory exists
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}_${path.basename(file.originalname)}`);
  },
});

// Initialize multer with storage configuration
const upload = multer({ storage: storage });

export default upload;
