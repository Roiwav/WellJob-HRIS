"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeRecoveryEmail, isStrongPassword, newToken, hashToken } =
  require("../utils/recoveryHelpers");

test("Recovery emails are normalized and invalid formats rejected", () => {
  assert.equal(normalizeRecoveryEmail(" USER@Example.com "), "user@example.com");
  assert.equal(normalizeRecoveryEmail("user@example.com\nBcc:other@example.com"), null);
  assert.equal(normalizeRecoveryEmail("wrong"), null);
  assert.equal(normalizeRecoveryEmail("user@-example.com"), null);
  assert.equal(normalizeRecoveryEmail(null), null);
});

test("Password reset uses the same password complexity policy", () => {
  assert.equal(isStrongPassword("StrongPass8!"), true);
  for (const invalid of ["sh1A!", "lowercase9!", "NOLOWERCASE9!", "NoNumbers!", "NoSpecial9", "a".repeat(129) + "9A!"]) {
    assert.equal(isStrongPassword(invalid), false);
  }
});

test("Recovery tokens are random, well-formed and stored only as a hash", () => {
  const first = newToken();
  const second = newToken();
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.notEqual(first, second);
  assert.match(hashToken(first), /^[a-f0-9]{64}$/);
  assert.notEqual(hashToken(first), first);
  assert.notEqual(hashToken(first), hashToken(second));
});
