const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../config/db");
const { logAudit } = require("../utils/auditLogger");

const JWT_SECRET = "secretkey";

exports.login = async (req, res) => {
  const { username, password } = req.body;

  try {
    const [users] = await db.promise().query(
      "SELECT * FROM users WHERE username = ? LIMIT 1",
      [username]
    );

    // ❌ FAILED LOGIN 1: HINDI NAKITA ANG USERNAME SA DATABASE
    if (users.length === 0) {
      await logAudit({
        userId: "-",
        username: username,
        full_name: "Unknown User",
        role: "-",
        action: "LOGIN_FAILED",
        description: `Failed login attempt (Unknown username: ${username})`
      });

      return res.status(401).json({ message: "User not found" });
    }

    const user = users[0];

    const match = await bcrypt.compare(password, user.password);

    // ❌ FAILED LOGIN 2: TAMA ANG USERNAME PERO MALI ANG PASSWORD
    if (!match) {
      await logAudit({
        userId: user.user_id,
        username: user.username,
        full_name: user.full_name,
        role: user.role,
        action: "LOGIN_FAILED",
        description: `Failed login attempt for ${user.full_name} (Incorrect Password)`
      });

      return res.status(401).json({ message: "Invalid password" });
    }

    // ✅ SUCCESSFUL LOGIN
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    await logAudit({
      userId: user.user_id,
      username: user.username,
      full_name: user.full_name, 
      role: user.role,
      action: "Login Success",
      description: `${user.full_name} successfully logged into the system` 
    });

    res.json({ token, user });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Login error" });
  }
};