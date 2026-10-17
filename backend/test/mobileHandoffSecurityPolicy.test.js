const test =
  require("node:test");

const assert =
  require("node:assert/strict");

const fs =
  require("node:fs");

const path =
  require("node:path");

const BACKEND_ROOT =
  path.resolve(
    __dirname,
    ".."
  );

function readBackendFile(
  relativePath
) {
  return fs.readFileSync(
    path.join(
      BACKEND_ROOT,
      relativePath
    ),
    "utf8"
  );
}

const controller =
  readBackendFile(
    "controllers/employeeMobileHandoffController.js"
  );

const routes =
  readBackendFile(
    "routes/employeeRoutes.js"
  );

const migration =
  readBackendFile(
    "database/add_employee_mobile_handoffs.sql"
  );

test(
  "mobile handoff tokens are cryptographically random and only SHA-256 hashes are persisted",
  () => {
    assert.match(
      controller,
      /HANDOFF_TOKEN_BYTES\s*=\s*32/
    );

    assert.match(
      controller,
      /randomBytes\s*\(\s*HANDOFF_TOKEN_BYTES\s*\)[\s\S]*?toString\s*\(\s*["']base64url["']\s*\)/
    );

    assert.match(
      controller,
      /createHash\s*\(\s*["']sha256["']\s*\)[\s\S]*?update\s*\(\s*rawToken[\s\S]*?digest\s*\(\s*["']hex["']\s*\)/
    );

    assert.match(
      controller,
      /INSERT INTO employee_mobile_handoffs[\s\S]*?token_hash[\s\S]*?\[\s*tokenHash\s*,\s*employeeId\s*,\s*creatorUserId\s*,\s*HANDOFF_PURPOSE\s*,?\s*\]/
    );

    assert.doesNotMatch(
      controller,
      /INSERT INTO employee_mobile_handoffs[\s\S]{0,1200}\[\s*rawToken\b/
    );
  }
);

test(
  "creating a replacement handoff revokes a prior live handoff and uses a 15-minute database UTC expiry",
  () => {
    assert.match(
      controller,
      /HANDOFF_TTL_MINUTES\s*=\s*15/
    );

    assert.match(
      controller,
      /UPDATE employee_mobile_handoffs[\s\S]*?SET revoked_at\s*=\s*UTC_TIMESTAMP\(\)[\s\S]*?created_by_user_id\s*=\s*\?[\s\S]*?employee_id\s*=\s*\?[\s\S]*?purpose\s*=\s*\?[\s\S]*?consumed_at IS NULL[\s\S]*?revoked_at IS NULL[\s\S]*?expires_at\s*>\s*UTC_TIMESTAMP\(\)/
    );

    assert.match(
      controller,
      /DATE_ADD\s*\(\s*UTC_TIMESTAMP\(\)\s*,\s*INTERVAL \$\{HANDOFF_TTL_MINUTES\} MINUTE\s*\)/
    );
  }
);

test(
  "handoff resolution locks the record, binds it to the creator, and consumes it atomically once",
  () => {
    assert.match(
      controller,
      /FROM employee_mobile_handoffs AS h[\s\S]*?WHERE h\.token_hash\s*=\s*\?[\s\S]*?FOR UPDATE/
    );

    assert.match(
      controller,
      /Number\s*\(\s*handoff\.created_by_user_id\s*\)\s*!==\s*currentUserId/
    );

    assert.match(
      controller,
      /normalizeText\s*\(\s*handoff\.purpose\s*\)\s*!==\s*HANDOFF_PURPOSE/
    );

    assert.match(
      controller,
      /SET consumed_at\s*=\s*UTC_TIMESTAMP\(\)[\s\S]*?WHERE id\s*=\s*\?[\s\S]*?consumed_at IS NULL[\s\S]*?revoked_at IS NULL[\s\S]*?expires_at\s*>\s*UTC_TIMESTAMP\(\)/
    );

    assert.match(
      controller,
      /consumeResult\.affectedRows/
    );
  }
);

test(
  "invalid, expired, used, revoked, and wrong-account handoffs share the generic unavailable response",
  () => {
    assert.match(
      controller,
      /function sendUnavailableHandoff\s*\(/
    );

    assert.match(
      controller,
      /status\s*\(\s*410\s*\)/
    );

    const genericCalls =
      controller.match(
        /sendUnavailableHandoff\s*\(\s*res\s*\)/g
      ) || [];

    assert.ok(
      genericCalls.length >= 6,
      "Expected invalid handoff states to converge on the generic response helper."
    );

    assert.doesNotMatch(
      controller,
      /belongs to a different WELLJOB account/
    );

    assert.doesNotMatch(
      controller,
      /has already been used/
    );

    assert.doesNotMatch(
      controller,
      /has been replaced or revoked/
    );
  }
);

test(
  "handoff expiry is evaluated by the MySQL UTC clock while the row is locked",
  () => {
    assert.match(
      controller,
      /CASE[\s\S]*?h\.expires_at\s*<=\s*UTC_TIMESTAMP\(\)[\s\S]*?END AS is_expired/
    );

    assert.match(
      controller,
      /handoff\.is_expired/
    );

    assert.doesNotMatch(
      controller,
      /expiryRows/
    );
  }
);

test(
  "mobile handoff operational audit descriptions exclude raw tokens and token hashes",
  () => {
    assert.match(
      controller,
      /AUDIT_CATEGORY\.OPERATIONAL/
    );

    assert.match(
      controller,
      /CREATE_EMPLOYEE_MOBILE_HANDOFF/
    );

    assert.match(
      controller,
      /USE_EMPLOYEE_MOBILE_HANDOFF/
    );

    const descriptionMatch =
      controller.match(
        /description\s*:\s*`([^`]*)`/
      );

    assert.ok(
      descriptionMatch,
      "Expected a generic handoff audit description."
    );

    const descriptionSource =
      descriptionMatch[1];

    assert.doesNotMatch(
      descriptionSource,
      /rawToken|tokenHash|government|birthday|document_number/i
    );
  }
);

test(
  "both mobile handoff endpoints remain authenticated and HR Staff only",
  () => {
    assert.match(
      routes,
      /router\.post\s*\(\s*["']\/employees\/:id\/mobile-handoff["'][\s\S]*?verifyToken[\s\S]*?authorizeRoles\s*\(\s*["']HR_STAFF["']\s*\)[\s\S]*?createEmployeeMobileHandoff/
    );

    assert.match(
      routes,
      /router\.post\s*\(\s*["']\/employee-mobile-handoffs\/resolve["'][\s\S]*?verifyToken[\s\S]*?authorizeRoles\s*\(\s*["']HR_STAFF["']\s*\)[\s\S]*?resolveEmployeeMobileHandoff/
    );
  }
);

test(
  "mobile handoff migration stores only the hash and enforces required relationships and indexes",
  () => {
    assert.match(
      migration,
      /CREATE TABLE employee_mobile_handoffs/
    );

    assert.match(
      migration,
      /token_hash\s+CHAR\(64\)[\s\S]*?NOT NULL/
    );

    assert.match(
      migration,
      /UNIQUE KEY uq_employee_mobile_handoffs_token_hash\s*\(\s*token_hash\s*\)/
    );

    assert.match(
      migration,
      /FOREIGN KEY\s*\(\s*employee_id\s*\)\s*REFERENCES employees\s*\(\s*id\s*\)/
    );

    assert.match(
      migration,
      /FOREIGN KEY\s*\(\s*created_by_user_id\s*\)\s*REFERENCES users\s*\(\s*id\s*\)/
    );

    assert.doesNotMatch(
      migration,
      /\braw_token\b|\btoken\b\s+(?:VARCHAR|CHAR|TEXT)/i
    );
  }
);