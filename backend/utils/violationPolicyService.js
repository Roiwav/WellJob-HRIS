const db = require("../config/db");

const VIOLATION_RULES_SETTING_NAME =
  "violation_rules";

const SEVERITY_SCORE =
  Object.freeze({
    Minor: 1,
    Major: 2,
    Critical: 3,
  });

const ALLOWED_SEVERITIES =
  new Set(
    Object.keys(
      SEVERITY_SCORE
    )
  );

const MAX_VIOLATION_CATEGORIES = 50;
const MAX_VIOLATION_RULES = 1000;

const CRITICAL_KEYWORDS = [
  "injury",
  "accident",
  "hospital",
  "unsafe",
  "hazard",
  "harassment",
  "theft",
  "fraud",
  "violence",
  "threat",
  "cut",
  "wound",
  "bleeding",
];

class ViolationPolicyError extends Error {
  constructor(
    message,
    {
      statusCode = 400,
      code =
        "VIOLATION_POLICY_ERROR",
    } = {}
  ) {
    super(message);

    this.name =
      "ViolationPolicyError";

    this.statusCode =
      statusCode;

    this.code =
      code;

    this.isViolationPolicyError =
      true;
  }
}

function normalizeString(
  value,
  maxLength = null
) {
  const normalized =
    String(
      value ?? ""
    ).trim();

  if (
    maxLength &&
    normalized.length >
      maxLength
  ) {
    return normalized.slice(
      0,
      maxLength
    );
  }

  return normalized;
}

function normalizeText(
  value
) {
  return normalizeString(
    value
  ).toLowerCase();
}

function normalizeSeverity(
  value,
  {
    allowLegacyMultiple = false,
  } = {}
) {
  const rawValues =
    Array.isArray(value)
      ? value
      : value !== null &&
          value !== undefined &&
          value !== ""
        ? [value]
        : [];

  const normalizedValues =
    rawValues.map(
      (item) =>
        normalizeString(
          item,
          50
        )
    );

  if (
    normalizedValues.length ===
    0
  ) {
    return {
      valid: false,

      error:
        "Exactly one severity is required.",

      severity: [],
    };
  }

  if (
    normalizedValues.some(
      (severity) =>
        !ALLOWED_SEVERITIES.has(
          severity
        )
    )
  ) {
    return {
      valid: false,

      error:
        "Severity must be Minor, Major, or Critical.",

      severity: [],
    };
  }

  const uniqueSeverities = [
    ...new Set(
      normalizedValues
    ),
  ];

  if (
    !allowLegacyMultiple &&
    (
      normalizedValues.length !==
        1 ||
      uniqueSeverities.length !==
        1
    )
  ) {
    return {
      valid: false,

      error:
        "Exactly one severity is required. Select only Minor, Major, or Critical.",

      severity: [],
    };
  }

  const normalizedSeverity =
    allowLegacyMultiple
      ? [
          uniqueSeverities.reduce(
            (
              highest,
              current
            ) =>
              SEVERITY_SCORE[
                current
              ] >
              SEVERITY_SCORE[
                highest
              ]
                ? current
                : highest,
            uniqueSeverities[0]
          ),
        ]
      : uniqueSeverities;

  return {
    valid: true,
    error: null,

    severity:
      normalizedSeverity,
  };
}

function normalizePenalty(
  penalty,
  index
) {
  if (
    typeof penalty ===
    "string"
  ) {
    return normalizeString(
      penalty,
      2000
    );
  }

  if (
    !penalty ||
    typeof penalty !==
      "object" ||
    Array.isArray(
      penalty
    )
  ) {
    return "";
  }

  const numericOffenseNo =
    Number(
      penalty.offenseNo
    );

  return {
    offenseNo:
      Number.isInteger(
        numericOffenseNo
      ) &&
      numericOffenseNo > 0 &&
      numericOffenseNo <= 100
        ? numericOffenseNo
        : index + 1,

    label:
      normalizeString(
        penalty.label ||
          `Offense ${
            index + 1
          }`,
        250
      ),

    action:
      normalizeString(
        penalty.action,
        2000
      ),
  };
}

function hasValidPenalty(
  penalty
) {
  if (
    typeof penalty ===
    "string"
  ) {
    return Boolean(
      penalty.trim()
    );
  }

  return Boolean(
    penalty &&
      typeof penalty ===
        "object" &&
      !Array.isArray(
        penalty
      ) &&
      penalty.action
  );
}

