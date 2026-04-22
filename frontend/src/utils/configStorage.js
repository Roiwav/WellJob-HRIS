const VIOLATION_RULES_KEY = "welljob_violation_rules";
const KPI_THRESHOLDS_KEY = "welljob_kpi_thresholds";

const defaultViolationRules = [
  {
    id: crypto.randomUUID(),
    violationName: "Late",
    severity: "Minor",
    sanction: "Warning",
  },
  {
    id: crypto.randomUUID(),
    violationName: "Absence Without Notice",
    severity: "Major",
    sanction: "Suspension",
  },
  {
    id: crypto.randomUUID(),
    violationName: "Theft",
    severity: "Critical",
    sanction: "Termination Review",
  },
];

const defaultKPIThresholds = {
  weights: {
    minor: 1,
    major: 3,
    critical: 5,
  },
  levels: {
    low: { min: 0, max: 3 },
    medium: { min: 4, max: 7 },
    high: { min: 8, max: 999 },
  },
};

export function getViolationRules() {
  try {
    const stored = localStorage.getItem(VIOLATION_RULES_KEY);
    if (!stored) {
      localStorage.setItem(
        VIOLATION_RULES_KEY,
        JSON.stringify(defaultViolationRules)
      );
      return defaultViolationRules;
    }

    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : defaultViolationRules;
  } catch (error) {
    console.error("Failed to load violation rules:", error);
    return defaultViolationRules;
  }
}

export function saveViolationRules(rules) {
  try {
    localStorage.setItem(VIOLATION_RULES_KEY, JSON.stringify(rules));
    return true;
  } catch (error) {
    console.error("Failed to save violation rules:", error);
    return false;
  }
}

export function getKPIThresholds() {
  try {
    const stored = localStorage.getItem(KPI_THRESHOLDS_KEY);
    if (!stored) {
      localStorage.setItem(
        KPI_THRESHOLDS_KEY,
        JSON.stringify(defaultKPIThresholds)
      );
      return defaultKPIThresholds;
    }

    const parsed = JSON.parse(stored);

    return {
      weights: {
        minor: Number(parsed?.weights?.minor ?? 1),
        major: Number(parsed?.weights?.major ?? 3),
        critical: Number(parsed?.weights?.critical ?? 5),
      },
      levels: {
        low: {
          min: Number(parsed?.levels?.low?.min ?? 0),
          max: Number(parsed?.levels?.low?.max ?? 3),
        },
        medium: {
          min: Number(parsed?.levels?.medium?.min ?? 4),
          max: Number(parsed?.levels?.medium?.max ?? 7),
        },
        high: {
          min: Number(parsed?.levels?.high?.min ?? 8),
          max: Number(parsed?.levels?.high?.max ?? 999),
        },
      },
    };
  } catch (error) {
    console.error("Failed to load KPI thresholds:", error);
    return defaultKPIThresholds;
  }
}

export function saveKPIThresholds(thresholds) {
  try {
    localStorage.setItem(KPI_THRESHOLDS_KEY, JSON.stringify(thresholds));
    return true;
  } catch (error) {
    console.error("Failed to save KPI thresholds:", error);
    return false;
  }
}

export function getSeverityByViolation(violationName) {
  const rules = getViolationRules();
  const match = rules.find(
    (rule) =>
      rule.violationName.trim().toLowerCase() ===
      String(violationName).trim().toLowerCase()
  );

  return match ? match.severity : "";
}

export function getSanctionByViolation(violationName) {
  const rules = getViolationRules();
  const match = rules.find(
    (rule) =>
      rule.violationName.trim().toLowerCase() ===
      String(violationName).trim().toLowerCase()
  );

  return match ? match.sanction : "";
}

export function getSeverityWeight(severity) {
  const thresholds = getKPIThresholds();

  switch (String(severity).toLowerCase()) {
    case "minor":
      return thresholds.weights.minor;
    case "major":
      return thresholds.weights.major;
    case "critical":
      return thresholds.weights.critical;
    default:
      return 0;
  }
}

export function getKPILevel(score) {
  const thresholds = getKPIThresholds();
  const numericScore = Number(score) || 0;

  const { low, medium, high } = thresholds.levels;

  if (numericScore >= low.min && numericScore <= low.max) return "Low";
  if (numericScore >= medium.min && numericScore <= medium.max) return "Medium";
  if (numericScore >= high.min && numericScore <= high.max) return "High";

  return "Unclassified";
}