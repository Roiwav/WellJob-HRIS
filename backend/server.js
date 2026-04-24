const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();

app.use(cors());
app.use(express.json());

// =========================
// DB CONNECTION
// =========================
const db = mysql.createConnection({
  host: "100.119.171.111",
  user: "remoteuser",
  password: "",
  database: "welljob_db",
});

db.connect((err) => {
  if (err) console.error("DB Error:", err);
  else console.log("MySQL Connected");
});

// =========================
// CONSTANTS
// =========================
const PORT = 5000;
const JWT_SECRET = "secretkey";

const ROLE_PREFIX = {
  HR_STAFF: "HR",
  HR_MANAGER: "HM",
  IT_SUPPORT: "IT",
  SUPER_ADMIN: "SA",
};

const AUDIT_CATEGORY = {
  TECHNICAL: "TECHNICAL",
  OPERATIONAL: "OPERATIONAL",
};

// =========================
// DB HELPER
// =========================
const query = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, res) => {
      if (err) reject(err);
      else resolve(res);
    });
  });

// =========================
// AUDIT LOGGER
// =========================
async function logAudit(data) {
  try {
    await query(
      `INSERT INTO audit_logs (user_id, username, full_name, role, category, action, description)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        data.userId || null,
        data.username || null,
        data.role || null,
        
        data.category,
        data.action,
        data.description,
      ]
    );
  } catch (err) {
    console.error("Audit error:", err);
  }
}

// =========================
// HELPERS
// =========================
function generatePassword() {
  return Math.random().toString(36).slice(-8) + "A1!";
}

// =========================
// LOGIN
// =========================
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await query(
      "SELECT * FROM users WHERE username = ? LIMIT 1",
      [username]
    );

    if (result.length === 0) {
      await logAudit({
        category: "TECHNICAL",
        action: "LOGIN_FAILED",
        description: `User ${username} not found`,
      });
      return res.status(401).json({ message: "User not found" });
    }

    const user = result[0];

    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      await logAudit({
        userId: user.user_id,
        username: user.username,
        role: user.role,
        category: "TECHNICAL",
        action: "LOGIN_FAILED",
        description: "Invalid password",
      });
      return res.status(401).json({ message: "Invalid password" });
    }

    await logAudit({
      userId: user.user_id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
      category: "TECHNICAL",
      action: "LOGIN_SUCCESS",
      description: "User logged in",
    });

    const token = jwt.sign({ id: user.id }, JWT_SECRET);

    res.json({
      token,
      user: {
        id: user.id,
        userId: user.user_id,
        full_name: user.full_name,
        username: user.username,
        role: user.role,
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Login error" });
  }
});

// =========================
// 🔥 GET USERS (FIX)
// =========================
app.get("/api/users", async (req, res) => {
  try {
    const users = await query(
      "SELECT id, user_id, full_name, username, role, status FROM users"
    );
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Fetch users error" });
  }
});

// =========================
// CREATE USER (🔥 WITH DUPLICATE CHECK)
// =========================
app.post("/api/users", async (req, res) => {
  const { name, role } = req.body;

  try {
    // 🔥 DUPLICATE NAME CHECK
    const existing = await query(
      "SELECT * FROM users WHERE full_name = ?",
      [name]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        message: "Employee with this name already exists",
      });
    }

    const prefix = ROLE_PREFIX[role];
    const userId = prefix + Date.now().toString().slice(-2);
    const username = prefix.toLowerCase() + Date.now().toString().slice(-2);

    const password = generatePassword();
    const hash = await bcrypt.hash(password, 10);

    await query(
      `INSERT INTO users (user_id, full_name, username, password, role, status)
       VALUES (?, ?, ?, ?, ?, 'Active')`,
      [userId, name, username, hash, role]
    );

    await logAudit({
      userId,
      username,
      role,
      category: "TECHNICAL",
      action: "CREATE_USER",
      description: `Created account for ${name}`,
    });

    res.json({ password });
  } catch (err) {
    res.status(500).json({ message: "Create error" });
  }
});

// =========================
// RESET PASSWORD
// =========================
app.put("/api/users/reset/:id", async (req, res) => {
  const { id } = req.params;

  const newPass = generatePassword();
  const hash = await bcrypt.hash(newPass, 10);

  await query("UPDATE users SET password=? WHERE id=?", [hash, id]);

  await logAudit({
    category: "TECHNICAL",
    action: "RESET_PASSWORD",
    description: `Reset password user ${id}`,
  });

  res.json({ password: newPass });
});

// =========================
// AUDIT FETCH
// =========================
app.get("/api/audit-logs/:category", async (req, res) => {
  const logs = await query(
    `SELECT 
        audit_logs.*,
        users.full_name
     FROM audit_logs
     LEFT JOIN users 
     ON audit_logs.username = users.username
     WHERE audit_logs.category = ?
     ORDER BY audit_logs.created_at DESC`,
    [req.params.category]
  );

  res.json(logs);
});

// =========================
// FRONTEND AUDIT TRIGGER
// =========================
app.post("/api/audit-logs", async (req, res) => {
  await logAudit(req.body);
  res.json({ message: "Logged" });
});

// =========================
// SERVER
// =========================
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});