export const GOVERNMENT_ID_RULES =
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

export function getGovernmentIdRule(
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

export function validateGovernmentIdNumber(
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
    String(
      value ?? ""
    ).trim();

  if (!rule) {
    return {
      value: input,
      error: "",
    };
  }

  if (!input) {
    return {
      value: "",
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
      value: "",
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
      value: "",
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
      value: "",
      error:
        `${rule.label} must contain exactly ${rule.digits} digits.`,
    };
  }

  return {
    value: digitsOnly,
    error: "",
  };
}

export function normalizeGovernmentIdNumber(
  documentName,
  value
) {
  const result =
    validateGovernmentIdNumber(
      documentName,
      value
    );

  if (result.error) {
    return String(
      value ?? ""
    ).trim();
  }

  return result.value;
}
