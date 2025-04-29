import multer from 'multer';

const storage = multer.memoryStorage();

export const Csvuplaods = multer({
  storage,
  limits: { fileSize: 30 * 1024 * 1024 },
}).single('file');