function normalizeViolationRules(
  rules,
  {
    allowLegacyMultipleSeverity =
      false,
  } = {}
) {
  if (
    !Array.isArray(rules)
  ) {
    return {
      valid: false,

      error:
        "Violation rules must be an array.",

      rules: [],
    };
  }

  if (
    rules.length === 0
  ) {
    return {
      valid: false,

      error:
        "At least one violation category is required.",

      rules: [],
    };
  }

  if (
    rules.length >
    MAX_VIOLATION_CATEGORIES
  ) {
    return {
      valid: false,

      error:
        `Violation rules cannot contain more than ${MAX_VIOLATION_CATEGORIES} categories.`,

      rules: [],
    };
  }

  let totalRuleCount = 0;

  const normalizedGroups = [];

  for (
    let groupIndex = 0;
    groupIndex <
    rules.length;
    groupIndex += 1
  ) {
    const group =
      rules[groupIndex];

    if (
      !group ||
      typeof group !==
        "object" ||
      Array.isArray(group)
    ) {
      return {
        valid: false,

        error:
          `Violation category ${
            groupIndex + 1
          } is invalid.`,

        rules: [],
      };
    }

    const category =
      normalizeString(
        group.category,
        250
      );

    if (!category) {
      return {
        valid: false,

        error:
          `Violation category ${
            groupIndex + 1
          } must have a name.`,

        rules: [],
      };
    }

    if (
      !Array.isArray(
        group.rows
      ) ||
      group.rows.length === 0
    ) {
      return {
        valid: false,

        error:
          `${category} must contain at least one violation rule.`,

        rules: [],
      };
    }

    const normalizedRows =
      [];

    for (
      let rowIndex = 0;
      rowIndex <
      group.rows.length;
      rowIndex += 1
    ) {
      const rule =
        group.rows[rowIndex];

      const rulePrefix =
        `${category}, Rule ${
          rowIndex + 1
        }`;

      if (
        !rule ||
        typeof rule !==
          "object" ||
        Array.isArray(rule)
      ) {
        return {
          valid: false,

          error:
            `${rulePrefix} is invalid.`,

          rules: [],
        };
      }

      totalRuleCount += 1;

      if (
        totalRuleCount >
        MAX_VIOLATION_RULES
      ) {
        return {
          valid: false,

          error:
            `Violation rules cannot contain more than ${MAX_VIOLATION_RULES} rules.`,

          rules: [],
        };
      }

      const id =
        normalizeString(
          rule.id,
          255
        );

      const section =
        normalizeString(
          rule.section,
          150
        );

      const violation =
        normalizeString(
          rule.violation,
          500
        );

      const description =
        normalizeString(
          rule.description,
          10000
        );

      const penaltyLevel =
        normalizeString(
          rule.penaltyLevel,
          500
        );

      const severityResult =
        normalizeSeverity(
          rule.severity,
          {
            allowLegacyMultiple:
              allowLegacyMultipleSeverity,
          }
        );

      const penalties =
        Array.isArray(
          rule.penalties
        )
          ? rule.penalties
              .map(
                (
                  penalty,
                  penaltyIndex
                ) =>
                  normalizePenalty(
                    penalty,
                    penaltyIndex
                  )
              )
              .filter(
                hasValidPenalty
              )
          : [];

      if (!section) {
        return {
          valid: false,

          error:
            `${rulePrefix}: section is required.`,

          rules: [],
        };
      }

      if (!violation) {
        return {
          valid: false,

          error:
            `${rulePrefix}: violation title is required.`,

          rules: [],
        };
      }

      if (!description) {
        return {
          valid: false,

          error:
            `${rulePrefix}: description is required.`,

          rules: [],
        };
      }

      if (!penaltyLevel) {
        return {
          valid: false,

          error:
            `${rulePrefix}: penalty level is required.`,

          rules: [],
        };
      }

      if (
        !severityResult.valid
      ) {
        return {
          valid: false,

          error:
            `${rulePrefix}: ${severityResult.error}`,

          rules: [],
        };
      }

      if (
        penalties.length === 0
      ) {
        return {
          valid: false,

          error:
            `${rulePrefix}: at least one penalty is required.`,

          rules: [],
        };
      }

      normalizedRows.push({
        ...(id
          ? {
              id,
            }
          : {}),

        section,
        violation,
        description,
        penaltyLevel,

        severity:
          severityResult.severity,

        penalties,
      });
    }

    normalizedGroups.push({
      category,

      rows:
        normalizedRows,
    });
  }

  return {
    valid: true,
    error: null,

    rules:
      normalizedGroups,
  };
}

