import { NORMALIZED_VIOLATION_RULES } from "../data/violationRules";

const SEVERITY_SCORE = {
  Minor: 1,
  Major: 2,
  Critical: 3,
};

const SLA_DAYS = {
  Minor: 7,
  Major: 5,
  Critical: 2,
};

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

function toDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? null
    : date;
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function hasPersistedIncidentId(
  incident
) {
  const id =
    incident?.id ??
    incident?.incidentId ??
    incident?.incident_id;

  return (
    id !== undefined &&
    id !== null &&
    String(id).trim() !==
      ""
  );
}

function getPersistedPolicySanction(
  incident
) {
  return String(
    incident?.policySanction ||
      incident?.policy_sanction ||
      incident?.sanction ||
      ""
  ).trim();
}

function normalizeSeverityList(value) {
  const values = Array.isArray(value)
    ? value
    : value
      ? [value]
      : [];

  return [
    ...new Set(
      values
        .map((item) =>
          String(item || "").trim()
        )
        .filter(
          (item) =>
            Object.hasOwn(
              SEVERITY_SCORE,
              item
            )
        )
    ),
  ];
}

function getHighestSeverity(value) {
  const severities =
    normalizeSeverityList(value);

  if (!severities.length) {
    return "";
  }

  return severities.reduce(
    (highest, severity) =>
      SEVERITY_SCORE[severity] >
      SEVERITY_SCORE[highest]
        ? severity
        : highest,
    severities[0]
  );
}

