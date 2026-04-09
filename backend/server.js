const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();

app.use(cors());
app.use(express.json());

// 🔥 DB CONNECTION
const db = mysql.createConnection({
  host: "192.168.1.13",
  user: "remoteuser",
  password: "",
  database: "welljob_db",
});

db.connect((err) => {
  if (err) {
    console.error("Database connection failed:", err);
  } else {
    console.log("MySQL Connected");
  }
});

// 🔥 TEST
app.get("/", (req, res) => {
  res.json("Backend is running 🚀");
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;

  const sql = "SELECT * FROM users WHERE username = ?";

  db.query(sql, [username], async (err, result) => {
    if (err) return res.status(500).json(err);

    if (result.length === 0) {
      return res.status(401).json({ message: "User not found" });
    }

    const user = result[0];

    // 🔥 CRITICAL FIX — BLOCK INACTIVE USER FIRST
    if (user.status === "Inactive") {
      return res.status(403).json({
        message: "Account is inactive. Please contact IT support.",
      });
    }

    // 🔐 CHECK PASSWORD
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid password" });
    }

    // 🔐 GENERATE TOKEN
    const token = jwt.sign(
      { id: user.id, role: user.role },
      "secretkey",
      { expiresIn: "1d" }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.full_name,
        role: user.role,
      },
    });
  });
});

// 🔥 GET USERS (FIXED STATUS)
app.get("/api/users", (req, res) => {
  const sql = `
    SELECT 
      id,
      full_name AS name,
      email,
      username,
      role,
      status
    FROM users
    WHERE role != 'SUPER_ADMIN'
  `;

  db.query(sql, (err, result) => {
    if (err) return res.status(500).json(err);
    res.json(result);
  });
});

// 🔥 CREATE USER
app.post("/api/users", async (req, res) => {
  const { name, email, username, password, role } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const sql = `
      INSERT INTO users (full_name, email, username, password, role, status)
      VALUES (?, ?, ?, ?, ?, 'Active')
    `;

    db.query(
      sql,
      [name, email, username, hashedPassword, role],
      (err) => {
        if (err) return res.status(500).json(err);
        res.json({ message: "User created" });
      }
    );
  } catch {
    res.status(500).json({ message: "Error" });
  }
});

// 🔥 RESET PASSWORD
app.put("/api/users/reset/:id", async (req, res) => {
  const { password } = req.body;
  const { id } = req.params;

  const hashed = await bcrypt.hash(password, 10);

  db.query(
    "UPDATE users SET password=? WHERE id=?",
    [hashed, id],
    (err) => {
      if (err) return res.status(500).json(err);
      res.json({ message: "Password updated" });
    }
  );
});

// 🔥 TOGGLE STATUS
app.put("/api/users/toggle/:id", (req, res) => {
  const { id } = req.params;

  const sql = `
    UPDATE users
    SET status = IF(status='Active','Inactive','Active')
    WHERE id = ?
  `;

  db.query(sql, [id], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ message: "Status toggled" });
  });
});

// 🔥 START
app.listen(5000, () => {
  console.log("Server running on port 5000 🔥");
});