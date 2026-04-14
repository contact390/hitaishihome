// Server Configuration
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const fs = require('fs');
require('dotenv').config();

// Import Routes
const registerRoutes = require('./routes/register');
const dashboardRoutes = require('./routes/dashboard');
const contactRoutes = require('./routes/contact');
const newPropertiesRoutes = require('./routes/newproperties');
const buyRoutes = require('./routes/buy');
const rentRoutes = require('./routes/rent');
const examplecontactRoutes = require('./routes/examplecontact');



const app = express();
const PORT = process.env.PORT || 5003;
const JWT_SECRET = process.env.JWT_SECRET || 'default_secret_key';

// -------------------------------------------------------------------------
// ✅ FIX: Define uploadsDir BEFORE using it
// -------------------------------------------------------------------------
const uploadsDir = path.join(__dirname, 'uploads');

// Create uploads folder if missing
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('📁 uploads folder created');
}

// Serve uploads folder publicly
app.use('/uploads', express.static(uploadsDir));
// -------------------------------------------------------------------------

// Multer File Upload Config (for routes using upload)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    cb(null, `${timestamp}-${random}-${file.originalname}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'), false);
  }
});

// CORS + Body Parser
app.use(cors({ origin: '*', methods: ['GET','POST','PUT','DELETE'] }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname)));

// -------------------------------------------------------------------------
// JWT Verification Middleware
// -------------------------------------------------------------------------
const verifyToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1] || req.query.token;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

// Make utilities usable inside routes
app.locals.JWT_SECRET = JWT_SECRET;
app.locals.verifyToken = verifyToken;
app.locals.upload = upload;

// -------------------------------------------------------------------------
// Health Check
// -------------------------------------------------------------------------
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running', timestamp: new Date() });
});

// -------------------------------------------------------------------------
// Register Routes
// -------------------------------------------------------------------------
app.use('/api', registerRoutes);
app.use('/api', dashboardRoutes);
app.use('/api', contactRoutes);
app.use('/api', newPropertiesRoutes);
app.use('/api', buyRoutes);
app.use('/api', rentRoutes);
app.use('/api', examplecontactRoutes);

// Fallback /api/get endpoints for Buy.html
app.get('/api/get/properties_re', async (req, res) => {
  try {
    const [rows] = await require('./db').query('SELECT * FROM property_listings ORDER BY createdAt DESC');
    res.json({ success: true, properties: rows });
  } catch (err) {
    console.error('GET /api/get/properties_re error:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.get('/api/get/filters_re', async (req, res) => {
  try {
    const [rows] = await require('./db').query('SELECT DISTINCT propertyType, city FROM property_listings');
    const types = Array.from(new Set(rows.map(r => r.propertyType).filter(Boolean))).sort();
    const cities = Array.from(new Set(rows.map(r => r.city).filter(Boolean))).sort();
    const priceRanges = ['< 10 Lakh', '10-25 Lakh', '25-50 Lakh', '50-100 Lakh', '> 100 Lakh'];
    const ageRanges = ['New', '1-5 years', '5-10 years', '10+ years'];
    res.json({ success: true, types, cities, priceRanges, ageRanges });
  } catch (err) {
    console.error('GET /api/get/filters_re error:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// -------------------------------------------------------------------------
// Error Handler
// -------------------------------------------------------------------------
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: err.message
  });
});

// -------------------------------------------------------------------------
// Start Server
// -------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
