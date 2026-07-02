const fs = require('fs');
const path = require('path');
const multer = require('multer');

function ensureDirectory(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true });
}

function createStorage(folderName) {
  const destination = path.join(__dirname, '..', 'uploads', folderName);
  ensureDirectory(destination);

  return multer.diskStorage({
    destination(_req, _file, callback) {
      callback(null, destination);
    },
    filename(_req, file, callback) {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const extension = path.extname(file.originalname);
      callback(null, `${path.basename(file.originalname, extension)}-${uniqueSuffix}${extension}`);
    },
  });
}

const productUpload = multer({
  storage: createStorage('products'),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(_req, file, callback) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      return callback(null, true);
    }
    return callback(new Error('Only JPEG, PNG, and WEBP images are allowed'));
  },
});

const receiptUpload = multer({
  storage: createStorage('receipts'),
  limits: { fileSize: 10 * 1024 * 1024 },
});

module.exports = {
  productUpload,
  receiptUpload,
};