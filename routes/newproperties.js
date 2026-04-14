// routes/newProperties.js
const express = require('express');
const router = express.Router();
const pool = require('../db');     // your existing db.js that exports a MySQL pool
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 1. Ensure uploads folder exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// 2. Multer storage (single image)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ts = Date.now();
    cb(null, ts + '-' + file.originalname.replace(/\s+/g, '_'));
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files allowed'), false);
  }
});

// 3. Create NEW TABLE property_listings
async function ensurePropertyListingsTable() {
  try {
    const conn = await pool.getConnection();
    await conn.query(`
      CREATE TABLE IF NOT EXISTS property_listings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT DEFAULT NULL,
        type VARCHAR(20) NOT NULL,
        propertyType VARCHAR(100),
        bedrooms VARCHAR(50),
        title VARCHAR(255),
        description TEXT,
        price VARCHAR(100),
        city VARCHAR(100),
        locality VARCHAR(255),
        address TEXT,
        pincode VARCHAR(10),
        nearbyLandmarks VARCHAR(255),
        builtUpArea VARCHAR(50),
        carpetArea VARCHAR(50),
        plotArea VARCHAR(50),
        bathrooms VARCHAR(20),
        balconyCount VARCHAR(20),
        floorNumber VARCHAR(20),
        totalFloors VARCHAR(20),
        maintenanceCharges VARCHAR(50),
        deposit VARCHAR(50),
        negotiable TINYINT(1) DEFAULT 0,
        videoUrl VARCHAR(255),
        furnishingStatus VARCHAR(50),
        ageOfProperty VARCHAR(50),
        facing VARCHAR(50),
        parkingAvailability VARCHAR(100),
        waterSource VARCHAR(100),
        powerBackup VARCHAR(100),
        flooringType VARCHAR(100),
        amenities VARCHAR(500),
        ownershipType VARCHAR(50),
        documentsAvailable VARCHAR(500),
        loanAvailable TINYINT(1) DEFAULT 0,
        ownerName VARCHAR(255),
        contactMobile VARCHAR(50),
        contactAlt VARCHAR(50),
        contactEmail VARCHAR(255),
        readyToMove TINYINT(1) DEFAULT 0,
        petsAllowed VARCHAR(50),
        idealFor VARCHAR(100),
        specialFeatures VARCHAR(500),
        features VARCHAR(500),
        rentFor VARCHAR(255),
        imageUrl VARCHAR(255),
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL
      )
    `);
    // Ensure important columns exist (for older DBs) - add any missing
    const columnsToEnsure = {
      locality: 'VARCHAR(255)',
      nearbyLandmarks: 'VARCHAR(255)',
      builtUpArea: 'VARCHAR(50)',
      carpetArea: 'VARCHAR(50)',
      plotArea: 'VARCHAR(50)',
      bathrooms: 'VARCHAR(20)',
      balconyCount: 'VARCHAR(20)',
      floorNumber: 'VARCHAR(20)',
      totalFloors: 'VARCHAR(20)',
      maintenanceCharges: 'VARCHAR(50)',
      deposit: 'VARCHAR(50)',
      negotiable: 'TINYINT(1) DEFAULT 0',
      videoUrl: 'VARCHAR(255)',
      furnishingStatus: 'VARCHAR(50)',
      ageOfProperty: 'VARCHAR(50)',
      facing: 'VARCHAR(50)',
      parkingAvailability: 'VARCHAR(100)',
      waterSource: 'VARCHAR(100)',
      powerBackup: 'VARCHAR(100)',
      flooringType: 'VARCHAR(100)',
      amenities: 'VARCHAR(500)',
      ownershipType: 'VARCHAR(50)',
      documentsAvailable: 'VARCHAR(500)',
      loanAvailable: 'TINYINT(1) DEFAULT 0',
      ownerName: 'VARCHAR(255)',
      contactMobile: 'VARCHAR(50)',
      contactAlt: 'VARCHAR(50)',
      contactEmail: 'VARCHAR(255)',
      readyToMove: 'TINYINT(1) DEFAULT 0',
      petsAllowed: 'VARCHAR(50)',
      idealFor: 'VARCHAR(100)',
      specialFeatures: 'VARCHAR(500)'
    };

    for (const [col, def] of Object.entries(columnsToEnsure)) {
      const [r] = await conn.query(`SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'property_listings' AND COLUMN_NAME = ?`, [col]);
      if (!r || r.length === 0) {
        try {
          await conn.query(`ALTER TABLE property_listings ADD COLUMN ${col} ${def}`);
          console.log(`Added ${col} column to property_listings`);
        } catch (alterErr) {
          console.error(`Failed to add ${col} column:`, alterErr.message);
        }
      }
    }

    conn.release();
    console.log('property_listings table ready');
  } catch (err) {
    console.error('Error creating property_listings table:', err.message);
  }
}
ensurePropertyListingsTable();

