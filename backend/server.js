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
  if (err) {
    console.error("Database connection failed:", err);
  } else {
    console.log("MySQL Connected");
  }
});

// =========================
// HELPERS
// =========================
const ROLE_PREFIX = {
  HR_STAFF: "HR",
  HR_MANAGER: "HM",
  IT_SUPPORT: "IT",
  SUPER_ADMIN: "SA",
};

function generateStrongPassword(length = 8) {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const symbols = "!@#$%^&*()_+";

  let password = "";

  // required characters
  password += upper[Math.floor(Math.random() * upper.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += lower[Math.floor(Math.random() * lower.length)];

  const allChars = upper + lower + numbers + symbols;

  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  return password
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
}

function isStrongPassword(password) {
  return (
    typeof password === "string" &&
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[!@#$%^&*()_+]/.test(password)
  );
}

function generateNextUserId(role, callback) {
  const prefix = ROLE_PREFIX[role];

  if (!prefix) {
    return callback(new Error("Invalid role"));
  }

  const sql = `
    SELECT user_id
    FROM users
    WHERE role = ? AND user_id IS NOT NULL AND user_id != ''
    ORDER BY id DESC
    LIMIT 1
  `;

  db.query(sql, [role], (err, result) => {
    if (err) return callback(err);

    let nextNumber = 1;

    if (result.length > 0 && result[0].user_id) {
      const latestUserId = result[0].user_id;
      const numericPart = latestUserId.replace(prefix, "");
      const parsedNumber = parseInt(numericPart, 10);

      if (!Number.isNaN(parsedNumber)) {
        nextNumber = parsedNumber + 1;
      }
    }

    const paddedNumber = String(nextNumber).padStart(2, "0");
    const userId = `${prefix}${paddedNumber}`;
    const username = `${prefix.toLowerCase()}${paddedNumber}`;

    callback(null, { userId, username });
  });
}

// =========================
// TEST ROUTE
// =========================
app.get("/", (req, res) => {
  res.json("Backend is running 🚀");
});

// =========================
// LOGIN
// =========================
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      message: "Username and password are required.",
    });
  }

  const sql = "SELECT * FROM users WHERE username = ? LIMIT 1";

  db.query(sql, [username], async (err, result) => {
    if (err) return res.status(500).json({ message: "Database error." });

    if (result.length === 0) {
      return res.status(401).json({ message: "User not found" });
    }

    const user = result[0];

    if (user.status === "Inactive") {
      return res.status(403).json({
        message: "Account is inactive. Please contact IT support.",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid password" });
    }

    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
      },
      "secretkey",
      { expiresIn: "1d" }
    );

    res.json({
      token,
      user: {
        id: user.id,
        userId: user.user_id,
        name: user.full_name,
        username: user.username,
        role: user.role,
        status: user.status,
        mustChangePassword: !!user.must_change_password,
      },
    });
  });
});

// =========================
// GET USERS
// =========================
app.get("/api/users", (req, res) => {
  const sql = `
    SELECT
      id,
      user_id,
      full_name,
      username,
      role,
      status,
      must_change_password
    FROM users
    WHERE role != 'SUPER_ADMIN'
    ORDER BY id DESC
  `;

  db.query(sql, (err, result) => {
    if (err) return res.status(500).json({ message: "Database error." });
    res.json(result);
  });
});

// =========================
// PREVIEW NEXT ACCOUNT
// =========================
app.get("/api/users/next-id/:role", (req, res) => {
  const { role } = req.params;

  generateNextUserId(role, (err, generated) => {
    if (err) {
      return res.status(400).json({ message: "Invalid role" });
    }

    res.json(generated);
  });
});

