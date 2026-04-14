const express = require("express");
const router = express.Router();
const pool = require("../db");

// =========================
// Create Contact Table
// =========================
const createContactTable = async () => {
  try {
    const conn = await pool.getConnection();

    await conn.query(`
      CREATE TABLE IF NOT EXISTS contact_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(50) NOT NULL,
        email VARCHAR(50) NOT NULL,
        number VARCHAR(20) NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    conn.release();
    console.log("✅ contact_messages table ready");
  } catch (err) {
    console.error("❌ Error creating contact table:", err);
  }
};

// Call the table creation function
createContactTable();

// =========================
// POST API: Save Contact Form
// =========================
router.post("/contact", async (req, res) => {
  const { name, email, number, message } = req.body;

  if (!name || !email || !number || !message) {
    return res.status(400).json({
      success: false,
      message: "All fields are required",
    });
  }

  try {
    const conn = await pool.getConnection();

    const sql = `
      INSERT INTO contact_messages (name, email, number, message)
      VALUES (?, ?, ?, ?)
    `;

    await conn.query(sql, [name, email, number, message]);
    conn.release();

    return res.json({
      success: true,
      message: "Message submitted successfully!",
    });
  } catch (err) {
    console.error("❌ Error saving contact:", err);
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
});

module.exports = router;
