// userController.js

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

    return res.json(users);
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      message: "Fetch users error",
    });
  }
};

// ✅ CREATE USER
exports.createUser = async (req, res) => {
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

    const { userId, username } =
      await generateAccountCredentials(role);

    const tempPassword = generatePassword(8);
    const hash = await bcrypt.hash(tempPassword, 10);

    await db.promise().query(
      `INSERT INTO users
       (user_id, full_name, username, password, role, status, must_change_password)
       VALUES (?, ?, ?, ?, ?, 'Active', 1)`,
      [
        userId,
        trimmedName,
        username,
        hash,
        role,
      ]
    );

    await logAudit({
      userId,
      username,
      role,
      action: "CREATE_USER",
      description: `Created account for ${trimmedName}`,
    });

    return res.status(201).json({
      message: "User created",
      temporaryPassword: tempPassword,
      account: {
        userId,
        username,
        role,
      },
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      message: "Create user error",
    });
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
      return res.status(404).json({
        message: "User not found",
      });
    }

    const user = users[0];

    const tempPassword = generatePassword(8);
    const hash = await bcrypt.hash(tempPassword, 10);

    await db.promise().query(
      "UPDATE users SET password = ?, must_change_password = 1 WHERE id = ?",
      [hash, id]
    );

    await logAudit({
      userId: user.user_id,
      username: user.username,
      role: user.role,
      action: "RESET_PASSWORD",
    });

    return res.json({
      message: "Password reset",
      temporaryPassword: tempPassword,
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      message: "Reset error",
    });
  }
};

// ✅ TOGGLE STATUS
exports.toggleStatus = async (req, res) => {
  const { id } = req.params;

  try {
    const [users] = await db.promise().query(
      "SELECT * FROM users WHERE id = ?",
      [id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    const user = users[0];

    const newStatus =
      user.status === "Active"
        ? "Inactive"
        : "Active";

    await db.promise().query(
      "UPDATE users SET status = ? WHERE id = ?",
      [newStatus, id]
    );

    await logAudit({
      userId: user.user_id,
      username: user.username,
      role: user.role,
      action: "TOGGLE_STATUS",
      description: `Changed to ${newStatus}`,
    });

    return res.json({
      status: newStatus,
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      message: "Toggle error",
    });
  }
};

// ✅ CHANGE OWN PASSWORD
exports.changePassword = async (req, res) => {
  /*
   * SECURITY:
   * The account identity comes only from req.user.
   *
   * Do NOT trust these for authority:
   * - req.body.userId
   * - req.body.id
   * - req.body.username
   *
   * Those values may still be sent by an older frontend,
   * but they are intentionally ignored here.
   */
  const authenticatedUserId =
    req.user?.id ?? req.user?.userId;

  const {
    currentPassword,
    newPassword,
  } = req.body;

  if (
    authenticatedUserId === undefined ||
    authenticatedUserId === null ||
    String(authenticatedUserId).trim() === ""
  ) {
    return res.status(401).json({
      success: false,
      message:
        "A verified authenticated user is required.",
    });
  }

  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      message:
        "Current password and new password are required.",
    });
  }

  try {
    /*
     * Find the account using the verified JWT identity.
     * We no longer select the account using request-body IDs.
     */
    const [users] = await db.promise().query(
      `SELECT *
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [authenticatedUserId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const user = users[0];

    // Verify the user's current password.
    const isMatch = await bcrypt.compare(
      currentPassword,
      user.password
    );

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Incorrect current password",
      });
    }

    // Hash the new password.
    const hash = await bcrypt.hash(
      newPassword,
      10
    );

    // Save new password and clear forced-change flag.
    await db.promise().query(
      `UPDATE users
       SET password = ?,
           must_change_password = 0
       WHERE id = ?`,
      [hash, user.id]
    );

    await logAudit({
      userId: user.user_id,
      username: user.username,
      role: user.role,
      action: "CHANGE_PASSWORD",
      description:
        "User successfully changed their password",
    });

    return res.json({
      success: true,
      message:
        "Password updated successfully",
    });
  } catch (err) {
    console.error(
      "Change Password Error:",
      err
    );

    return res.status(500).json({
      success: false,
      message: "Error changing password",
    });
  }
};