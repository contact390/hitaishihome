// Dashboard Routes for properties, interests, profile
const express = require('express');
const router = express.Router();
const pool = require('../db');

// Middleware to verify JWT token (will be attached from server.js)
const verifyTokenMiddleware = (req, res, next) => {
  const jwt = require('jsonwebtoken');
  require('dotenv').config();
  
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Missing or invalid authorization header' });
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

// Create properties and interests tables if not exists
async function createSchema() {
  try {
    const conn = await pool.getConnection();

    const createProperties = `
      CREATE TABLE IF NOT EXISTS properties (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        type VARCHAR(20) NOT NULL,
        propertyType VARCHAR(100),
        bedrooms VARCHAR(50),
        availableFor JSON,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        price VARCHAR(100),
        city VARCHAR(100),
        address TEXT,
        pincode VARCHAR(10),
        features VARCHAR(500),
        images JSON,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      )
    `;

    const createInterests = `
      CREATE TABLE IF NOT EXISTS interests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        propertyId INT NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (propertyId) REFERENCES properties(id) ON DELETE CASCADE
      )
    `;

    await conn.query(createProperties);
    await conn.query(createInterests);
    // Ensure newer columns exist (for upgrades where table existed previously)
    try {
      const [hasAddress] = await conn.query("SHOW COLUMNS FROM properties LIKE 'address'");
      if (!hasAddress || hasAddress.length === 0) {
        await conn.query("ALTER TABLE properties ADD COLUMN address TEXT");
      }
      const [hasPincode] = await conn.query("SHOW COLUMNS FROM properties LIKE 'pincode'");
      if (!hasPincode || hasPincode.length === 0) {
        await conn.query("ALTER TABLE properties ADD COLUMN pincode VARCHAR(10)");
      }
      const [hasImages] = await conn.query("SHOW COLUMNS FROM properties LIKE 'images'");
      if (!hasImages || hasImages.length === 0) {
        await conn.query("ALTER TABLE properties ADD COLUMN images JSON");
      }
      const [hasPropertyType] = await conn.query("SHOW COLUMNS FROM properties LIKE 'propertyType'");
      if (!hasPropertyType || hasPropertyType.length === 0) {
        await conn.query("ALTER TABLE properties ADD COLUMN propertyType VARCHAR(100)");
      }
      const [hasBedrooms] = await conn.query("SHOW COLUMNS FROM properties LIKE 'bedrooms'");
      if (!hasBedrooms || hasBedrooms.length === 0) {
        await conn.query("ALTER TABLE properties ADD COLUMN bedrooms VARCHAR(50)");
      }
      const [hasAvailableFor] = await conn.query("SHOW COLUMNS FROM properties LIKE 'availableFor'");
      if (!hasAvailableFor || hasAvailableFor.length === 0) {
        await conn.query("ALTER TABLE properties ADD COLUMN availableFor JSON");
      }
    } catch (e) {
      console.warn('Could not ensure additional property columns:', e.message);
    }
    conn.release();
    console.log('Properties and interests tables ready');
  } catch (err) {
    console.error('Error creating schema:', err.message);
  }
}

createSchema();

// Create or update a property (post property) - with simple image upload
router.post('/property', verifyTokenMiddleware, async (req, res) => {
  // Configure multer for single image upload
  const multer = require('multer');
  const path = require('path');
  const fs = require('fs');
  
  const uploadsDir = path.join(__dirname, '..', 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

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

  const uploadMiddleware = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files allowed'), false);
      }
    }
  });

  // Handle single image upload + form fields
  uploadMiddleware.single('propImage')(req, res, async (err) => {
    if (err) {
      console.error('Upload error:', err.message);
      return res.status(400).json({ success: false, message: 'File error: ' + err.message });
    }

    let conn;
    try {
      const { userId, type, title, description, price, city, address, pincode, features, propertyType, bedrooms, availableFor } = req.body;

      console.log('POST /api/property body:', req.body);
      console.log('Uploaded file:', req.file ? req.file.filename : 'none');
      
      if (!userId) {
        console.log('Missing: userId');
        return res.status(400).json({ success: false, message: 'Missing userId' });
      }
      if (!type) {
        console.log('Missing: type');
        return res.status(400).json({ success: false, message: 'Missing type' });
      }
      if (!title) {
        console.log('Missing: title');
        return res.status(400).json({ success: false, message: 'Missing title' });
      }
      if (!address) {
        console.log('Missing: address');
        return res.status(400).json({ success: false, message: 'Missing address' });
      }
      if (!pincode) {
        console.log('Missing: pincode');
        return res.status(400).json({ success: false, message: 'Missing pincode' });
      }

      // Store image path if file was uploaded
      const imagePaths = [];
      if (req.file && req.file.filename) {
        imagePaths.push('/uploads/' + encodeURIComponent(req.file.filename));
        console.log('Stored image path:', imagePaths[0]);
      }

      conn = await pool.getConnection();

      // Basic dedupe: avoid duplicate inserts if same user posts same title within short time window
      try {
        const titleTrim = (title || '').trim();
        if (titleTrim) {
          const [dup] = await conn.query(
            "SELECT id FROM properties WHERE userId = ? AND title = ? AND createdAt >= (NOW() - INTERVAL 15 SECOND)",
            [userId, titleTrim]
          );
          if (dup && dup.length > 0) {
            conn.release();
            return res.json({ success: true, message: 'Duplicate post ignored', propertyId: dup[0].id, images: imagePaths });
          }
        }
      } catch (e) {
        console.warn('Dedupe check failed:', e.message);
      }

      // Normalize availableFor to JSON string
      let availableForJson = null;
      try {
        if (typeof availableFor === 'string') {
          availableForJson = availableFor ? JSON.stringify(JSON.parse(availableFor)) : JSON.stringify([]);
        } else if (Array.isArray(availableFor)) {
          availableForJson = JSON.stringify(availableFor);
        } else {
          availableForJson = JSON.stringify([]);
        }
      } catch (e) {
        availableForJson = JSON.stringify([]);
      }

      const [result] = await conn.query(
        'INSERT INTO properties (userId, type, propertyType, bedrooms, title, description, price, city, address, pincode, features, images, availableFor) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [userId, type, propertyType || '', bedrooms || '', title, description || '', price || '', city || '', address || '', pincode || '', features || '', JSON.stringify(imagePaths), availableForJson]
      );
      conn.release();
      res.status(201).json({ success: true, message: 'Property posted', propertyId: result.insertId, images: imagePaths });
    } catch (err) {
      if (conn) conn.release();
      console.error('Property error:', err);
      res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
  });
});

