"use strict";
const crypto = require("node:crypto");

function normalizeRecoveryEmail(input) {
  if (typeof input !== "string") return null;
  const email = input.trim().toLowerCase();
  if (email.length > 254 || email.length < 3) return null;
  if (!/^[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(email)) return null;
  const domain = email.split("@")[1];
  if (domain.split(".").some((part) => part.startsWith("-") || part.endsWith("-"))) return null;
  return email;
}

function isStrongPassword(password) {
  return typeof password === "string" &&
    password.length >= 8 && password.length <= 128 &&
    /[A-Z]/.test(password) && /[a-z]/.test(password) &&
    /[0-9]/.test(password) && /[!@#$%^&*()_+]/.test(password);
}

function newToken() { return crypto.randomBytes(32).toString("hex"); }
function hashToken(token) { return crypto.createHash("sha256").update(token, "utf8").digest("hex"); }

module.exports = { normalizeRecoveryEmail, isStrongPassword, newToken, hashToken };
