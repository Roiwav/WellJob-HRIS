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

    if (users.length === 0) {
      return res.status(401).json({ message: "User not found" });
    }

    const user = users[0];

    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(401).json({ message: "Invalid password" });
    }

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
      role: user.role,
      action: "LOGIN_SUCCESS",
    });

    res.json({ token, user });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Login error" });
  }
};