const test = require("node:test");
const assert = require("node:assert/strict");

const {
  calculateExactAge,
  validateEmployeeMinimumAge,
} = require(
  "../utils/employeeAgeValidation"
);

test(
  "exact age accepts the 17th birthday and rejects the day before",
  () => {
    assert.equal(
      calculateExactAge(
        "2009-11-06",
        "2026-11-06"
      ),
      17
    );

    assert.equal(
      validateEmployeeMinimumAge(
        "2009-11-06",
        "2026-11-06",
        {
          required: true,
        }
      ),
      ""
    );

    assert.equal(
      validateEmployeeMinimumAge(
        "2009-11-07",
        "2026-11-06",
        {
          required: true,
        }
      ),
      "Employee must be at least 17 years old on Date Hired."
    );
  }
);

test(
  "minimum-age validation requires birthday and handles leap birthdays exactly",
  () => {
    assert.equal(
      validateEmployeeMinimumAge(
        "",
        "2026-11-06",
        {
          required: true,
        }
      ),
      "Birthday is required."
    );

    assert.equal(
      calculateExactAge(
        "2008-02-29",
        "2025-02-28"
      ),
      16
    );

    assert.equal(
      calculateExactAge(
        "2008-02-29",
        "2025-03-01"
      ),
      17
    );
  }
);