// Get properties for a user (history) - public endpoint
// Note: this endpoint intentionally does not require a session/token so frontend can fetch by userId
// IMPORTANT: Only returns properties for the specific userId passed as query param
router.get('/properties', async (req, res) => {
  let conn;
  try {
    const userId = req.query.userId;
    
    // Require userId to prevent returning all properties
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId query parameter is required' });
    }
    
    conn = await pool.getConnection();
    const [rows] = await conn.query('SELECT * FROM properties WHERE userId = ? ORDER BY createdAt DESC', [userId]);
    conn.release();
    
    // Parse JSON images for each property
    const properties = rows.map(p => ({
      ...p,
      images: (() => {
  try { 
    return JSON.parse(p.images); 
  } catch (e) { 
    return []; 
  }
})()

    }));
    
    res.json({ success: true, properties });
  } catch (err) {
    if (conn) conn.release();
    console.error('Get properties error:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get properties for authenticated user with optional filters (used by dashboard history)
router.get('/myproperties', verifyTokenMiddleware, async (req, res) => {
  let conn;
  try {
    const authUserId = req.user && req.user.id ? req.user.id : null;
    if (!authUserId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const search = (req.query.search || '').trim();
    const status = (req.query.status || '').trim();
    const type = (req.query.type || '').trim();

    const where = ['userId = ?'];
    const params = [authUserId];

    if (type) {
      where.push('type = ?');
      params.push(type);
    }
    if (status) {
      // Some installations may not have `status` column; guard with try/catch
      where.push('status = ?');
      params.push(status);
    }
    if (search) {
      where.push('(propertyType LIKE ? OR city LIKE ? OR address LIKE ?)');
      const s = '%' + search + '%';
      params.push(s, s, s);
    }

    const sql = `SELECT * FROM properties WHERE ${where.join(' AND ')} ORDER BY createdAt DESC`;

    conn = await pool.getConnection();
    const [rows] = await conn.query(sql, params);
    conn.release();

    const properties = rows.map(p => ({
      ...p,
      images: (() => { try { return JSON.parse(p.images); } catch (e) { return []; } })()
    }));

    res.json({ success: true, properties });
  } catch (err) {
    if (conn) conn.release();
    console.error('/myproperties error:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get count of properties for authenticated user
router.get('/properties/count', verifyTokenMiddleware, async (req, res) => {
  let conn;
  try {
    const authUserId = req.user && req.user.id ? req.user.id : null;
    if (!authUserId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    conn = await pool.getConnection();
    const [rows] = await conn.query('SELECT COUNT(*) as cnt FROM properties WHERE userId = ?', [authUserId]);
    conn.release();

    const count = rows && rows[0] ? rows[0].cnt : 0;
    res.json({ success: true, count });
  } catch (err) {
    if (conn) conn.release();
    console.error('Get properties count error:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Express interest in a property
router.post('/interest', verifyTokenMiddleware, async (req, res) => {
  let conn;
  try {
    const { userId, propertyId } = req.body;
    if (!userId || !propertyId) return res.status(400).json({ success: false, message: 'Missing fields' });
    conn = await pool.getConnection();
    const [existing] = await conn.query('SELECT id FROM interests WHERE userId = ? AND propertyId = ?', [userId, propertyId]);
    if (existing.length > 0) {
      conn.release();
      return res.json({ success: true, message: 'Already interested' });
    }
    const [result] = await conn.query('INSERT INTO interests (userId, propertyId) VALUES (?, ?)', [userId, propertyId]);
    conn.release();
    res.json({ success: true, message: 'Interest recorded', interestId: result.insertId });
  } catch (err) {
    if (conn) conn.release();
    console.error('Interest error:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get interests for a user
router.get('/interests', verifyTokenMiddleware, async (req, res) => {
  let conn;
  try {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ success: false, message: 'Missing userId' });
    conn = await pool.getConnection();
    const [rows] = await conn.query(
      `SELECT i.id, i.propertyId, p.title, p.type, p.city, p.price, p.pincode, p.address, p.images, i.createdAt
       FROM interests i
       JOIN properties p ON p.id = i.propertyId
       WHERE i.userId = ? ORDER BY i.createdAt DESC`,
      [userId]
    );
    conn.release();
    
    // Parse JSON images
    const interests = rows.map(item => ({
      ...item,
      images: item.images ? JSON.parse(item.images) : []
    }));
    
    res.json({ success: true, interests });
  } catch (err) {
    if (conn) conn.release();
    console.error('Get interests error:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get profile
router.get('/profile', verifyTokenMiddleware, async (req, res) => {
  let conn;
  try {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ success: false, message: 'Missing userId' });
    conn = await pool.getConnection();
    const [rows] = await conn.query(
      'SELECT id, fullName, username, email, mobile, dob, gender, address, city, pincode, about, createdAt FROM users WHERE id = ? LIMIT 1',
      [userId]
    );
    conn.release();
    if (!rows || rows.length === 0) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user: rows[0] });
  } catch (err) {
    if (conn) conn.release();
    console.error('Get profile error:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Update profile
router.put('/profile', verifyTokenMiddleware, async (req, res) => {
  let conn;
  try {
    const { userId, fullName, username, email, mobile, dob, gender, address, city, pincode, about } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: 'Missing userId' });
    conn = await pool.getConnection();
    await conn.query(
      'UPDATE users SET fullName = ?, username = ?, email = ?, mobile = ?, dob = ?, gender = ?, address = ?, city = ?, pincode = ?, about = ? WHERE id = ?',
      [fullName, username, email, mobile, dob || null, gender || null, address || null, city || null, pincode || null, about || null, userId]
    );
    conn.release();
    res.json({ success: true, message: 'Profile updated' });
  } catch (err) {
    if (conn) conn.release();
    console.error('Update profile error:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Simple logout endpoint (frontend can also clear localStorage)
router.post('/logout', verifyTokenMiddleware, (req, res) => {
  res.json({ success: true, message: 'Logged out' });
});

// Get all user profiles (for admin/management)
router.get('/profiles/all', verifyTokenMiddleware, async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const [rows] = await conn.query(
      'SELECT id, fullName, username, email, mobile, dob, gender, address, city, pincode, about, createdAt FROM users ORDER BY createdAt DESC'
    );
    conn.release();
    res.json({ success: true, profiles: rows });
  } catch (err) {
    if (conn) conn.release();
    console.error('Get all profiles error:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete a user profile
router.post('/profile/delete', verifyTokenMiddleware, async (req, res) => {
  let conn;
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: 'Missing userId' });

    conn = await pool.getConnection();

    // Start transaction
    await conn.beginTransaction();

    try {
      // Delete user's interests first (foreign key constraint)
      await conn.query('DELETE FROM interests WHERE userId = ?', [userId]);

      // Delete user's properties
      await conn.query('DELETE FROM properties WHERE userId = ?', [userId]);

      // Delete user
      const [result] = await conn.query('DELETE FROM users WHERE id = ?', [userId]);

      await conn.commit();

      if (result.affectedRows > 0) {
        res.json({ success: true, message: 'Profile deleted successfully' });
      } else {
        res.status(404).json({ success: false, message: 'User not found' });
      }
    } catch (txErr) {
      await conn.rollback();
      throw txErr;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('Delete profile error:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
