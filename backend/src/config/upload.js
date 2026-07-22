const multer = require('multer');
const path = require('path');
const fs = require('fs');

const os = require('os');

const isVercel = !!process.env.VERCEL;
const isAzure = !!process.env.WEBSITE_INSTANCE_ID;

let uploadDir;
if (process.env.STORAGE_PATH) {
  uploadDir = process.env.STORAGE_PATH;
} else if (isAzure) {
  uploadDir = path.join(process.env.HOME || '/home', 'site_uploads');
} else if (isVercel) {
  uploadDir = os.tmpdir();
} else {
  uploadDir = path.join(__dirname, '../../uploads');
}

if (!fs.existsSync(uploadDir)) {
  try {
    fs.mkdirSync(uploadDir, { recursive: true });
  } catch (err) {
    console.error("Failed to create upload directory:", err);
  }
}

// Local storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate a unique filename: timestamp-originalName
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

// File filter (optional: limit to images/pdfs)
const fileFilter = (req, file, cb) => {
  const allowedMimes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF and Images are allowed.'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

module.exports = upload;
