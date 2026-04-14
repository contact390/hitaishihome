const express = require("express");
const router = express.Router();
const pool = require("../db");
const nodemailer = require("nodemailer");

// Ensure the property_rents table exists on startup
(async function ensureRentTable() {
  try {
    const createQuery = `
      CREATE TABLE IF NOT EXISTS property_rents (
        id INT AUTO_INCREMENT PRIMARY KEY,
        propertyId INT NOT NULL,
        name VARCHAR(100),
        phone VARCHAR(20),
        email VARCHAR(120),
        message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await pool.query(createQuery);
    console.log('property_rents table ready');
  } catch (err) {
    console.error('Error ensuring property_rents table:', err.message || err);
  }
})();

/* ------------------------------------------------------------------
   1. CREATE TABLE (property_rents)
--------------------------------------------------------------------- */

router.get("/create-rent-table", async (req, res) => {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS property_rents (
        id INT AUTO_INCREMENT PRIMARY KEY,
        propertyId INT NOT NULL,
        name VARCHAR(100),
        phone VARCHAR(20),
        email VARCHAR(120),
        message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    await pool.query(query);
    res.json({ success: true, message: "Table property_rents created" });

  } catch (err) {
    console.error(err);
    res.json({ success: false, message: "Error creating table" });
  }
});


/* ------------------------------------------------------------------
   2. POST : Rent Property Request + Send Email (NodeMailer)
--------------------------------------------------------------------- */

router.post("/rentproperty", async (req, res) => {
  try {
    const { propertyId, name, phone, email, message } = req.body;

    if (!propertyId || !name || !phone) {
      return res.json({ success: false, message: "Missing required fields" });
    }

    // Ensure table exists (defensive)
    const createQuery = `
      CREATE TABLE IF NOT EXISTS property_rents (
        id INT AUTO_INCREMENT PRIMARY KEY,
        propertyId INT NOT NULL,
        name VARCHAR(100),
        phone VARCHAR(20),
        email VARCHAR(120),
        message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await pool.query(createQuery);

    // Save to DB
    const [result] = await pool.query(
      `INSERT INTO property_rents (propertyId, name, phone, email, message)
       VALUES (?, ?, ?, ?, ?)`,
      [propertyId, name, phone, email, message]
    );

    /* -----------------------------
       NodeMailer Email Notification
    ------------------------------ */

    let transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.MAIL_USER || "hitaishimatrimony@gmail.com",
        pass: process.env.MAIL_PASS || "hgkh ylho pibp bopl"
      }
    });

    let mailOptions = {
      from: process.env.MAIL_USER || 'hitaishimatrimony@gmail.com',
      to: email,
      subject: "New Property Rent Request",
      html: `
        <h2>New Rent Request</h2>
        <p><b>Property ID:</b> ${propertyId}</p>
        <p><b>Name:</b> ${name}</p>
        <p><b>Phone:</b> ${phone}</p>
        <p><b>Email:</b> ${email}</p>
        <p><b>Message:</b> ${message}</p>
        <hr>
        <p>Submitted At: ${new Date().toLocaleString()}</p>
      `
    };

    transporter.sendMail(mailOptions, (err) => {
      if (err) console.log("Email Error:", err);
      else console.log("Rent Email Sent Successfully");
    });

    res.json({ success: true, insertId: result.insertId });

  } catch (err) {
    console.error(err);
    res.json({ success: false, message: "Error submitting rent request" });
  }
});


/* ------------------------------------------------------------------
   3. GET : Fetch All Rent Requests
--------------------------------------------------------------------- */

router.get("/rentproperty", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM property_rents ORDER BY id DESC"
    );

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: "Unable to fetch rent requests" });
  }
});

module.exports = router;
