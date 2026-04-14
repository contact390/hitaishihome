const express = require('express');
const router = express.Router();
const pool = require('../db'); // mysql2/promise pool

// Ensure table exists (run once)
(async ()=>{
  const create = `
    CREATE TABLE IF NOT EXISTS contact_messages2 (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      email VARCHAR(255) NOT NULL,
      phone VARCHAR(50),
      subject VARCHAR(100),
      message TEXT NOT NULL,
      ip VARCHAR(45),
      user_agent VARCHAR(255),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;
  try { await pool.execute(create); } catch(e){ console.error('Table create error', e); }
})();

function validEmail(e){ return typeof e === 'string' && /\S+@\S+\.\S+/.test(e); }

router.post('/contact2', async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body || {};
    if (!name || !email || !message) return res.status(400).json({ success:false, error:'name,email,message required' });
    if (!validEmail(email)) return res.status(400).json({ success:false, error:'invalid email' });

    // Validate phone if provided: must be +91 and 10 digits starting 6-9
    if (phone) {
      const phoneClean = String(phone).trim();
      const phoneRx = /^\+91[\s-]?[6-9]\d{9}$/;
      if (!phoneRx.test(phoneClean)) return res.status(400).json({ success:false, error:'invalid phone format; use +91XXXXXXXXXX' });
    }

    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;
    const ua = req.get('User-Agent') || null;

    const sql = `INSERT INTO contact_messages2 (name,email,phone,subject,message,ip,user_agent) VALUES (?,?,?,?,?,?,?)`;
    const params = [name.trim(), email.trim(), phone || null, subject || null, message.trim(), ip, ua];
    const [result] = await pool.execute(sql, params);
    return res.json({ success:true, id: result.insertId });
  } catch (err) {
    console.error('Contact insert error:', err);
    return res.status(500).json({ success:false, error:'server error' });
  }
});

module.exports = router;
