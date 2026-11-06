import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeGovernmentIdNumber,
  validateGovernmentIdNumber,
} from "../src/utils/employees/employeeGovernmentIdValidation.js";

import {
  createEmployeeDocuments,
  getEmployeeDocumentNumberForRequest,
  getPhilippinesDateInputValue,
  validateEmployeeBirthday,
  validateEmployeeDocumentNumber,
  validateEmployeeForm,
} from "../src/utils/employees/employeeFormHelpers.js";

const DOCUMENT_NAMES = {
  sss: "SSS (ID or E1 form)",
  pagIbig:
    "Pag-IBIG (ID or MDRF Form)",
  philHealth:
    "PhilHealth (ID or MDF Form)",
};

test(
  "frontend government ID rules keep blank optional and normalize valid values to digits",
  () => {
    assert.deepEqual(
      validateGovernmentIdNumber(
        DOCUMENT_NAMES.sss,
        ""
      ),
      {
        value: "",
        error: "",
      }
    );

    assert.deepEqual(
      validateGovernmentIdNumber(
        DOCUMENT_NAMES.sss,
        "00-1234567-8"
      ),
      {
        value: "0012345678",
        error: "",
      }
    );

    assert.equal(
      normalizeGovernmentIdNumber(
        DOCUMENT_NAMES.philHealth,
        "01-234567890-1"
      ),
      "012345678901"
    );

    assert.equal(
      normalizeGovernmentIdNumber(
        DOCUMENT_NAMES.pagIbig,
        "0001-2345-6789"
      ),
      "000123456789"
    );
  }
);

test(
  "frontend government ID rules reject bad lengths and unsupported characters",
  () => {
    const cases = [
      [
        DOCUMENT_NAMES.sss,
        "123456789",
        /exactly 10 digits/,
      ],
      [
        DOCUMENT_NAMES.philHealth,
        "1234567890123",
        /exactly 12 digits/,
      ],
      [
        DOCUMENT_NAMES.pagIbig,
        "1234 5678 9012",
        /spaces are not allowed/,
      ],
      [
        DOCUMENT_NAMES.sss,
        "12A-345678-9",
        /digits and hyphens only/,
      ],
      [
        DOCUMENT_NAMES.philHealth,
        "12/345678901/2",
        /digits and hyphens only/,
      ],
      [
        DOCUMENT_NAMES.pagIbig,
        "00-01234-56789",
        /0000-0000-0000/,
      ],
    ];

    for (
      const [
        documentName,
        value,
        expectedError,
      ] of cases
    ) {
      const result =
        validateGovernmentIdNumber(
          documentName,
          value
        );

      assert.equal(
        result.value,
        ""
      );

      assert.match(
        result.error,
        expectedError
      );
    }
  }
);

test(
  "employee document validation requires new IDs and preserves an unchanged legacy value",
  () => {
    assert.equal(
      validateEmployeeDocumentNumber({
        checked: true,
        requiresDocumentNumber:
          true,
        name:
          DOCUMENT_NAMES.sss,
        documentNumber: "",
        isExistingRecord: false,
      }),
      "SSS Number is required."
    );

    assert.equal(
      validateEmployeeDocumentNumber({
        checked: true,
        requiresDocumentNumber:
          true,
        name:
          DOCUMENT_NAMES.sss,
        documentNumber:
          "12 3456789 0",
        originalDocumentNumber:
          "12 3456789 0",
        isExistingRecord: true,
      }),
      ""
    );

    assert.equal(
      getEmployeeDocumentNumberForRequest({
        name:
          DOCUMENT_NAMES.sss,
        documentNumber:
          "12 3456789 0",
        originalDocumentNumber:
          "12 3456789 0",
        isExistingRecord: true,
      }),
      "12 3456789 0"
    );
  }
);

test(
  "employee form request normalization converts changed valid IDs and blocks changed invalid IDs",
  () => {
    const changedDocument = {
      checked: true,
      requiresDocumentNumber:
        true,
      name:
        DOCUMENT_NAMES.sss,
      documentNumber:
        "00-1234567-8",
      originalDocumentNumber:
        "12 3456789 0",
      isExistingRecord: true,
    };

    assert.equal(
      validateEmployeeDocumentNumber(
        changedDocument
      ),
      ""
    );

    assert.equal(
      getEmployeeDocumentNumberForRequest(
        changedDocument
      ),
      "0012345678"
    );

    assert.match(
      validateEmployeeDocumentNumber({
        ...changedDocument,
        documentNumber:
          "1234 5678 90",
      }),
      /spaces are not allowed/
    );
  }
);

test(
  "birthday validation uses the Philippine calendar at the UTC date boundary",
  () => {
    const manilaMidnight =
      new Date(
        "2026-11-04T16:00:00.000Z"
      );

    assert.equal(
      getPhilippinesDateInputValue(
        manilaMidnight
      ),
      "2026-11-05"
    );

    assert.equal(
      validateEmployeeBirthday(
        "2026-11-05",
        {
          referenceDate:
            manilaMidnight,
        }
      ),
      ""
    );

    assert.equal(
      validateEmployeeBirthday(
        "2026-11-06",
        {
          referenceDate:
            manilaMidnight,
        }
      ),
      "Birthday cannot be in the future."
    );
  }
);

test(
  "birthday validation enforces exact age 17 on Date Hired",
  () => {
    const referenceDate =
      new Date(
        "2026-11-05T04:00:00.000Z"
      );

    assert.equal(
      validateEmployeeBirthday(
        "",
        {
          referenceDate,
          required: true,
        }
      ),
      "Birthday is required."
    );

    assert.equal(
      validateEmployeeBirthday(
        "2026-02-29",
        {
          referenceDate,
        }
      ),
      "Enter a valid birthday."
    );

    assert.equal(
      validateEmployeeBirthday(
        "2009-11-05",
        {
          referenceDate,
          required: true,
          minimumAgeReferenceDate:
            "2026-11-05",
        }
      ),
      ""
    );

    assert.equal(
      validateEmployeeBirthday(
        "2009-11-06",
        {
          referenceDate,
          required: true,
          minimumAgeReferenceDate:
            "2026-11-05",
        }
      ),
      "Employee must be at least 17 years old on Date Hired."
    );
  }
);

test(
  "new employee form requires birthday and all three government identifiers",
  () => {
    const baseForm = {
      name: "Fictional Test Employee",
      birthday: "2009-10-01",
      dateHired: "2026-10-01",
      status: "Floating / Standby",
      company: "Fictional Company",
      position: "Fictional Position",
      contractStart: "",
      documents:
        createEmployeeDocuments(),
    };

    const missing =
      validateEmployeeForm({
        formData: baseForm,
      });

    assert.equal(
      missing.isValid,
      false
    );
    assert.match(
      missing.errors.documents
        .general,
      /SSS, PhilHealth, and Pag-IBIG/
    );

    const numbers = {
      [DOCUMENT_NAMES.sss]:
        "00-1234567-8",
      [DOCUMENT_NAMES.pagIbig]:
        "0001-2345-6789",
      [DOCUMENT_NAMES.philHealth]:
        "01-234567890-1",
    };

    const complete =
      validateEmployeeForm({
        formData: {
          ...baseForm,
          documents:
            createEmployeeDocuments()
              .map(
                (document) =>
                  numbers[
                    document.name
                  ]
                    ? {
                        ...document,
                        checked: true,
                        documentNumber:
                          numbers[
                            document.name
                          ],
                        filePath:
                          `documents/fictional/${document.name}.pdf`,
                      }
                    : document
              ),
        },
      });

    assert.equal(
      complete.isValid,
      true
    );
  }
);
