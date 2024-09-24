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
      allowed_formats: ['jpg', 'png', 'jpeg','pdf'], // specify allowed formats
    },
  });
  
  export const upload = multer({ storage })
  