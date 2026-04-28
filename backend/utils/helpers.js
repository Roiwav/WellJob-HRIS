const db = require("../config/db");

// 🔥 GENERATE RANDOM PASSWORD
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

// 🔥 NAME VALIDATION
function isValidName(name) {
  return /^[A-Za-z\s.'-]+$/.test(name);
}

// 🔥 GENERATE ACCOUNT (HR01, HM01, etc.)
async function generateAccountCredentials(role) {
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

  const userPrefix = ROLE_PREFIX[role];
  const usernamePrefix = USERNAME_PREFIX[role];

  const [users] = await db.promise().query(
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

module.exports = {
  generatePassword,
  isValidName,
  generateAccountCredentials,
};