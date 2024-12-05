// const storage = multer.diskStorage({
//     destination: (req, file, cb) => {
//       cb(null, 'uploads/'); // Folder where images will be stored
//     },
//     filename: (req, file, cb) => {
//       cb(null, Date.now() + path.extname(file.originalname)); // Unique filename
//     },
//   });
  
// export const upload = multer({ storage });
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from 'cloudinary';
import multer from 'multer';
import sharp from 'sharp';

cloudinary.v2.config({
  cloud_name: 'djocrwprs', // replace with your Cloudinary cloud name
  api_key: '433555789235653', // replace with your Cloudinary API key
  api_secret: 'YuzeR8ryVZNJ2jPowPxPb3YXWvY', // replace with your Cloudinary API secret
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary.v2,
  params: {
    folder: 'uploads', // specify the folder where images will be uploaded
    allowed_formats: ['jpg', 'png', 'jpeg', 'pdf', 'doc', 'docx', 'ppt'], // specify allowed formats
  },
});

// Initialize multer with Cloudinary storage
const upload = multer({
  storage,
  limits: {
    fileSize: 30 * 1024 * 1024, // 30 MB limit per file
  },
});

// Check and optimize the image before uploading to Cloudinary
const cpUpload = upload.fields([{ name: 'images', maxCount: 10 }, { name: 'image', maxCount: 10 }, { name: 'files', maxCount: 10 }]);

const optimizeImageBeforeUpload = (req, res, next) => {
  if (req.files && req.files.images) {
    // Loop through each file and optimize if needed
    const imageFiles = req.files.images;

    Promise.all(
      imageFiles.map(async (file) => {
        const imageBuffer = file.buffer;

        // Check the file size (for optimization threshold, e.g., 1 MB)
        const originalSize = file.size; // Size in bytes
        const threshold = 1 * 1024 * 1024; // 1 MB

        if (originalSize > threshold) {
          console.log(`Optimizing image of size ${originalSize} bytes`);

          // Resize and compress the image using sharp
          const optimizedImageBuffer = await sharp(imageBuffer)
            .resize({ width: 1024 }) // Resize to a width of 1024px
            .jpeg({ quality: 80 }) // Compress the image to 80% quality
            .toBuffer();

          // Replace the original file buffer with the optimized one
          file.buffer = optimizedImageBuffer;
        }
      })
    )
      .then(() => {
        next(); // Proceed to the upload
      })
      .catch((error) => {
        console.error('Error optimizing images:', error);
        res.status(500).json({ error: 'Failed to optimize image(s)' });
      });
  } else {
    next(); // No images to optimize, proceed to upload
  }
};

// Combine both middlewares: first optimize images, then upload to Cloudinary
export const uploadImage = [optimizeImageBeforeUpload, cpUpload];
