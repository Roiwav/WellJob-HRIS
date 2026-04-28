//userController.js

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

// CHANGE PASSWORD
exports.changePassword = async (req, res) => {
  // 🔥 ILALAGAY NATIN ITO PARA MAKITA NATIN SA TERMINAL KUNG ANO ANG SINESEND NG REACT
  console.log("🔥 CHANGE PASSWORD PAYLOAD:", req.body);

  // Kukunin natin lahat ng posibleng ipasa ng frontend
  const { userId, id, username, currentPassword, newPassword } = req.body;
  
  // Gagamitin natin kung alin man ang may laman sa tatlo
  const identifier = userId || id || username; 

  try {
    // 1. Hanapin ang user sa database gamit ang user_id, id, OR username
    const [users] = await db.promise().query(
      "SELECT * FROM users WHERE user_id = ? OR id = ? OR username = ?",
      [identifier, identifier, identifier]
    );

    if (users.length === 0) {
      console.log("❌ USER HINDI NAKITA SA DATABASE. Identifier na ginamit:", identifier);
      return res.status(404).json({ message: "User not found" });
    }

    const user = users[0];

    // 2. I-verify kung tama ang current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Incorrect current password" });
    }

    // 3. I-hash yung bagong password
    const hash = await bcrypt.hash(newPassword, 10);

    // 4. I-save sa database at tanggalin ang "must_change_password" flag
    await db.promise().query(
      "UPDATE users SET password=?, must_change_password=0 WHERE id=?",
      [hash, user.id]
    );

    await logAudit({
      userId: user.user_id,
      username: user.username,
      role: user.role,
      action: "CHANGE_PASSWORD",
      description: "User successfully changed their password"
    });

    res.json({ success: true, message: "Password updated successfully" });

  } catch (err) {
    console.error("Change Password Error:", err);
    res.status(500).json({ message: "Error changing password" });
  }
};