function parseViolationRulesSetting(
  settingValue
) {
  if (
    settingValue === null ||
    settingValue ===
      undefined ||
    String(
      settingValue
    ).trim() === ""
  ) {
    return null;
  }

  let parsedValue;

  try {
    parsedValue =
      typeof settingValue ===
      "string"
        ? JSON.parse(
            settingValue
          )
        : settingValue;
  } catch {
    throw new ViolationPolicyError(
      "The stored violation rules configuration contains invalid JSON.",
      {
        statusCode: 500,

        code:
          "INVALID_STORED_POLICY_JSON",
      }
    );
  }

  if (
    !parsedValue ||
    typeof parsedValue !==
      "object" ||
    Array.isArray(
      parsedValue
    )
  ) {
    throw new ViolationPolicyError(
      "The stored violation rules configuration is invalid.",
      {
        statusCode: 500,

        code:
          "INVALID_STORED_POLICY",
      }
    );
  }

  const normalizedResult =
    normalizeViolationRules(
      parsedValue.rules,
      {
        allowLegacyMultipleSeverity:
          true,
      }
    );

  if (
    !normalizedResult.valid
  ) {
    throw new ViolationPolicyError(
      `The stored violation rules configuration is invalid: ${normalizedResult.error}`,
      {
        statusCode: 500,

        code:
          "INVALID_STORED_POLICY",
      }
    );
  }

  return {
    rules:
      normalizedResult.rules,

    metadata: {
      updatedAt:
        parsedValue?.metadata
          ?.updatedAt ||
        null,

      updatedBy:
        parsedValue?.metadata
          ?.updatedBy ||
        null,

      updatedByRole:
        parsedValue?.metadata
          ?.updatedByRole ||
        null,
    },
  };
}

async function getViolationRulesConfiguration({
  connection = null,
} = {}) {
  const queryTarget =
    connection ||
    db.promise();

  const [rows] =
    await queryTarget.query(
      `
      SELECT
        setting_name,
        setting_value
      FROM system_settings
      WHERE setting_name = ?
      LIMIT 1
      `,
      [
        VIOLATION_RULES_SETTING_NAME,
      ]
    );

  if (!rows.length) {
    return null;
  }

  return parseViolationRulesSetting(
    rows[0].setting_value
  );
}

function flattenViolationRules(
  rules = []
) {
  if (
    !Array.isArray(rules)
  ) {
    return [];
  }

  return rules.flatMap(
    (group) =>
      (
        Array.isArray(
          group?.rows
        )
          ? group.rows
          : []
      ).map(
        (
          rule,
          index
        ) => ({
          ...rule,

          category:
            normalizeString(
              group?.category,
              250
            ),

          key:
            rule?.id ||
            `${
              group?.category ||
              "category"
            }-${
              rule?.section ||
              index
            }-${
              rule?.violation ||
              "violation"
            }`,
        })
      )
  );
}

function resolveViolationRule({
  rules = [],
  violation,
  section = "",
  category = "",
}) {
  const targetViolation =
    normalizeText(
      violation
    );

  const targetSection =
    normalizeText(
      section
    );

  const targetCategory =
    normalizeText(
      category
    );

  if (!targetViolation) {
    throw new ViolationPolicyError(
      "Violation type is required.",
      {
        statusCode: 400,

        code:
          "VIOLATION_REQUIRED",
      }
    );
  }

  let candidates =
    flattenViolationRules(
      rules
    ).filter(
      (rule) =>
        normalizeText(
          rule.violation
        ) ===
        targetViolation
    );

  if (targetSection) {
    candidates =
      candidates.filter(
        (rule) =>
          normalizeText(
            rule.section
          ) ===
          targetSection
      );
  }

  if (targetCategory) {
    candidates =
      candidates.filter(
        (rule) =>
          normalizeText(
            rule.category
          ) ===
          targetCategory
      );
  }

  if (
    candidates.length === 0
  ) {
    throw new ViolationPolicyError(
      "The selected violation is not valid under the current violation policy.",
      {
        statusCode: 400,

        code:
          "VIOLATION_NOT_FOUND",
      }
    );
  }

  if (
    candidates.length > 1
  ) {
    throw new ViolationPolicyError(
      "The selected violation is ambiguous. Please select the violation again using its current policy section and category.",
      {
        statusCode: 409,

        code:
          "AMBIGUOUS_VIOLATION",
      }
    );
  }

  return candidates[0];
}

