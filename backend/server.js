const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();

// 🔥 MIDDLEWARE
app.use(cors());
app.use(express.json());

// 🔥 DATABASE CONNECTION
const db = mysql.createConnection({
  host: "localhost",   
  user: "welljobuser",
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

// 🔥 TEST ROUTE
app.get("/", (req, res) => {
  return res.json("Backend is running 🚀");
});

// 🔐 LOGIN API
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;

  const sql = "SELECT * FROM users WHERE username = ?";

  db.query(sql, [username], async (err, result) => {
    if (err) return res.status(500).json(err);

    if (result.length === 0) {
      return res.status(401).json({ message: "User not found" });
    }

    const user = result[0];

    // 🔥 COMPARE PASSWORD
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid password" });
    }

    // 🔐 CREATE TOKEN
    const token = jwt.sign(
      { id: user.id, role: user.role },
      "secretkey",
      { expiresIn: "1d" }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.full_name,
        role: user.role,
      },
    });
  });
});

app.get("/api/users", (req, res) => {
  const sql = `
    SELECT 
      id,
      full_name AS name,
      email,
      username,
      role,
      'Active' AS status
    FROM users
    WHERE role != 'SUPER_ADMIN'
  `;

  db.query(sql, (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json(err);
    }

    res.json(result);
  });
});

// 🔥 CREATE USER
app.post("/api/users", async (req, res) => {
  const { name, email, username, password, role } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const sql = `
      INSERT INTO users (full_name, email, username, password, role)
      VALUES (?, ?, ?, ?, ?)
    `;

    db.query(
      sql,
      [name, email, username, hashedPassword, role],
      (err, result) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ message: "Error creating user" });
        }

        res.json({ message: "User created successfully" });
      }
    );
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// 🔥 START SERVER (IMPORTANT PORT)
app.listen(5000, () => {
  console.log("Server running on port 5000 🔥");
});