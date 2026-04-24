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
};

const USERNAME_PREFIX = {
  HR_STAFF: "hr",
  HR_MANAGER: "hm",
  IT_SUPPORT: "it",
};

const ALLOWED_CREATABLE_ROLES = ["HR_STAFF", "HR_MANAGER", "IT_SUPPORT"];

const AUDIT_CATEGORY = {
  TECHNICAL: "TECHNICAL",
  OPERATIONAL: "OPERATIONAL",
};

// =========================
// DB HELPER
// =========================
const query = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });

// =========================
// AUDIT LOGGER
// =========================
async function logAudit(data) {
  try {
    await query(
      `INSERT INTO audit_logs 
       (user_id, username, role, category, action, description)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        data.userId || null,
        data.username || null,
        data.role || null,
        data.category || AUDIT_CATEGORY.TECHNICAL,
        data.action || "UNKNOWN_ACTION",
        data.description || "",
      ]
    );
  } catch (err) {
    console.error("Audit error:", err);
  }
}

// =========================
// HELPERS
// =========================
function generatePassword(length = 8) {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const symbols = "!@#$%^&*()_+";

  let password = "";
  password += upper[Math.floor(Math.random() * upper.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];

  const allChars = upper + lower + numbers + symbols;

  while (password.length < length) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  return password
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
}

function isValidName(name) {
  return /^[A-Za-z\s.'-]+$/.test(name);
}

async function generateAccountCredentials(role) {
  const userPrefix = ROLE_PREFIX[role];
  const usernamePrefix = USERNAME_PREFIX[role];

  const users = await query(
    "SELECT user_id FROM users WHERE role = ? AND user_id LIKE ?",
    [role, `${userPrefix}%`]
  );

  const maxNumber = users.reduce((max, user) => {
    const numericPart = String(user.user_id || "").replace(userPrefix, "");
    const parsed = parseInt(numericPart, 10);
    return Number.isNaN(parsed) ? max : Math.max(max, parsed);
  }, 0);

  const nextNumber = maxNumber + 1;
  const padded = String(nextNumber).padStart(2, "0");

  return {
    userId: `${userPrefix}${padded}`,
    username: `${usernamePrefix}${padded}`,
  };
}

// =========================
// LOGIN
// =========================
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    if (!username || !password) {
      return res.status(400).json({
        message: "Username and password are required",
      });
    }

    const result = await query(
      "SELECT * FROM users WHERE username = ? LIMIT 1",
      [username]
    );

    if (result.length === 0) {
      await logAudit({
        category: AUDIT_CATEGORY.TECHNICAL,
        action: "LOGIN_FAILED",
        description: `Login failed. Username ${username} not found.`,
      });

      return res.status(401).json({ message: "User not found" });
    }

    const user = result[0];

    if (user.status !== "Active") {
      await logAudit({
        userId: user.user_id,
        username: user.username,
        role: user.role,
        category: AUDIT_CATEGORY.TECHNICAL,
        action: "LOGIN_FAILED",
        description: "Login failed. Account is inactive.",
      });

      return res.status(403).json({
        message: "Account is inactive",
      });
    }

    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      await logAudit({
        userId: user.user_id,
        username: user.username,
        role: user.role,
        category: AUDIT_CATEGORY.TECHNICAL,
        action: "LOGIN_FAILED",
        description: "Login failed. Invalid password.",
      });

      return res.status(401).json({ message: "Invalid password" });
    }

    await logAudit({
      userId: user.user_id,
      username: user.username,
      role: user.role,
      category: AUDIT_CATEGORY.TECHNICAL,
      action: "LOGIN_SUCCESS",
      description: "User logged in successfully.",
    });

    const token = jwt.sign(
      {
        id: user.id,
        userId: user.user_id,
        username: user.username,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    return res.json({
      token,
        user: {
          id: user.id,
          userId: user.user_id,
          username: user.username,
          fullName: user.full_name,
          role: user.role,
          mustChangePassword: Boolean(user.must_change_password),
        },
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ message: "Login error" });
  }
});

// =========================
// GET USERS
// =========================
app.get("/api/users", async (req, res) => {
  try {
    const users = await query(
      `SELECT id, user_id, full_name, username, role, status
       FROM users
       ORDER BY id DESC`
    );

    return res.json(users);
  } catch (err) {
    console.error("Fetch users error:", err);
    return res.status(500).json({ message: "Fetch users error" });
  }
});

// =========================
// CREATE USER
// =========================
app.post("/api/users", async (req, res) => {
  const { name, role } = req.body;

  try {
    const trimmedName = String(name || "").trim();

    if (!trimmedName) {
      return res.status(400).json({
        message: "Full name is required",
      });
    }

    if (!isValidName(trimmedName)) {
      return res.status(400).json({
        message: "Full name must contain letters only",
      });
    }

    if (role === "SUPER_ADMIN") {
      await logAudit({
        category: AUDIT_CATEGORY.TECHNICAL,
        action: "CREATE_SUPER_ADMIN_BLOCKED",
        description:
          "Blocked attempt to create another Super Admin account through API.",
      });

      return res.status(403).json({
        message:
          "Super Admin account is system-initialized and cannot be created manually.",
      });
    }

    if (!ALLOWED_CREATABLE_ROLES.includes(role)) {
      return res.status(400).json({
        message: "Invalid role selected",
      });
    }

    const existingName = await query(
      "SELECT id FROM users WHERE LOWER(full_name) = LOWER(?) LIMIT 1",
      [trimmedName]
    );

    if (existingName.length > 0) {
      return res.status(400).json({
        message: "Employee with this name already exists",
      });
    }

    const { userId, username } = await generateAccountCredentials(role);

    const existingAccount = await query(
      "SELECT id FROM users WHERE user_id = ? OR username = ? LIMIT 1",
      [userId, username]
    );

    if (existingAccount.length > 0) {
      return res.status(409).json({
        message: "Generated account already exists. Please try again.",
      });
    }

    const temporaryPassword = generatePassword(8);
    const hash = await bcrypt.hash(temporaryPassword, 10);

    await query(
      `INSERT INTO users 
      (user_id, full_name, username, password, role, status, must_change_password)
      VALUES (?, ?, ?, ?, ?, 'Active', 1)`,
      [userId, trimmedName, username, hash, role]
    );

    await logAudit({
      userId,
      username,
      role,
      category: AUDIT_CATEGORY.TECHNICAL,
      action: "CREATE_USER",
      description: `Created account for ${trimmedName}.`,
    });

    return res.status(201).json({
      message: "Account created successfully",
      temporaryPassword,
      account: {
        userId,
        username,
        fullName: trimmedName,
        role,
        status: "Active",
      },
    });
  } catch (err) {
    console.error("Create user error:", err);
    return res.status(500).json({ message: "Create user error" });
  }
});

// =========================
// RESET PASSWORD
// =========================
app.put("/api/users/reset/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const users = await query(
      "SELECT id, user_id, username, role FROM users WHERE id = ? LIMIT 1",
      [id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const user = users[0];

    const temporaryPassword = generatePassword(8);
    const hash = await bcrypt.hash(temporaryPassword, 10);

    await query(
      "UPDATE users SET password = ?, must_change_password = 1 WHERE id = ?",
      [hash, id]
    );
    await logAudit({
      userId: user.user_id,
      username: user.username,
      role: user.role,
      category: AUDIT_CATEGORY.TECHNICAL,
      action: "RESET_PASSWORD",
      description: `Reset password for ${user.username}.`,
    });

    return res.json({
      message: "Password reset successfully",
      temporaryPassword,
      password: temporaryPassword,
    });
  } catch (err) {
    console.error("Reset password error:", err);
    return res.status(500).json({ message: "Reset password error" });
  }
});

// =========================
// CHANGE PASSWORD / FORCE CHANGE PASSWORD
// =========================
app.put("/api/users/change-password", async (req, res) => {
  const { userId, currentPassword, newPassword } = req.body;

  try {
    if (!userId || !currentPassword || !newPassword) {
      return res.status(400).json({
        message: "User ID, current password, and new password are required",
      });
    }

    if (String(newPassword).length < 8) {
      return res.status(400).json({
        message: "New password must be at least 8 characters long",
      });
    }

    const users = await query(
      "SELECT * FROM users WHERE user_id = ? LIMIT 1",
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const user = users[0];

    const match = await bcrypt.compare(currentPassword, user.password);

    if (!match) {
      return res.status(401).json({
        message: "Current password is incorrect",
      });
    }

    const isSamePassword = await bcrypt.compare(newPassword, user.password);

    if (isSamePassword) {
      return res.status(400).json({
        message: "New password must be different from the current password",
      });
    }

    const hash = await bcrypt.hash(newPassword, 10);

    await query(
      "UPDATE users SET password = ?, must_change_password = 0 WHERE user_id = ?",
      [hash, userId]
    );

    await logAudit({
      userId: user.user_id,
      username: user.username,
      role: user.role,
      category: AUDIT_CATEGORY.TECHNICAL,
      action: "CHANGE_PASSWORD",
      description: `Password changed successfully for ${user.username}.`,
    });

    return res.json({
      message: "Password changed successfully",
    });
  } catch (err) {
    console.error("Change password error:", err);
    return res.status(500).json({
      message: "Change password error",
    });
  }
});

// =========================
// AUDIT FETCH
// =========================
app.get("/api/audit-logs/:category", async (req, res) => {
  try {
    const { category } = req.params;

    const logs = await query(
      `SELECT *
       FROM audit_logs
       WHERE category = ?
       ORDER BY created_at DESC`,
      [category]
    );

    return res.json(logs);
  } catch (err) {
    console.error("Fetch audit logs error:", err);
    return res.status(500).json({ message: "Fetch audit logs error" });
  }
});

// =========================
// FRONTEND AUDIT TRIGGER
// =========================
app.post("/api/audit-logs", async (req, res) => {
  try {
    await logAudit(req.body);

    return res.json({
      message: "Logged successfully",
    });
  } catch (err) {
    console.error("Audit trigger error:", err);
    return res.status(500).json({ message: "Audit trigger error" });
  }
});

// =========================
// SERVER
// =========================
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});