// =========================
// CREATE USER
// =========================
app.post("/api/users", (req, res) => {
  const { name, role } = req.body;

  if (!name || !role) {
    return res.status(400).json({
      message: "Full name and role are required.",
    });
  }

  const trimmedName = name.trim();

  if (!/^[A-Za-z\s.'-]+$/.test(trimmedName)) {
    return res.status(400).json({
      message: "Full name must contain letters only.",
    });
  }

  if (!ROLE_PREFIX[role]) {
    return res.status(400).json({
      message: "Invalid role selected.",
    });
  }

  generateNextUserId(role, async (err, generated) => {
    if (err) {
      console.error(err);
      return res.status(500).json({
        message: "Failed to generate user ID.",
      });
    }

    const { userId, username } = generated;
    const plainPassword = generateStrongPassword();

    try {
      const hashedPassword = await bcrypt.hash(plainPassword, 10);

      const checkSql = `
        SELECT id
        FROM users
        WHERE user_id = ? OR username = ?
        LIMIT 1
      `;

      db.query(checkSql, [userId, username], (checkErr, checkResult) => {
        if (checkErr) {
          console.error(checkErr);
          return res.status(500).json({
            message: "Database check failed.",
          });
        }

        if (checkResult.length > 0) {
          return res.status(409).json({
            message: "Generated account already exists. Please try again.",
          });
        }

        const insertSql = `
          INSERT INTO users
            (user_id, full_name, username, password, role, status, must_change_password)
          VALUES
            (?, ?, ?, ?, ?, 'Active', 1)
        `;

        db.query(
          insertSql,
          [userId, trimmedName, username, hashedPassword, role],
          (insertErr, result) => {
            if (insertErr) {
              console.error(insertErr);
              return res.status(500).json({
                message: "Failed to create user.",
              });
            }

            res.json({
              message: "User created successfully.",
              account: {
                id: result.insertId,
                userId,
                fullName: trimmedName,
                username,
                role,
                status: "Active",
                mustChangePassword: true,
              },
              temporaryPassword: plainPassword,
            });
          }
        );
      });
    } catch (hashErr) {
      console.error(hashErr);
      return res.status(500).json({
        message: "Failed to hash password.",
      });
    }
  });
});

// =========================
// CHANGE PASSWORD
// =========================
app.put("/api/change-password", (req, res) => {
  const { userId, currentPassword, newPassword } = req.body;

  if (!userId || !currentPassword || !newPassword) {
    return res.status(400).json({
      message: "All fields are required.",
    });
  }

  if (!isStrongPassword(newPassword)) {
    return res.status(400).json({
      message:
        "Password must be at least 8 characters and include uppercase, lowercase, number, and allowed special character.",
    });
  }

  const sql = "SELECT * FROM users WHERE id = ? LIMIT 1";

  db.query(sql, [userId], async (err, result) => {
    if (err) return res.status(500).json({ message: "Database error." });

    if (result.length === 0) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    const user = result[0];

    const isMatch = await bcrypt.compare(currentPassword, user.password);

    if (!isMatch) {
      return res.status(401).json({
        message: "Current password is incorrect.",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const updateSql = `
      UPDATE users
      SET password = ?, must_change_password = 0
      WHERE id = ?
    `;

    db.query(updateSql, [hashedPassword, userId], (updateErr) => {
      if (updateErr) {
        return res.status(500).json({
          message: "Failed to update password.",
        });
      }

      res.json({
        message: "Password changed successfully.",
      });
    });
  });
});

// =========================
// RESET PASSWORD
// =========================
app.put("/api/users/reset/:id", async (req, res) => {
  const { id } = req.params;

  const plainPassword = generateStrongPassword();

  try {
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    const sql = `
      UPDATE users
      SET password = ?, must_change_password = 1
      WHERE id = ?
    `;

    db.query(sql, [hashedPassword, id], (err) => {
      if (err) return res.status(500).json({ message: "Database error." });

      res.json({
        message: "Password reset successfully.",
        temporaryPassword: plainPassword,
      });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Failed to reset password.",
    });
  }
});

// =========================
// TOGGLE USER STATUS
// =========================
app.put("/api/users/toggle/:id", (req, res) => {
  const { id } = req.params;

  const sql = `
    UPDATE users
    SET status = IF(status='Active','Inactive','Active')
    WHERE id = ?
  `;

  db.query(sql, [id], (err) => {
    if (err) return res.status(500).json({ message: "Database error." });

    res.json({
      message: "Status toggled successfully.",
    });
  });
});

// =========================
// START SERVER
// =========================
app.listen(5000, () => {
  console.log("Server running on port 5000");
});