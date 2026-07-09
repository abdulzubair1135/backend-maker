const multer = require('multer');
const path = require('path');
const fs = require('fs');

const UPLOADS_DIR = path.join(__dirname, '..', '..', 'Uploads');

// Auto Folder Creation
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Storage setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    // Unique File Name (timestamp + original name clean)
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const cleanName = file.originalname.replace(/[^a-z0-9._-]/gi, '_');
    cb(null, uniqueSuffix + '-' + cleanName);
  }
});

// File filter (extensions check)
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    // Images
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg',
    // Videos
    '.mp4', '.mkv', '.webm', '.avi',
    // Documents
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt'
  ];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Arre bhai, ${ext} file type allowed nahi hai!`), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // Maximum Size Validation: 50MB
  }
});

module.exports = upload;
