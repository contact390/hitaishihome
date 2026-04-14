const express = require("express");
const router = express.Router();
const pool = require("../db");
const nodemailer = require("nodemailer");

/* ------------------------------------------------------------------
   1. CREATE TABLE (property_buys)
--------------------------------------------------------------------- */

router.get("/create-buy-table", async (req, res) => {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS property_buys (
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
    res.json({ success: true, message: "Table property_buys created" });

  } catch (err) {
    console.error(err);
    res.json({ success: false, message: "Error creating table" });
  }
});


/* ------------------------------------------------------------------
   2. POST : Buy Property Request + Send Email (NodeMailer)
--------------------------------------------------------------------- */

router.post("/buyproperty", async (req, res) => {
  try {
    const { propertyId, name, phone, email, message } = req.body;

    if (!propertyId || !name || !phone) {
      return res.json({ success: false, message: "Missing required fields" });
    }

    // Save to DB
    const [result] = await pool.query(
      `INSERT INTO property_buys (propertyId, name, phone, email, message)
       VALUES (?, ?, ?, ?, ?)`,
      [propertyId, name, phone, email, message]
    );

    /* -----------------------------
       NodeMailer Email Notification
    ------------------------------ */

    let transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "hitaishimatrimony@gmail.com",       // change this
        pass: "hgkh ylho pibp bopl"           // Gmail App Password
      }
    });

    let mailOptions = {
       from: 'hitaishimatrimony@gmail.com',
      to: email, // can also send to user: email,
      subject: "New Property Buy Request",
      html: `
        <h2>New Buy Request</h2>
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
      else console.log("Email Sent Successfully");
    });

    res.json({ success: true, insertId: result.insertId });

  } catch (err) {
    console.error(err);
    res.json({ success: false, message: "Error submitting buy request" });
  }
});


/* ------------------------------------------------------------------
   3. GET : Fetch All Buy Requests
--------------------------------------------------------------------- */

router.get("/buyproperty", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM property_buys ORDER BY id DESC"
    );

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: "Unable to fetch buy requests" });
  }
});

module.exports = router;
