import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from 'cloudinary';
import multer from 'multer';


// cloudinary.v2.config({
//     cloud_name: 'djocrwprs', 
//     api_key: '433555789235653',
//     api_secret: 'YuzeR8ryVZNJ2jPowPxPb3YXWvY', 
//   });
 
cloudinary.v2.config({
  cloud_name: 'dt2fvngtp', 
  api_key: '331996837589612',
  api_secret: 'xNC1A5jDlmrfAx3TuAvyf-LFmG4', 
});


const storage = new CloudinaryStorage({
    cloudinary: cloudinary.v2,
    params: {
      folder: 'uploads',
      allowed_formats: ['jpg', 'png', 'jpeg','pdf','doc','docx','ppt','csv'],
      resource_type: 'raw'
    },
  });
  
  // export const upload = multer({ storage })
  const upload = multer({
    storage,
    limits: {
      fileSize: 30 * 1024 * 1024, 
    },
  });
    

export  const cpUpload = upload.fields([{ name: 'images', maxCount: 10 }, { name: 'image', maxCount: 10 } ,{name:'file',maxCount:10},{ name: 'variantImages', maxCount: 10 },{ name: 'files', maxCount: 10 }])