// Ensure interests table for property_listings
async function ensureListingInterestsTable() {
  try {
    const conn = await pool.getConnection();
    await conn.query(`
      CREATE TABLE IF NOT EXISTS listing_interests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        propertyListingId INT NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY ux_user_property (userId, propertyListingId)
      )
    `);
    conn.release();
    console.log('listing_interests table ready');
  } catch (err) {
    console.error('Error creating listing_interests table:', err.message);
  }
}
ensureListingInterestsTable();

// 4. POST /api/new-property  (NO token, simple demo)
router.post('/newproperty', upload.single('propImage'), async (req, res) => {
  let conn;
  try {
    const {
      propType,          // sell/rent
      propPropertyType,  // house, apartment etc
      propCity,
      propBedrooms,
      propPincode,
      propPrice,
      propAddress,
      propTitle,
      propFeatures,
      propDesc
    } = req.body;

    // propTitle is optional now (frontend removed it). Require only type, address and pincode.
    // Validate required fields: ensure backend stores key details before accepting
    const requiredFields = {
      propType: propType,
      propAddress: propAddress,
      propPincode: propPincode,
      locality: req.body.locality,
      builtUpArea: req.body.builtUpArea,
      carpetArea: req.body.carpetArea,
      bathrooms: req.body.bathrooms,
      contactMobile: req.body.contactMobile
    };
    const missing = Object.keys(requiredFields).filter(k => !requiredFields[k] || String(requiredFields[k]).trim() === '');
    if (missing.length) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: ' + missing.join(', ')
      });
    }

    // rentFor can be sent as multiple values (array) or single value.
    const rentForRaw = req.body.rentFor;
    let rentFor = null;
    if (rentForRaw) {
      if (Array.isArray(rentForRaw)) rentFor = rentForRaw.join(',');
      else rentFor = rentForRaw.toString();
    }

    // amenities can be multiple
    const amenitiesRaw = req.body.amenities;
    let amenities = null;
    if (amenitiesRaw) {
      if (Array.isArray(amenitiesRaw)) amenities = amenitiesRaw.join(',');
      else amenities = amenitiesRaw.toString();
    }

    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    // allow optional userId to be stored (frontend can pass local user id)
    const userId = req.body.userId ? parseInt(req.body.userId, 10) : null;

    conn = await pool.getConnection();
    const cols = '(userId, type, propertyType, bedrooms, title, description, price, city, locality, address, pincode, nearbyLandmarks, builtUpArea, carpetArea, plotArea, bathrooms, balconyCount, floorNumber, totalFloors, maintenanceCharges, deposit, negotiable, videoUrl, furnishingStatus, ageOfProperty, facing, parkingAvailability, waterSource, powerBackup, flooringType, amenities, ownershipType, documentsAvailable, loanAvailable, ownerName, contactMobile, contactAlt, contactEmail, readyToMove, petsAllowed, idealFor, specialFeatures, features, rentFor, imageUrl)';
    const vals = [
      userId,
      propType,
      propPropertyType || '',
      propBedrooms || '',
      propTitle || '',
      propDesc || '',
      propPrice || '',
      propCity || '',
      req.body.locality || '',
      propAddress || '',
      propPincode || '',
      req.body.nearbyLandmarks || '',
      req.body.builtUpArea || '',
      req.body.carpetArea || '',
      req.body.plotArea || '',
      req.body.bathrooms || '',
      req.body.balconyCount || '',
      req.body.floorNumber || '',
      req.body.totalFloors || '',
      req.body.maintenanceCharges || '',
      req.body.deposit || '',
      req.body.negotiable ? 1 : 0,
      req.body.videoUrl || '',
      req.body.furnishingStatus || '',
      req.body.ageOfProperty || '',
      req.body.facing || '',
      req.body.parkingAvailability || '',
      req.body.waterSource || '',
      req.body.powerBackup || '',
      req.body.flooringType || '',
      amenities || '',
      req.body.ownershipType || '',
      req.body.documentsAvailable || '',
      req.body.loanAvailable ? 1 : 0,
      req.body.ownerName || '',
      req.body.contactMobile || '',
      req.body.contactAlt || '',
      req.body.contactEmail || '',
      req.body.readyToMove ? 1 : 0,
      req.body.petsAllowed || '',
      req.body.idealFor || '',
      req.body.specialFeatures || '',
      propFeatures || '',
      rentFor,
      imageUrl
    ];

    const placeholders = vals.map(() => '?').join(', ');
    const sql = `INSERT INTO property_listings ${cols} VALUES (${placeholders})`;
    const [result] = await conn.query(sql, vals);
    conn.release();

    return res.status(201).json({
      success: true,
      message: 'New property created',
      propertyId: result.insertId,
      imageUrl
    });
  } catch (err) {
    if (conn) conn.release();
    console.error('POST /api/newproperty error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 5. GET /api/new-properties
router.get('/newproperties', async (req, res) => {
  let conn;
  try {
    const userId = req.query.userId ? parseInt(req.query.userId, 10) : null;
    conn = await pool.getConnection();
    let rows;
    if (userId) {
      [rows] = await conn.query('SELECT * FROM property_listings WHERE userId = ? ORDER BY createdAt DESC', [userId]);
    } else {
      [rows] = await conn.query('SELECT * FROM property_listings ORDER BY createdAt DESC');
    }
    conn.release();
    return res.json({ success: true, properties: rows });
  } catch (err) {
    if (conn) conn.release();
    console.error('GET /api/new-properties error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/newproperties/buy
router.get('/newproperties/buy', async (req, res) => {
  let conn;
  try {
    const propertyType = req.query.propertyType;
    conn = await pool.getConnection();
    let sql = 'SELECT * FROM property_listings WHERE type = ?';
    let params = ['sell'];
    if (propertyType) {
      sql += ' AND propertyType = ?';
      params.push(propertyType);
    }
    sql += ' ORDER BY createdAt DESC';
    const [rows] = await conn.query(sql, params);
    conn.release();
    return res.json({ success: true, properties: rows });
  } catch (err) {
    if (conn) conn.release();
    console.error('GET /api/newproperties/buy error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/newproperties/rent
router.get('/newproperties/rent', async (req, res) => {
  let conn;
  try {
    const propertyType = req.query.propertyType;
    conn = await pool.getConnection();
    let sql = 'SELECT * FROM property_listings WHERE type = ?';
    let params = ['rent'];
    if (propertyType) {
      sql += ' AND propertyType = ?';
      params.push(propertyType);
    }
    sql += ' ORDER BY createdAt DESC';
    const [rows] = await conn.query(sql, params);
    conn.release();
    return res.json({ success: true, properties: rows });
  } catch (err) {
    if (conn) conn.release();
    console.error('GET /api/newproperties/rent error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/newproperties/interest
router.post('/newproperties/interest', async (req, res) => {
  let conn;
  try {
    const { userId, propertyListingId } = req.body;
    if (!userId || !propertyListingId) return res.status(400).json({ success: false, message: 'Missing fields' });

    conn = await pool.getConnection();
    // avoid duplicates because of unique key
    try {
      const [ins] = await conn.query('INSERT IGNORE INTO listing_interests (userId, propertyListingId) VALUES (?, ?)', [userId, propertyListingId]);
      conn.release();
      if (ins && ins.affectedRows > 0) {
        return res.json({ success: true, message: 'Interest recorded', interestId: ins.insertId });
      } else {
        return res.json({ success: true, message: 'Already marked interest' });
      }
    } catch (e) {
      conn.release();
      throw e;
    }
  } catch (err) {
    if (conn) conn.release();
    console.error('/newproperties/interest error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// DELETE /api/newproperties/interest
router.delete('/newproperties/interest', async (req, res) => {
  let conn;
  try {
    const { userId, propertyListingId } = req.body;
    if (!userId || !propertyListingId) return res.status(400).json({ success: false, message: 'Missing fields' });
    conn = await pool.getConnection();
    const [result] = await conn.query('DELETE FROM listing_interests WHERE userId = ? AND propertyListingId = ?', [userId, propertyListingId]);
    conn.release();
    if (result && result.affectedRows > 0) {
      return res.json({ success: true, message: 'Interest removed' });
    } else {
      return res.json({ success: false, message: 'No interest found' });
    }
  } catch (err) {
    if (conn) conn.release();
    console.error('/newproperties/interest DELETE error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/newproperties/interests?userId=
router.get('/newproperties/interests', async (req, res) => {
  let conn;
  try {
    const userId = req.query.userId ? parseInt(req.query.userId, 10) : null;
    if (!userId) return res.status(400).json({ success: false, message: 'Missing userId' });
    conn = await pool.getConnection();
    const [rows] = await conn.query(
      `SELECT li.id as interestId, li.propertyListingId as propertyId, pl.title, pl.type, pl.propertyType, pl.city, pl.price, pl.pincode, pl.address, pl.features, pl.imageUrl, li.createdAt
       FROM listing_interests li
       JOIN property_listings pl ON pl.id = li.propertyListingId
       WHERE li.userId = ?
       ORDER BY li.createdAt DESC`,
      [userId]
    );
    conn.release();
    res.json({ success: true, interests: rows });
  } catch (err) {
    if (conn) conn.release();
    console.error('/newproperties/interests error:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});



// DELETE /api/newproperties/:id
router.delete('/newproperties/:id', async (req, res) => {
  let conn;
  try {
    const { id } = req.params;

    conn = await pool.getConnection();

    // Get image path first (to delete file)
    const [rows] = await conn.query(
      'SELECT imageUrl FROM property_listings WHERE id = ?',
      [id]
    );

    if (!rows.length) {
      conn.release();
      return res.status(404).json({ success: false, message: 'Property not found' });
    }

    const imagePath = rows[0].imageUrl;

    // Delete DB record
    await conn.query('DELETE FROM property_listings WHERE id = ?', [id]);

    conn.release();

    // Delete image file
    if (imagePath) {
      const fullPath = path.join(__dirname, '..', imagePath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }

    res.json({ success: true, message: 'Deleted successfully' });

  } catch (err) {
    if (conn) conn.release();
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PUT /api/newproperties/:id
router.put('/newproperties/:id', upload.single('propImage'), async (req, res) => {
  let conn;
  try {
    const { id } = req.params;

    conn = await pool.getConnection();

    // Collect all possible fields from req.body
    const updateFields = {};
    const updateValues = [];

    // Define all updatable fields
    const fields = [
      'type', 'propertyType', 'bedrooms', 'title', 'description', 'price', 'city', 'locality', 'address', 'pincode',
      'nearbyLandmarks', 'builtUpArea', 'carpetArea', 'plotArea', 'bathrooms', 'balconyCount', 'floorNumber', 'totalFloors',
      'maintenanceCharges', 'deposit', 'negotiable', 'videoUrl', 'furnishingStatus', 'ageOfProperty', 'facing',
      'parkingAvailability', 'waterSource', 'powerBackup', 'flooringType', 'amenities', 'ownershipType', 'documentsAvailable',
      'loanAvailable', 'ownerName', 'contactMobile', 'contactAlt', 'contactEmail', 'readyToMove', 'petsAllowed', 'idealFor',
      'specialFeatures', 'features', 'rentFor'
    ];

    fields.forEach(field => {
      if (req.body[field] !== undefined) {
        updateFields[field] = req.body[field];
        updateValues.push(req.body[field]);
      }
    });

    // Handle image separately
    let imageUrl = null;
    if (req.file) {
      imageUrl = `/uploads/${req.file.filename}`;
      updateFields.imageUrl = imageUrl;
      updateValues.push(imageUrl);
    }

    if (Object.keys(updateFields).length === 0) {
      conn.release();
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    // Build dynamic SQL
    const setClause = Object.keys(updateFields).map(field => `${field} = ?`).join(', ');
    const sql = `UPDATE property_listings SET ${setClause} WHERE id = ?`;
    updateValues.push(id);

    await conn.query(sql, updateValues);

    conn.release();

    res.json({ success: true, message: 'Updated successfully' });

  } catch (err) {
    if (conn) conn.release();
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});
// GET /api/newproperties/buy?propertyType=apartment
// GET /api/newproperties/buy
router.get('/newproperties/buy', async (req, res) => {
  let conn;
  try {
    const { propertyType } = req.query;

    conn = await pool.getConnection();

    let sql = `
      SELECT * FROM property_listings 
      WHERE LOWER(type) IN ('sell','buy')
    `;
    let params = [];

    if (propertyType) {
      sql += " AND LOWER(propertyType) = LOWER(?)";
      params.push(propertyType);
    }

    sql += " ORDER BY createdAt DESC";

    const [rows] = await conn.query(sql, params);
    conn.release();

    res.json({ success: true, properties: rows });

  } catch (err) {
    if (conn) conn.release();
    console.error(err);
    res.status(500).json({ success: false });
  }
});

// GET /api/newproperties/rent?propertyType=house
// GET /api/newproperties/rent
router.get('/newproperties/rent', async (req, res) => {
  let conn;
  try {
    const { propertyType } = req.query;

    conn = await pool.getConnection();

    let sql = `
      SELECT * FROM property_listings 
      WHERE LOWER(type) = 'rent'
    `;
    let params = [];

    if (propertyType) {
      sql += " AND LOWER(propertyType) = LOWER(?)";
      params.push(propertyType);
    }

    sql += " ORDER BY createdAt DESC";

    const [rows] = await conn.query(sql, params);
    conn.release();

    res.json({ success: true, properties: rows });

  } catch (err) {
    if (conn) conn.release();
    console.error(err);
    res.status(500).json({ success: false });
  }
});

// GET /api/get/properties_re
router.get('/get/properties_re', async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const [rows] = await conn.query('SELECT * FROM property_listings ORDER BY createdAt DESC');
    conn.release();
    return res.json({ success: true, properties: rows });
  } catch (err) {
    if (conn) conn.release();
    console.error('GET /api/get/properties_re error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/get/filters_re
router.get('/get/filters_re', async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const [rows] = await conn.query('SELECT DISTINCT propertyType, city FROM property_listings');
    conn.release();

    const types = Array.from(new Set(rows.map(r => r.propertyType).filter(Boolean))).sort();
    const cities = Array.from(new Set(rows.map(r => r.city).filter(Boolean))).sort();
    const priceRanges = ['< 10 Lakh', '10-25 Lakh', '25-50 Lakh', '50-100 Lakh', '> 100 Lakh'];
    const ageRanges = ['New', '1-5 years', '5-10 years', '10+ years'];

    return res.json({ success: true, types, cities, priceRanges, ageRanges });
  } catch (err) {
    if (conn) conn.release();
    console.error('GET /api/get/filters_re error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
