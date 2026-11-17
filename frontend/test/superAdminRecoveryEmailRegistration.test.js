import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const componentSource = fs.readFileSync(
  new URL(
    "../src/components/auth/RecoveryEmailVerificationAction.jsx",
    import.meta.url
  ),
  "utf8"
);
const profileSource = fs.readFileSync(
  new URL("../src/pages/ProfileSettings.jsx", import.meta.url),
  "utf8"
);
const loginSource = fs.readFileSync(
  new URL("../src/pages/Login.jsx", import.meta.url),
  "utf8"
);
const navbarSource = fs.readFileSync(
  new URL("../src/components/Navbar.jsx", import.meta.url),
  "utf8"
);

test("unregistered Super Admin receives the owner-only registration form", () => {
  assert.match(componentSource, /isUnregistered && isSuperAdmin/);
  assert.match(componentSource, />\s*Register Recovery Email\s*</);
  assert.match(componentSource, /type="email"/);
  assert.match(componentSource, /maxLength=\{254\}/);
  assert.match(componentSource, /type="password"/);
  assert.match(componentSource, /autoComplete="current-password"/);
});

test("frontend validation requires a valid email and current password", () => {
  assert.match(componentSource, /normalizedEmail\.length > 254/);
  assert.match(componentSource, /EMAIL_PATTERN\.test\(normalizedEmail\)/);
  assert.match(componentSource, /if \(!currentPassword\)/);
  assert.match(componentSource, /currentPassword\.length > 128/);
  assert.match(componentSource, /maxLength=\{128\}/);
  assert.match(componentSource, /Enter your current password\./);
});

test("submission is single-flight and clears password state", () => {
  assert.match(componentSource, /if \(\s*isRegistering \|\|/s);
  assert.match(componentSource, /loading=\{isRegistering\}/);
  assert.match(componentSource, /disabled=\{\s*isRegistering \|\|/s);
  assert.match(componentSource, /finally \{\s*setCurrentPassword\(""\)/s);
  assert.doesNotMatch(componentSource, /localStorage\.setItem\([^\n]*currentPassword/);
});

test("status-loading errors and form-action errors remain separate", () => {
  assert.match(componentSource, /const \[\s*statusError,\s*setStatusError,\s*\] = useState\(""\)/s);
  assert.match(componentSource, /const \[\s*actionError,\s*setActionError,\s*\] = useState\(""\)/s);
  assert.match(componentSource, /data-error-source="status"/);
  assert.match(componentSource, /data-error-source="action"/);
  assert.match(
    componentSource,
    /loadRecoveryEmailStatus[\s\S]*setStatusError\([\s\S]*Unable to load recovery email status/s
  );
  assert.match(
    componentSource,
    /handleRegisterRecoveryEmail[\s\S]*setActionError\([\s\S]*Unable to register the recovery email/s
  );
});

test("editing registration fields and retrying status clear only relevant stale errors", () => {
  assert.match(
    componentSource,
    /setEmail\(event\.target\.value\);\s*setActionError\(""\)/s
  );
  assert.match(
    componentSource,
    /setCurrentPassword\(event\.target\.value\);\s*setActionError\(""\)/s
  );
  assert.match(
    componentSource,
    /handleRetry[\s\S]*setStatusError\(""\);\s*setActionError\(""\)/s
  );
});

test("registration uses only the owner endpoint and sends no role or user ID", () => {
  assert.match(componentSource, /\/users\/me\/recovery-email/);
  assert.match(
    componentSource,
    /body: JSON\.stringify\(\{\s*email: normalizedEmail,\s*currentPassword,\s*\}\)/s
  );
  assert.doesNotMatch(
    componentSource,
    /body: JSON\.stringify\(\{[^}]*\b(?:role|userId|id):/s
  );
});

test("safe errors cover incorrect password, duplicate email, rate limit, and uncertain result", () => {
  assert.match(componentSource, /response\.status === 401/);
  assert.match(componentSource, /response\.status === 409/);
  assert.match(componentSource, /response\.status === 429/);
  assert.match(componentSource, /request result is uncertain/i);
  assert.match(componentSource, /sign in again and review Recovery Email before retrying/i);
});

test("confirmed success clears the session and redirects to username login", () => {
  assert.match(componentSource, /data\?\.registered !== true/);
  assert.match(componentSource, /data\?\.verified !== false/);
  assert.match(componentSource, /data\?\.sessionInvalidated !== true/);
  assert.match(componentSource, /localStorage\.removeItem\("token"\)/);
  assert.match(componentSource, /localStorage\.removeItem\("user"\)/);
  assert.match(componentSource, /setUser\(null\)/);
  assert.match(componentSource, /navigate\("\/login"/);
  assert.match(loginSource, /sessionNotice/);
  assert.match(loginSource, /Username/);
  assert.match(loginSource, /username: username\.trim\(\)/);
});

test("existing verification states remain separate from initial registration", () => {
  assert.match(componentSource, /status === "unverified"/);
  assert.match(componentSource, /Verify Recovery Email/);
  assert.match(componentSource, /REQUEST_URL/);
  assert.match(componentSource, /isVerified/);
  assert.doesNotMatch(componentSource, /setStatus\("verified"\).*register/s);
});

test("ordinary roles retain contact-Super-Admin guidance", () => {
  assert.match(
    componentSource,
    /isSuperAdmin\s*\?\s*"No recovery email is registered\. Add one below[\s\S]*:\s*"No recovery email is registered for your account\. Please contact your Super Admin\."/
  );
  assert.match(
    navbarSource,
    /currentRole === "SUPER_ADMIN"\s*\? "Register it from Account Settings\."\s*:\s*"Contact your Super Admin to register it\."/
  );
});

test("Profile Settings retains avatar, password, and recovery sections", () => {
  assert.match(profileSource, /ProfilePictureActions/);
  assert.match(profileSource, /RecoveryEmailVerificationAction/);
  assert.match(profileSource, /Change Password/);
  assert.match(profileSource, /dark:/);
});