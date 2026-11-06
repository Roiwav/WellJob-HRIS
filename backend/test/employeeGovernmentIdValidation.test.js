const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getGovernmentIdRule,
  validateGovernmentIdNumber,
  validateAndNormalizeEmployeeDocumentNumbers,
} = require(
  "../utils/employeeGovernmentIdValidation"
);

const DOCUMENT_NAMES = {
  sss: "SSS (ID or E1 form)",
  pagIbig:
    "Pag-IBIG (ID or MDRF Form)",
  philHealth:
    "PhilHealth (ID or MDF Form)",
};

test(
  "government ID rules resolve canonical document names without case or spacing sensitivity",
  () => {
    const rule =
      getGovernmentIdRule(
        "  sSs   (ID or E1 FORM)  "
      );

    assert.equal(
      rule?.label,
      "SSS Number"
    );

    assert.equal(
      rule?.digits,
      10
    );

    assert.equal(
      getGovernmentIdRule(
        "Resume"
      ),
      null
    );
  }
);

test(
  "government identifiers remain optional",
  () => {
    for (
      const documentName of
        Object.values(
          DOCUMENT_NAMES
        )
    ) {
      assert.deepEqual(
        validateGovernmentIdNumber(
          documentName,
          "   "
        ),
        {
          value: null,
          error: "",
        }
      );
    }
  }
);

test(
  "required government identifiers reject blank values",
  () => {
    assert.deepEqual(
      validateGovernmentIdNumber(
        DOCUMENT_NAMES.sss,
        "",
        {
          required: true,
        }
      ),
      {
        value: null,
        error:
          "SSS Number is required.",
      }
    );
  }
);

test(
  "valid SSS, PhilHealth, and Pag-IBIG values normalize to digit-only strings and preserve leading zeroes",
  () => {
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

    assert.deepEqual(
      validateGovernmentIdNumber(
        DOCUMENT_NAMES.philHealth,
        "01-234567890-1"
      ),
      {
        value: "012345678901",
        error: "",
      }
    );

    assert.deepEqual(
      validateGovernmentIdNumber(
        DOCUMENT_NAMES.pagIbig,
        "0001-2345-6789"
      ),
      {
        value: "000123456789",
        error: "",
      }
    );
  }
);

test(
  "government identifier validation rejects bad lengths, letters, spaces, and unsupported punctuation",
  () => {
    const cases = [
      [
        DOCUMENT_NAMES.sss,
        "123456789",
        /exactly 10 digits/,
      ],
      [
        DOCUMENT_NAMES.sss,
        "12345678901",
        /exactly 10 digits/,
      ],
      [
        DOCUMENT_NAMES.philHealth,
        "12345678901A",
        /digits and hyphens only/,
      ],
      [
        DOCUMENT_NAMES.pagIbig,
        "1234 5678 9012",
        /spaces are not allowed/,
      ],
      [
        DOCUMENT_NAMES.pagIbig,
        "1234.5678.9012",
        /digits and hyphens only/,
      ],
      [
        DOCUMENT_NAMES.sss,
        "0-01234567-8",
        /00-0000000-0/,
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
        null
      );

      assert.match(
        result.error,
        expectedError
      );
    }
  }
);

test(
  "batch validation normalizes new values without mutating the submitted documents",
  () => {
    const submittedDocuments = [
      {
        name:
          DOCUMENT_NAMES.sss,
        documentNumber:
          "00-1234567-8",
      },
      {
        name:
          DOCUMENT_NAMES.pagIbig,
        documentNumber:
          "0001-2345-6789",
      },
      {
        name: "Resume",
        documentNumber:
          "  REF-001  ",
      },
    ];

    const result =
      validateAndNormalizeEmployeeDocumentNumbers(
        submittedDocuments
      );

    assert.equal(
      result.error,
      ""
    );

    assert.deepEqual(
      result.documents.map(
        (document) =>
          document.documentNumber
      ),
      [
        "0012345678",
        "000123456789",
        "REF-001",
      ]
    );

    assert.equal(
      submittedDocuments[0]
        .documentNumber,
      "00-1234567-8"
    );
  }
);

test(
  "new employees must submit all three government identifiers",
  () => {
    const missing =
      validateAndNormalizeEmployeeDocumentNumbers(
        [
          {
            name:
              DOCUMENT_NAMES.sss,
            documentNumber:
              "00-1234567-8",
          },
        ],
        null,
        {
          requireGovernmentIds:
            true,
        }
      );

    assert.match(
      missing.error,
      /Pag-IBIG MID Number is required/
    );

    const complete =
      validateAndNormalizeEmployeeDocumentNumbers(
        [
          {
            name:
              DOCUMENT_NAMES.sss,
            documentNumber:
              "00-1234567-8",
          },
          {
            name:
              DOCUMENT_NAMES.pagIbig,
            documentNumber:
              "0001-2345-6789",
          },
          {
            name:
              DOCUMENT_NAMES.philHealth,
            documentNumber:
              "01-234567890-1",
          },
        ],
        null,
        {
          requireGovernmentIds:
            true,
        }
      );

    assert.equal(
      complete.error,
      ""
    );
  }
);

test(
  "update validation preserves an unchanged legacy value but validates any changed value",
  () => {
    const existingDocuments = [
      {
        name:
          DOCUMENT_NAMES.sss,
        document_number:
          "12 3456789 0",
      },
    ];

    const unchanged =
      validateAndNormalizeEmployeeDocumentNumbers(
        [
          {
            name:
              DOCUMENT_NAMES.sss,
            documentNumber:
              "12 3456789 0",
          },
        ],
        existingDocuments
      );

    assert.equal(
      unchanged.error,
      ""
    );

    assert.equal(
      unchanged.documents[0]
        .documentNumber,
      "12 3456789 0"
    );

    const changed =
      validateAndNormalizeEmployeeDocumentNumbers(
        [
          {
            name:
              DOCUMENT_NAMES.sss,
            documentNumber:
              "00-1234567-8",
          },
        ],
        existingDocuments
      );

    assert.equal(
      changed.error,
      ""
    );

    assert.equal(
      changed.documents[0]
        .documentNumber,
      "0012345678"
    );
  }
);
