import test from "node:test";
import assert from "node:assert/strict";

import {
  getDaysUntilExpiration,
} from "../src/utils/employees/employeeHelpers.js";

const MANILA_NOVEMBER_5 =
  new Date(
    "2026-11-04T16:30:00.000Z"
  );

test(
  "frontend compliance dates use the Asia/Manila calendar regardless of browser timezone",
  () => {
    assert.equal(
      getDaysUntilExpiration(
        "2026-11-04",
        MANILA_NOVEMBER_5
      ),
      -1
    );
    assert.equal(
      getDaysUntilExpiration(
        "2026-11-05",
        MANILA_NOVEMBER_5
      ),
      0
    );
    assert.equal(
      getDaysUntilExpiration(
        "2026-12-05",
        MANILA_NOVEMBER_5
      ),
      30
    );
    assert.equal(
      getDaysUntilExpiration(
        "2026-12-06",
        MANILA_NOVEMBER_5
      ),
      31
    );
  }
);
