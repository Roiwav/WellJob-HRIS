const VIOLATION_RULES_KEY = "welljob_violation_rules";
const KPI_THRESHOLDS_KEY = "welljob_kpi_thresholds";

/*
 * LAN-SAFE CLIENT ID
 *
 * crypto.randomUUID() may be unavailable when the
 * frontend is opened from another device through
 * plain HTTP, such as:
 *
 * http://192.168.1.39:5173
 *
 * These IDs are only local configuration record IDs,
 * so a standards-based random UUID fallback is safe.
 */
function createStorageId() {
  const cryptoApi = globalThis.crypto;

  if (
    cryptoApi &&
    typeof cryptoApi.randomUUID === "function"
  ) {
    return cryptoApi.randomUUID();
  }

  if (
    cryptoApi &&
    typeof cryptoApi.getRandomValues === "function"
  ) {
    const bytes = new Uint8Array(16);

    cryptoApi.getRandomValues(bytes);

    // UUID v4 version / variant bits.
    bytes[6] =
      (bytes[6] & 0x0f) | 0x40;

    bytes[8] =
      (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(
      bytes,
      (byte) =>
        byte
          .toString(16)
          .padStart(2, "0")
    ).join("");

    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20),
    ].join("-");
  }

  /*
   * Last-resort compatibility fallback.
   *
   * This is not used for authentication,
   * authorization, tokens, or security secrets.
   * It is only a localStorage record identifier.
   */
  return [
    "local",
    Date.now().toString(36),
    Math.random()
      .toString(36)
      .slice(2, 10),
    Math.random()
      .toString(36)
      .slice(2, 10),
  ].join("-");
}

const defaultViolationRules = [
  {
    id: createStorageId(),
    violationName: "Late",
    severity: "Minor",
    sanction: "Warning",
  },
  {
    id: createStorageId(),
    violationName: "Absence Without Notice",
    severity: "Major",
    sanction: "Suspension",
  },
  {
    id: createStorageId(),
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
    low: {
      min: 0,
      max: 3,
    },
    medium: {
      min: 4,
      max: 7,
    },
    high: {
      min: 8,
      max: 999,
    },
  },
};

export function getViolationRules() {
  try {
    const stored =
      localStorage.getItem(
        VIOLATION_RULES_KEY
      );

    if (!stored) {
      localStorage.setItem(
        VIOLATION_RULES_KEY,
        JSON.stringify(
          defaultViolationRules
        )
      );

      return defaultViolationRules;
    }

    const parsed =
      JSON.parse(stored);

    return Array.isArray(parsed)
      ? parsed
      : defaultViolationRules;
  } catch (error) {
    console.error(
      "Failed to load violation rules:",
      error
    );

    return defaultViolationRules;
  }
}

export function saveViolationRules(
  rules
) {
  try {
    localStorage.setItem(
      VIOLATION_RULES_KEY,
      JSON.stringify(rules)
    );

    return true;
  } catch (error) {
    console.error(
      "Failed to save violation rules:",
      error
    );

    return false;
  }
}

export function getKPIThresholds() {
  try {
    const stored =
      localStorage.getItem(
        KPI_THRESHOLDS_KEY
      );

    if (!stored) {
      localStorage.setItem(
        KPI_THRESHOLDS_KEY,
        JSON.stringify(
          defaultKPIThresholds
        )
      );

      return defaultKPIThresholds;
    }

    const parsed =
      JSON.parse(stored);

    return {
      weights: {
        minor: Number(
          parsed?.weights?.minor ??
            1
        ),

        major: Number(
          parsed?.weights?.major ??
            3
        ),

        critical: Number(
          parsed?.weights
            ?.critical ?? 5
        ),
      },

      levels: {
        low: {
          min: Number(
            parsed?.levels?.low
              ?.min ?? 0
          ),

          max: Number(
            parsed?.levels?.low
              ?.max ?? 3
          ),
        },

        medium: {
          min: Number(
            parsed?.levels?.medium
?.min ?? 4
          ),

          max: Number(
            parsed?.levels?.medium
              ?.max ?? 7
          ),
        },

        high: {
          min: Number(
            parsed?.levels?.high
              ?.min ?? 8
          ),

          max: Number(
            parsed?.levels?.high
              ?.max ?? 999
          ),
        },
      },
    };
  } catch (error) {
    console.error(
      "Failed to load KPI thresholds:",
      error
    );

    return defaultKPIThresholds;
  }
}

export function saveKPIThresholds(
  thresholds
) {
  try {
    localStorage.setItem(
      KPI_THRESHOLDS_KEY,
      JSON.stringify(thresholds)
    );

    return true;
  } catch (error) {
    console.error(
      "Failed to save KPI thresholds:",
      error
    );

    return false;
  }
}

export function getSeverityByViolation(
  violationName
) {
  const rules =
    getViolationRules();

  const normalizedViolation =
    String(violationName || "")
      .trim()
      .toLowerCase();

  const match =
    rules.find(
      (rule) =>
        String(
          rule.violationName || ""
        )
          .trim()
          .toLowerCase() ===
        normalizedViolation
    );

  return match
    ? match.severity
    : "";
}

export function getSanctionByViolation(
  violationName
) {
  const rules =
    getViolationRules();

  const normalizedViolation =
    String(violationName || "")
      .trim()
      .toLowerCase();

  const match =
    rules.find(
      (rule) =>
        String(
          rule.violationName || ""
        )
          .trim()
          .toLowerCase() ===
        normalizedViolation
    );

  return match
    ? match.sanction
    : "";
}

export function getSeverityWeight(
  severity
) {
  const thresholds =
    getKPIThresholds();

  switch (
    String(severity || "")
      .toLowerCase()
  ) {
    case "minor":
      return thresholds.weights.minor;

    case "major":
      return thresholds.weights.major;

    case "critical":
      return thresholds.weights
        .critical;

    default:
      return 0;
  }
}

export function getKPILevel(score) {
  const thresholds =
    getKPIThresholds();

  const numericScore =
    Number(score) || 0;

  const {
    low,
    medium,
    high,
  } = thresholds.levels;

  if (
    numericScore >= low.min &&
    numericScore <= low.max
  ) {
    return "Low";
  }

  if (
    numericScore >= medium.min &&
    numericScore <= medium.max
  ) {
    return "Medium";
  }

  if (
    numericScore >= high.min &&
    numericScore <= high.max
  ) {
    return "High";
  }

  return "Unclassified";
}