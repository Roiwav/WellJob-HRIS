"use strict";

process.env.NODE_ENV = "test";
process.env.DB_HOST ||= "127.0.0.1";
process.env.DB_PORT ||= "3306";
process.env.DB_USER ||= "test";
process.env.DB_PASSWORD ??= "";
process.env.DB_NAME ||= "welljob_test";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  __test: {
    getComplianceDaysUntilExpiration,
    isComplianceDocumentExpired,
    isComplianceDocumentExpiring,
  },
} = require("../controllers/smartSuggestionController");

const MANILA_NOVEMBER_5 =
  new Date(
    "2026-11-04T16:30:00.000Z"
  );

test(
  "backend compliance suggestions use Asia/Manila date-only boundaries",
  () => {
    assert.equal(
      getComplianceDaysUntilExpiration(
        "2026-11-05",
        MANILA_NOVEMBER_5
      ),
      0
    );
    assert.equal(
      isComplianceDocumentExpired(
        "2026-11-05",
        MANILA_NOVEMBER_5
      ),
      false
    );
    assert.equal(
      isComplianceDocumentExpired(
        "2026-11-04",
        MANILA_NOVEMBER_5
      ),
      true
    );
    assert.equal(
      isComplianceDocumentExpiring(
        "2026-12-05",
        MANILA_NOVEMBER_5
      ),
      true
    );
    assert.equal(
      isComplianceDocumentExpiring(
        "2026-12-06",
        MANILA_NOVEMBER_5
      ),
      false
    );
  }
);
