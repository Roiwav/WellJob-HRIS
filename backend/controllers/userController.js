const db = require("../config/db");
const bcrypt = require("bcrypt");
const { logAudit } = require("../utils/auditLogger");
const {
  generatePassword,
  isValidName,
  generateAccountCredentials,
} = require("../utils/helpers");

// ✅ GET USERS
exports.getUsers = async (req, res) => {
  try {
    const [users] = await db.promise().query(
      `SELECT id, user_id, full_name, username, role, status
       FROM users
       ORDER BY id DESC`
    );

    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Fetch users error" });
  }
};

// ✅ CREATE USER
exports.createUser = async (req, res) => {
  const { name, role } = req.body;

  try {
    const trimmedName = String(name || "").trim();

    if (!trimmedName) {
      return res.status(400).json({ message: "Full name is required" });
    }

    if (!isValidName(trimmedName)) {
      return res.status(400).json({
        message: "Full name must contain letters only",
      });
    }

    const { userId, username } = await generateAccountCredentials(role);

    const tempPassword = generatePassword(8);
    const hash = await bcrypt.hash(tempPassword, 10);

    await db.promise().query(
      `INSERT INTO users 
      (user_id, full_name, username, password, role, status, must_change_password)
      VALUES (?, ?, ?, ?, ?, 'Active', 1)`,
      [userId, trimmedName, username, hash, role]
    );

    await logAudit({
      userId,
      username,
      role,
      action: "CREATE_USER",
      description: `Created account for ${trimmedName}`,
    });

    res.status(201).json({
      message: "User created",
      temporaryPassword: tempPassword,
      account: { userId, username, role },
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Create user error" });
  }
};

// ✅ RESET PASSWORD
exports.resetPassword = async (req, res) => {
  const { id } = req.params;

  try {
    const [users] = await db.promise().query(
      "SELECT * FROM users WHERE id = ?",
      [id]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = users[0];

    const tempPassword = generatePassword(8);
    const hash = await bcrypt.hash(tempPassword, 10);

    await db.promise().query(
      "UPDATE users SET password=?, must_change_password=1 WHERE id=?",
      [hash, id]
    );

    await logAudit({
      userId: user.user_id,
      username: user.username,
      role: user.role,
      action: "RESET_PASSWORD",
    });

    res.json({
      message: "Password reset",
      temporaryPassword: tempPassword,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Reset error" });
  }
};

// ✅ TOGGLE STATUS
exports.toggleStatus = async (req, res) => {
  const { id } = req.params;

  try {
    const [users] = await db.promise().query(
      "SELECT * FROM users WHERE id=?",
      [id]
    );

    if (users.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = users[0];
    const newStatus = user.status === "Active" ? "Inactive" : "Active";

    await db.promise().query(
      "UPDATE users SET status=? WHERE id=?",
      [newStatus, id]
    );

    await logAudit({
      userId: user.user_id,
      username: user.username,
      role: user.role,
      action: "TOGGLE_STATUS",
      description: `Changed to ${newStatus}`,
    });

    res.json({ status: newStatus });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Toggle error" });
  }
};