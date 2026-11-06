const GOVERNMENT_ID_RULES =
  Object.freeze({
    "sss (id or e1 form)": {
      label: "SSS Number",
      digits: 10,
      hyphenPattern:
        /^\d{2}-\d{7}-\d$/,
      hyphenFormat:
        "00-0000000-0",
    },
    "pag-ibig (id or mdrf form)": {
      label:
        "Pag-IBIG MID Number",
      digits: 12,
      hyphenPattern:
        /^\d{4}-\d{4}-\d{4}$/,
      hyphenFormat:
        "0000-0000-0000",
    },
    "philhealth (id or mdf form)": {
      label:
        "PhilHealth PIN",
      digits: 12,
      hyphenPattern:
        /^\d{2}-\d{9}-\d$/,
      hyphenFormat:
        "00-000000000-0",
    },
  });

function normalizeComparableText(
  value
) {
  return String(
    value ?? ""
  )
    .trim()
    .replace(
      /\s+/g,
      " "
    )
    .toLowerCase();
}

function normalizeStoredText(
  value
) {
  const normalized =
    String(
      value ?? ""
    ).trim();

  return normalized ||
    null;
}

function getGovernmentIdRule(
  documentName
) {
  return (
    GOVERNMENT_ID_RULES[
      normalizeComparableText(
        documentName
      )
    ] || null
  );
}

function validateGovernmentIdNumber(
  documentName,
  value,
  {
    required = false,
  } = {}
) {
  const rule =
    getGovernmentIdRule(
      documentName
    );

  const input =
    normalizeStoredText(
      value
    );

  if (!rule) {
    return {
      value: input,
      error: "",
    };
  }

  /*
   * Government identifiers remain optional. If supplied,
   * accept digit-only input or readable hyphen grouping.
   * Spaces and every other character are rejected. The
   * persisted result is always digit-only so leading zeroes
   * remain intact without storing presentation formatting.
   */
  if (!input) {
    return {
      value: null,
      error:
        required
          ? `${rule.label} is required.`
          : "",
    };
  }

  if (
    !/^[0-9-]+$/.test(
      input
    )
  ) {
    return {
      value: null,
      error:
        `${rule.label} may contain digits and hyphens only; spaces are not allowed.`,
    };
  }

  if (
    input.includes("-") &&
    !rule.hyphenPattern.test(
      input
    )
  ) {
    return {
      value: null,
      error:
        `${rule.label} must use ${rule.hyphenFormat} when hyphens are included.`,
    };
  }

  const digitsOnly =
    input.replace(
      /-/g,
      ""
    );

  if (
    digitsOnly.length !==
      rule.digits
  ) {
    return {
      value: null,
      error:
        `${rule.label} must contain exactly ${rule.digits} digits.`,
    };
  }

  return {
    value: digitsOnly,
    error: "",
  };
}

function validateAndNormalizeEmployeeDocumentNumbers(
  documents,
  existingDocuments = null,
  {
    requireGovernmentIds =
      false,
  } = {}
) {
  const safeDocuments =
    Array.isArray(
      documents
    )
      ? documents
      : [];

  const safeExistingDocuments =
    Array.isArray(
      existingDocuments
    )
      ? existingDocuments
      : [];

  const hasExistingContext =
    Array.isArray(
      existingDocuments
    );

  const normalizedDocuments =
    safeDocuments.map(
      (document) => ({
        ...document,
      })
    );

  if (requireGovernmentIds) {
    for (
      const [
        documentName,
        rule,
      ] of Object.entries(
        GOVERNMENT_ID_RULES
      )
    ) {
      const submittedDocument =
        normalizedDocuments.find(
          (document) =>
            normalizeComparableText(
              document?.name
            ) === documentName
        );

      if (!submittedDocument) {
        return {
          documents:
            normalizedDocuments,
          error:
            `${rule.label} is required for new employees.`,
        };
      }
    }
  }

  for (
    const document of
      normalizedDocuments
  ) {
    const rule =
      getGovernmentIdRule(
        document?.name
      );

    if (!rule) {
      document.documentNumber =
        normalizeStoredText(
          document
            ?.documentNumber
        );

      continue;
    }

    const submittedValue =
      normalizeStoredText(
        document
          ?.documentNumber
      );

    const existingDocument =
      hasExistingContext
        ? safeExistingDocuments.find(
            (existing) =>
              normalizeComparableText(
                existing?.name
              ) ===
              normalizeComparableText(
                document?.name
              )
          )
        : null;

    const existingValue =
      normalizeStoredText(
        existingDocument
          ?.document_number ??
          existingDocument
            ?.documentNumber
      );

    /*
     * Preserve an unchanged historical value verbatim.
     * This keeps unrelated employee edits from silently
     * rewriting or blocking legacy formatted identifiers.
     * Any new or changed value must pass the current rule.
     */
    if (
      existingDocument &&
      submittedValue ===
        existingValue
    ) {
      document.documentNumber =
        existingValue;

      continue;
    }

    const result =
      validateGovernmentIdNumber(
        document?.name,
        submittedValue,
        {
          required:
            requireGovernmentIds ||
            !hasExistingContext ||
            !existingDocument ||
            Boolean(
              existingValue
            ) ||
            Boolean(
              document?.hasNewFile
            ),
        }
      );

    if (result.error) {
      return {
        documents:
          normalizedDocuments,
        error:
          result.error,
      };
    }

    document.documentNumber =
      result.value;
  }

  if (hasExistingContext) {
    for (
      const existingDocument of
        safeExistingDocuments
    ) {
      const rule =
        getGovernmentIdRule(
          existingDocument?.name
        );

      if (!rule) {
        continue;
      }

      const existingValue =
        normalizeStoredText(
          existingDocument
            ?.document_number ??
            existingDocument
              ?.documentNumber
        );

      if (!existingValue) {
        continue;
      }

      const stillSubmitted =
        normalizedDocuments.some(
          (document) =>
            normalizeComparableText(
              document?.name
            ) ===
            normalizeComparableText(
              existingDocument?.name
            )
        );

      if (!stillSubmitted) {
        return {
          documents:
            normalizedDocuments,
          error:
            `${rule.label} cannot be removed from an existing employee record.`,
        };
      }
    }
  }

  return {
    documents:
      normalizedDocuments,
    error: "",
  };
}

module.exports = {
  GOVERNMENT_ID_RULES,
  getGovernmentIdRule,
  validateGovernmentIdNumber,
  validateAndNormalizeEmployeeDocumentNumbers,
};
