import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from 'cloudinary';
import multer from 'multer';


cloudinary.v2.config({
    cloud_name: 'djocrwprs', // replace with your Cloudinary cloud name
    api_key: '433555789235653', // replace with your Cloudinary API key
    api_secret: 'YuzeR8ryVZNJ2jPowPxPb3YXWvY', // replace with your Cloudinary API secret
  });
 
  const storage = new CloudinaryStorage({
    cloudinary: cloudinary.v2,
    params: {
      folder: 'uploads', // specify the folder where images will be uploaded
      allowed_formats: ['jpg', 'png', 'jpeg','pdf','doc','docx','ppt',], // specify allowed formats
    },
  });
  
  // export const upload = multer({ storage })
  const upload = multer({
    storage,
    limits: {
      fileSize: 30 * 1024 * 1024, // 10 MB limit per file
    },
  });
    

export  const cpUpload = upload.fields([{ name: 'images', maxCount: 10 }, { name: 'image', maxCount: 10 } ,{name:'files',maxCount:10}])


// import { CloudinaryStorage } from 'multer-storage-cloudinary';
// import cloudinary from 'cloudinary';
// import multer from 'multer';

// cloudinary.v2.config({
//   cloud_name: 'djocrwprs', // replace with your Cloudinary cloud name
//   api_key: '433555789235653', // replace with your Cloudinary API key
//   api_secret: 'YuzeR8ryVZNJ2jPowPxPb3YXWvY', // replace with your Cloudinary API secret
// });

// const storage = new CloudinaryStorage({
//   cloudinary: cloudinary.v2,
//   params: {
//     folder: 'uploads', // specify the folder where images will be uploaded
//     allowed_formats: ['jpg', 'png', 'jpeg', 'pdf', 'doc', 'docx', 'ppt'], // specify allowed formats
//     transformation: [
//       {
//         quality: 'auto', // Auto compress based on Cloudinary's algorithm
//         fetch_format: 'auto', // Automatically choose the best format (e.g., WebP)
//         width: 2000, // Resize to a specific width (adjust to your needs)
//         height: 2000, // Resize to a specific height (adjust to your needs)
//         crop: 'limit', // Ensure the image is cropped within the defined width and height
//       },
//     ],
//   },
// });

// const upload = multer({
//   storage,
//   limits: {
//     fileSize: 100 * 1024 * 1024, // 100 MB limit per file before upload
//   },
// });

// export const cpUpload = upload.fields([
//   { name: 'images', maxCount: 10 },
//   { name: 'image', maxCount: 10 },
//   { name: 'files', maxCount: 10 },
// ]);
