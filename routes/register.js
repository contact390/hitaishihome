// Registration Routes
const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Create users table if not exists (on server startup)
async function createUsersTable() {
  try {
    const conn = await pool.getConnection();
    
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        fullName VARCHAR(255) NOT NULL,
        username VARCHAR(100) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        mobile VARCHAR(15) NOT NULL,
        password VARCHAR(255) NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `;
    
    await conn.query(createTableQuery);
    console.log('Users table ready');
    // Ensure additional profile columns exist (for upgrades)
    try {
      const [hasDob] = await conn.query("SHOW COLUMNS FROM users LIKE 'dob'");
      if (!hasDob || hasDob.length === 0) {
        await conn.query("ALTER TABLE users ADD COLUMN dob DATE NULL");
      }
      const [hasGender] = await conn.query("SHOW COLUMNS FROM users LIKE 'gender'");
      if (!hasGender || hasGender.length === 0) {
        await conn.query("ALTER TABLE users ADD COLUMN gender VARCHAR(20) NULL");
      }
      const [hasAddress] = await conn.query("SHOW COLUMNS FROM users LIKE 'address'");
      if (!hasAddress || hasAddress.length === 0) {
        await conn.query("ALTER TABLE users ADD COLUMN address TEXT NULL");
      }
      const [hasCity] = await conn.query("SHOW COLUMNS FROM users LIKE 'city'");
      if (!hasCity || hasCity.length === 0) {
        await conn.query("ALTER TABLE users ADD COLUMN city VARCHAR(100) NULL");
      }
      const [hasPincode] = await conn.query("SHOW COLUMNS FROM users LIKE 'pincode'");
      if (!hasPincode || hasPincode.length === 0) {
        await conn.query("ALTER TABLE users ADD COLUMN pincode VARCHAR(10) NULL");
      }
      const [hasAbout] = await conn.query("SHOW COLUMNS FROM users LIKE 'about'");
      if (!hasAbout || hasAbout.length === 0) {
        await conn.query("ALTER TABLE users ADD COLUMN about TEXT NULL");
      }
    } catch (e) {
      console.warn('Could not ensure additional user columns:', e.message);
    }
    conn.release();
  } catch (err) {
    console.error('Error creating users table:', err.message);
  }
}

// Initialize table on startup
createUsersTable();

// Validation helper functions
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePassword = (password) => {
  return password && password.length >= 6;
};

const validateMobile = (mobile) => {
  const mobileRegex = /^[0-9]{10}$/;
  return mobileRegex.test(mobile.replace(/\D/g, ''));
};

// Register endpoint
router.post('/properties_re', async (req, res) => {
  let conn;
  try {
    const { fullName, username, email, mobile, password, confirmPassword } = req.body;

    // Validation checks
    if (!fullName || !username || !email || !mobile || !password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match'
      });
    }

    if (!validateMobile(mobile)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid mobile number. Please enter a 10-digit number'
      });
    }

    // Get connection from pool
    conn = await pool.getConnection();

    // Check if user already exists
    const [existingUser] = await conn.query(
      'SELECT id FROM users WHERE email = ? OR username = ?',
      [email, username]
    );

    if (existingUser.length > 0) {
      conn.release();
      return res.status(400).json({
        success: false,
        message: 'Email or username already registered'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user into database
    const [result] = await conn.query(
      'INSERT INTO users (fullName, username, email, mobile, password) VALUES (?, ?, ?, ?, ?)',
      [fullName, username, email, mobile, hashedPassword]
    );

    conn.release();

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      userId: result.insertId
    });

  } catch (error) {
    if (conn) conn.release();
    
    // Handle duplicate entry errors
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        message: 'Email or username already registered'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

module.exports = router;

// Login endpoint
router.post('/login', async (req, res) => {
  let conn;
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' });
    }

    conn = await pool.getConnection();

    // Try to find user by username or email
    const [rows] = await conn.query(
      'SELECT id, fullName, username, email, mobile, password FROM users WHERE username = ? OR email = ? LIMIT 1',
      [username, username]
    );

    if (!rows || rows.length === 0) {
      conn.release();
      return res.status(400).json({ message: 'Invalid username or password' });
    }

    const user = rows[0];

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      conn.release();
      return res.status(400).json({ message: 'Invalid username or password' });
    }

    // Remove password before sending
    const safeUser = {
      id: user.id,
      fullName: user.fullName,
      username: user.username,
      email: user.email,
      mobile: user.mobile
    };

    // Generate JWT token (valid for 7 days)
    const token = jwt.sign(safeUser, process.env.JWT_SECRET || 'default_secret_key', { expiresIn: '7d' });

    conn.release();
    return res.json({ 
      success: true,
      message: 'Login successful',
      token: token,
      user: safeUser
    });
  } catch (err) {
    if (conn) conn.release();
    console.error('Login error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});