function getOrdinalLabel(number) {
  const numeric = Number(number);

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

function normalizePenalty(
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
        String(
          penalty.label ||
            getOrdinalLabel(
              offenseNo
            )
        ).trim(),

      action:
        String(
          penalty.action ||
            ""
        ).trim(),
    };
  }

  const text =
    String(
      penalty || ""
    ).trim();

  if (!text) {
    return null;
  }

  const separatorIndex =
    text.indexOf(
      ":"
    );

  if (
    separatorIndex ===
    -1
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

function normalizePenalties(
  penalties = []
) {
  if (
    !Array.isArray(
      penalties
    )
  ) {
    return [];
  }

  return penalties
    .map(
      normalizePenalty
    )
    .filter(Boolean);
}

function normalizePolicyGroups(
  policyRules
) {
  return (
    Array.isArray(
      policyRules
    ) &&
    policyRules.length >
      0
      ? policyRules
      : NORMALIZED_VIOLATION_RULES
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
 * Converts grouped policy rules into the flat
 * structure used by incident creation.
 *
 * policyRules is optional so existing callers
 * remain compatible. When omitted, the immutable
 * default Code of Conduct remains the fallback.
 */
export function flattenViolationRules(
  policyRules =
    NORMALIZED_VIOLATION_RULES
) {
  return normalizePolicyGroups(
    policyRules
  ).flatMap(
    (group) =>
      (
        group?.rows ||
        []
      ).map(
        (
          rule,
          index
        ) => {
          const severityMapping =
            normalizeSeverityList(
              rule?.severity
            );

          return {
            ...rule,

            category:
              String(
                group?.category ||
                  ""
              ).trim(),

            severity:
              getHighestSeverity(
                severityMapping
              ) ||
              "Minor",

            severityMapping,

            penalties:
              normalizePenalties(
                rule?.penalties
              ),

            key:
              rule?.id ||
              `${group?.category || "category"}-${rule?.section || index}-${rule?.violation || "violation"}`,
          };
        }
      )
  );
}

export function findViolationRule(
  violationName,
  policyRules =
    NORMALIZED_VIOLATION_RULES
) {
  const target =
    normalizeText(
      violationName
    );

  if (!target) {
    return undefined;
  }

  return flattenViolationRules(
    policyRules
  ).find(
    (rule) =>
      normalizeText(
        rule.violation
      ) === target
  );
}

export function getIncidentEmployeeKey(
  incident
) {
  return String(
    incident?.employeeId ||
      incident?.employee_id ||
      incident?.employeeID ||
      incident?.employee ||
      ""
  ).trim();
}

export function getIncidentViolationKey(
  incident
) {
  return String(
    incident?.violation ||
      incident?.violationType ||
      incident?.violation_type ||
      ""
  ).trim();
}

export function getPreviousSameViolationCount(
  existingIncidents = [],
  employeeId,
  violationName,
  currentIncidentId = null
) {
  const targetEmployee =
    String(
      employeeId ||
        ""
    ).trim();

  const targetViolation =
    String(
      violationName ||
        ""
    ).trim();

  if (
    !targetEmployee ||
    !targetViolation
  ) {
    return 0;
  }

  return existingIncidents.filter(
    (incident) => {
      const sameEmployee =
        getIncidentEmployeeKey(
          incident
        ) ===
        targetEmployee;

      const sameViolation =
        getIncidentViolationKey(
          incident
        ) ===
        targetViolation;

      const notCurrent =
        currentIncidentId
          ? String(
              incident.id
            ) !==
            String(
              currentIncidentId
            )
          : true;

      return (
        sameEmployee &&
        sameViolation &&
        notCurrent
      );
    }
  ).length;
}

export function getNextOffenseCount(
  existingIncidents = [],
  employeeId,
  violationName,
  currentIncidentId = null
) {
  return (
    getPreviousSameViolationCount(
      existingIncidents,
      employeeId,
      violationName,
      currentIncidentId
    ) + 1
  );
}

export function getPenaltyByOffense(
  penalties = [],
  offenseCount = 1
) {
  const normalizedPenalties =
    normalizePenalties(
      penalties
    );

  if (
    normalizedPenalties.length ===
    0
  ) {
    return null;
  }

  const targetOffense =
    Number(
      offenseCount
    ) ||
    1;

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

export function getPenaltyText(
  penalty
) {
  if (!penalty) {
    return "";
  }

  if (
    typeof penalty ===
    "string"
  ) {
    return penalty.trim();
  }

  return String(
    penalty.action ||
      ""
  ).trim();
}

export function computeAutoSeverity({
  baseSeverity = "Minor",
  offenseCount = 1,
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
    ) >=
    4
  ) {
    severity =
      getHigherSeverity(
        severity,
        "Critical"
      );
  } else if (
    Number(
      offenseCount
    ) >=
    3
  ) {
    severity =
      getHigherSeverity(
        severity,
        "Major"
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

export function getCaseAgeDays(
  incident
) {
  const startDate =
    toDate(
      incident?.reportedAt ||
        incident?.date
    );

  if (!startDate) {
    return 0;
  }

  const diff =
    Date.now() -
    startDate.getTime();

  return Math.max(
    0,
    Math.floor(
      diff /
        (
          1000 *
          60 *
          60 *
          24
        )
    )
  );
}

export function getCaseAging(
  incident
) {
  const ageDays =
    getCaseAgeDays(
      incident
    );

  const severity =
    getHighestSeverity(
      incident?.severity
    ) ||
    "Minor";

  const slaDays =
    SLA_DAYS[
      severity
    ] ||
    7;

  const isClosed =
    incident?.status ===
    "Closed";

  let bucket =
    "0–2 days";

  if (
    ageDays >= 3 &&
    ageDays <= 7
  ) {
    bucket =
      "3–7 days";
  } else if (
    ageDays >= 8 &&
    ageDays <= 30
  ) {
    bucket =
      "8–30 days";
  } else if (
    ageDays > 30
  ) {
    bucket =
      "30+ days";
  }

  return {
    ageDays,
    bucket,
    slaDays,

    isOverdue:
      !isClosed &&
      ageDays >
        slaDays,

    remainingDays:
      Math.max(
        0,
        slaDays -
          ageDays
      ),
  };
}

export function getRecommendation({
  severity = "Minor",
  offenseCount = 1,
  sanction = "",
  status = "Open",
}) {
  const normalizedSeverity =
    getHighestSeverity(
      severity
    ) ||
    "Minor";

  if (
    status ===
    "Closed"
  ) {
    return "Case is already closed. Keep record for audit and future reference.";
  }

  if (
    normalizedSeverity ===
    "Critical"
  ) {
    return "Immediate HR review required. Prioritize investigation, secure evidence, and escalate to Super Admin.";
  }

  if (
    Number(
      offenseCount
    ) >=
    4
  ) {
    return "Repeated offense detected. Recommend management review and stronger disciplinary action based on policy.";
  }

  if (
    normalizedSeverity ===
    "Major"
  ) {
    return "Start investigation promptly and prepare supporting documents before submitting for review.";
  }

  if (sanction) {
    return `Recommended action: ${sanction}. Monitor employee record for repeated violations.`;
  }

  return "Review the case details and proceed with the standard disciplinary workflow.";
}

export function getSmartAlerts(
  incident
) {
  const alerts =
    [];

  const aging =
    getCaseAging(
      incident
    );

  const severity =
    getHighestSeverity(
      incident?.severity
    ) ||
    "Minor";

  const status =
    incident?.status ||
    "Open";

  if (
    severity ===
      "Critical" &&
    status !==
      "Closed"
  ) {
    alerts.push({
      id:
        "critical-case",

      level:
        "critical",

      title:
        "Critical incident",

      message:
        "This case requires immediate review and prioritization.",
    });
  }

  if (
    aging.isOverdue
  ) {
    alerts.push({
      id:
        "overdue-case",

      level:
        "warning",

      title:
        "Overdue case",

      message:
        `This case is ${aging.ageDays} day(s) old and exceeded the ${aging.slaDays}-day target.`,
    });
  }

  if (
    status ===
    "For Review"
  ) {
    alerts.push({
      id:
        "for-review",

      level:
        "info",

      title:
        "Pending Super Admin review",

      message:
        "Resolution proof has been submitted and is waiting for final review.",
    });
  }

  if (
    Number(
      incident?.offenseCount ||
        1
    ) >=
    3
  ) {
    alerts.push({
      id:
        "repeat-offense",

      level:
        "warning",

      title:
        "Repeated offense",

      message:
        `This is the employee's ${incident.offenseCount} offense for the same violation.`,
    });
  }

  return alerts;
}

/*
 * ==================================================
 * INCIDENT DECISION-SUPPORT ENRICHMENT
 * ==================================================
 *
 * Persisted historical incident values always take
 * precedence over the current violation policy.
 *
 * This is critical because Code of Conduct rules may
 * change after an incident has already been created.
 *
 * A persisted incident must therefore never silently
 * receive a new sanction or severity just because the
 * current policy configuration changed.
 *
 * Current policy fallback is permitted only for an
 * unsaved/new incident draft that does not yet have a
 * database identity.
 *
 * policyRules remains optional so existing callers
 * using:
 *
 *   enrichIncidentIntelligence(
 *     incident,
 *     existingIncidents
 *   )
 *
 * remain compatible.
 */
export function enrichIncidentIntelligence(
  incident,
  existingIncidents = [],
  policyRules =
    NORMALIZED_VIOLATION_RULES
) {
  const rule =
    findViolationRule(
      incident?.violation,
      policyRules
    );

  const storedPenalties =
    Array.isArray(
      incident?.penalties
    )
      ? incident.penalties
      : null;

  const penalties =
    storedPenalties !==
    null
      ? normalizePenalties(
          storedPenalties
        )
      : rule?.penalties ||
        [];

  const storedOffenseCount =
    Number(
      incident?.offenseCount
    );

  const offenseCount =
    Number.isFinite(
      storedOffenseCount
    ) &&
    storedOffenseCount >
      0
      ? storedOffenseCount
      : getNextOffenseCount(
          existingIncidents,
          incident?.employeeId,
          incident?.violation,
          incident?.id
        );

  const selectedPenalty =
    incident?.selectedPenalty ||
    getPenaltyByOffense(
      penalties,
      offenseCount
    );

  const isPersistedIncident =
    hasPersistedIncidentId(
      incident
    );

  const persistedPolicySanction =
    getPersistedPolicySanction(
      incident
    );

  /*
   * IMPORTANT:
   *
   * Persisted DB records do NOT fall back to the
   * current policy.
   *
   * If an older historical record has no preserved
   * policy sanction, leaving it blank is safer than
   * incorrectly assigning today's policy value.
   *
   * Unsaved incident drafts may still derive the
   * sanction from the currently configured policy.
   */
  const sanction =
    isPersistedIncident
      ? persistedPolicySanction
      : (
          persistedPolicySanction ||
          getPenaltyText(
            selectedPenalty
          ) ||
          rule?.penaltyLevel ||
          ""
        );

  /*
   * Preserve already-persisted severity.
   *
   * Only incidents without a stored valid severity
   * are classified from the current policy.
   */
  const storedSeverity =
    getHighestSeverity(
      incident?.severity
    );

  const severity =
    storedSeverity ||
    computeAutoSeverity({
      baseSeverity:
        rule?.severity ||
        "Minor",

      offenseCount,
      sanction,

      description:
        incident?.description,
    });

  const enriched = {
    ...incident,

    violationCategory:
      incident?.violationCategory ||
      rule?.category ||
      "",

    violationSection:
      incident?.violationSection ||
      rule?.section ||
      "",

    violationDescription:
      incident?.violationDescription ||
      rule?.description ||
      "",

    penaltyLevel:
      incident?.penaltyLevel ||
      rule?.penaltyLevel ||
      "",

    penalties,

    offenseCount,

    selectedPenalty,

    /*
     * Canonical frontend policy-sanction fields.
     *
     * sanction remains supported because the current
     * incident UI already uses that property.
     */
    sanction,

    policySanction:
      sanction,

    policy_sanction:
      sanction,

    severity,
  };

  const aging =
    getCaseAging(
      enriched
    );

  return {
    ...enriched,

    caseAgeDays:
      aging.ageDays,

    caseAgeBucket:
      aging.bucket,

    slaDays:
      aging.slaDays,

    isOverdue:
      aging.isOverdue,

    recommendation:
      getRecommendation(
        enriched
      ),

    smartAlerts:
      getSmartAlerts(
        enriched
      ),
  };
}