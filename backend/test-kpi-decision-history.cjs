require("dotenv").config();

const jwt = require("jsonwebtoken");
const db = require("./config/db");

(async () => {
  const started = Date.now();

  try {
    const [users] = await db.promise().query(`
      SELECT
        id,
        user_id,
        username,
        role,
        token_version
      FROM users
      WHERE role = 'HR_STAFF'
        AND status = 'Active'
      LIMIT 1
    `);

    const user = users[0];

    if (!user) {
      throw new Error("No active HR_STAFF user found.");
    }

    const token = jwt.sign(
      {
        id: user.id,
        userId: user.user_id,
        username: user.username,
        role: user.role,
        tokenVersion: user.token_version,
      },
      process.env.JWT_SECRET,
      {
        algorithm: "HS256",
        expiresIn: "5m",
      }
    );

    const response = await fetch(
      "http://localhost:5000/api/kpi/decision-history?view=history&page=1&pageSize=25&search=&decisionType=ALL",
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      }
    );

    const raw = await response.text();

    console.log("HTTP:", response.status);
    console.log("Time:", `${Date.now() - started} ms`);
    console.log(
      "Payload:",
      `${(Buffer.byteLength(raw) / 1024).toFixed(1)} KB`
    );

    if (!response.ok) {
      console.log("Response body:", raw);
      process.exit();
    }

    const data = JSON.parse(raw);

    console.log(
      "Records:",
      Array.isArray(data.records)
        ? data.records.length
        : 0
    );

    console.log(
      "Pagination:",
      data.pagination
    );

    console.log(
      "Summary:",
      data.summary
    );

    console.log(
      "Filters:",
      data.filters
    );
  } catch (error) {
    console.error("TEST ERROR:", error.message);
  } finally {
    process.exit();
  }
})();