function getHighestSeverity(
  value
) {
  const values =
    Array.isArray(value)
      ? value
      : value
        ? [value]
        : [];

  const validSeverities =
    [
      ...new Set(
        values
          .map(
            (item) =>
              normalizeString(
                item,
                50
              )
          )
          .filter(
            (item) =>
              ALLOWED_SEVERITIES.has(
                item
              )
          )
      ),
    ];

  if (
    validSeverities.length ===
    0
  ) {
    return "";
  }

  return validSeverities.reduce(
    (
      highest,
      current
    ) =>
      SEVERITY_SCORE[
        current
      ] >
      SEVERITY_SCORE[
        highest
      ]
        ? current
        : highest,
    validSeverities[0]
  );
}

function getHigherSeverity(
  current,
  next
) {
  const currentSeverity =
    getHighestSeverity(
      current
    ) ||
    "Minor";

  const nextSeverity =
    getHighestSeverity(
      next
    ) ||
    "Minor";

  return SEVERITY_SCORE[
    nextSeverity
  ] >
    SEVERITY_SCORE[
      currentSeverity
    ]
    ? nextSeverity
    : currentSeverity;
}

/*
 * Keep penalty parsing identical to the frontend
 * incidentIntelligence normalization.
 *
 * Example:
 *
 * "1st offense: Written Warning"
 *
 * becomes:
 *
 * {
 *   offenseNo: 1,
 *   label: "1st offense",
 *   action: "Written Warning"
 * }
 */
function getOrdinalLabel(
  number
) {
  const numeric =
    Number(number);

  if (numeric === 1) {
    return "1st offense";
  }

  if (numeric === 2) {
    return "2nd offense";
  }

  if (numeric === 3) {
    return "3rd offense";
  }

  return `${numeric}th offense`;
}

function normalizeClassificationPenalty(
  penalty,
  index
) {
  const offenseNo =
    index + 1;

  if (
    penalty &&
    typeof penalty ===
      "object" &&
    !Array.isArray(
      penalty
    )
  ) {
    const storedOffenseNo =
      Number(
        penalty.offenseNo
      );

    return {
      ...penalty,

      offenseNo:
        Number.isInteger(
          storedOffenseNo
        ) &&
        storedOffenseNo > 0
          ? storedOffenseNo
          : offenseNo,

      label:
        normalizeString(
          penalty.label ||
            getOrdinalLabel(
              offenseNo
            ),
          250
        ),

      action:
        normalizeString(
          penalty.action,
          2000
        ),
    };
  }

  const text =
    normalizeString(
      penalty,
      2000
    );

  if (!text) {
    return null;
  }

  const separatorIndex =
    text.indexOf(":");

  if (
    separatorIndex === -1
  ) {
    return {
      offenseNo,

      label:
        getOrdinalLabel(
          offenseNo
        ),

      action:
        text,
    };
  }

  const label =
    text
      .slice(
        0,
        separatorIndex
      )
      .trim();

  const action =
    text
      .slice(
        separatorIndex + 1
      )
      .trim();

  return {
    offenseNo,

    label:
      label ||
      getOrdinalLabel(
        offenseNo
      ),

    action:
      action ||
      text,
  };
}

function getPenaltyByOffense(
  penalties = [],
  offenseCount = 1
) {
  if (
    !Array.isArray(
      penalties
    ) ||
    penalties.length === 0
  ) {
    return null;
  }

  const normalizedPenalties =
    penalties
      .map(
        normalizeClassificationPenalty
      )
      .filter(
        (penalty) =>
          Boolean(
            penalty?.action
          )
      );

  if (
    normalizedPenalties.length ===
    0
  ) {
    return null;
  }

  const targetOffense =
    Math.max(
      1,
      Number(
        offenseCount
      ) ||
        1
    );

  const exactPenalty =
    normalizedPenalties.find(
      (penalty) =>
        Number(
          penalty.offenseNo
        ) ===
        targetOffense
    );

  return (
    exactPenalty ||
    normalizedPenalties[
      normalizedPenalties.length -
        1
    ]
  );
}

function getPenaltyText(
  penalty
) {
  if (!penalty) {
    return "";
  }

  if (
    typeof penalty ===
    "string"
  ) {
    return normalizeString(
      penalty,
      2000
    );
  }

  return normalizeString(
    penalty.action,
    2000
  );
}

function computeAutoSeverity({
  baseSeverity = "Minor",
  offenseCount = 1,
  totalEmployeeCases = 0,
  sanction = "",
  description = "",
}) {
  let severity =
    getHighestSeverity(
      baseSeverity
    ) ||
    "Minor";

  const sanctionText =
    normalizeText(
      sanction
    );

  const descriptionText =
    normalizeText(
      description
    );

  if (
    sanctionText.includes(
      "dismissal"
    ) ||
    sanctionText.includes(
      "rta"
    ) ||
    sanctionText.includes(
      "termination"
    )
  ) {
    severity =
      getHigherSeverity(
        severity,
        "Critical"
      );
  }

  if (
    Number(
      offenseCount
    ) >= 4
  ) {
    severity =
      getHigherSeverity(
        severity,
        "Critical"
      );
  } else if (
    Number(
      offenseCount
    ) >= 3
  ) {
    severity =
      getHigherSeverity(
        severity,
        "Major"
      );
  }

  /*
   * Preserve the current Incidents.jsx rule:
   *
   * Four existing employee incidents make the
   * incoming fifth incident Critical.
   */
  if (
    Number(
      totalEmployeeCases
    ) >= 4
  ) {
    severity =
      getHigherSeverity(
        severity,
        "Critical"
      );
  }

  if (
    CRITICAL_KEYWORDS.some(
      (keyword) =>
        descriptionText.includes(
          keyword
        )
    )
  ) {
    severity =
      getHigherSeverity(
        severity,
        "Critical"
      );
  }

  return severity;
}

function computeIncidentClassification({
  rule,
  offenseCount = 1,
  totalEmployeeCases = 0,
  description = "",
}) {
  if (!rule) {
    throw new ViolationPolicyError(
      "A valid violation rule is required for incident classification.",
      {
        statusCode: 400,

        code:
          "VIOLATION_RULE_REQUIRED",
      }
    );
  }

  const selectedPenalty =
    getPenaltyByOffense(
      rule.penalties,
      offenseCount
    );

  const sanction =
    getPenaltyText(
      selectedPenalty
    );

  const baseSeverity =
    getHighestSeverity(
      rule.severity
    ) ||
    "Minor";

  const severity =
    computeAutoSeverity({
      baseSeverity,
      offenseCount,
      totalEmployeeCases,
      sanction,
      description,
    });

  return {
    baseSeverity,

    offenseCount:
      Math.max(
        1,
        Number(
          offenseCount
        ) ||
          1
      ),

    selectedPenalty,
    sanction,
    severity,

    violation:
      rule.violation,

    violationSection:
      rule.section ||
      "",

    violationCategory:
      rule.category ||
      "",

    violationDescription:
      rule.description ||
      "",

    penaltyLevel:
      rule.penaltyLevel ||
      "",
  };
}

function countViolationRules(
  rules = []
) {
  if (
    !Array.isArray(rules)
  ) {
    return 0;
  }

  return rules.reduce(
    (
      total,
      group
    ) =>
      total +
      (
        Array.isArray(
          group?.rows
        )
          ? group.rows.length
          : 0
      ),
    0
  );
}

module.exports = {
  VIOLATION_RULES_SETTING_NAME,

  ViolationPolicyError,

  normalizeSeverity,
  normalizeViolationRules,
  parseViolationRulesSetting,

  getViolationRulesConfiguration,

  flattenViolationRules,
  resolveViolationRule,

  getHighestSeverity,
  getPenaltyByOffense,
  getPenaltyText,

  computeAutoSeverity,
  computeIncidentClassification,

  countViolationRules,
};