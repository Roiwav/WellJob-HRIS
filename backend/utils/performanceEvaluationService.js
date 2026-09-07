const db = require("../config/db");

const PERFORMANCE_EVALUATION_SETTING_NAME =
  "performance_evaluation_framework";

const PERFORMANCE_EVALUATION_SCHEMA_VERSION = 2;

const MAX_RATING_SCALE_ITEMS = 20;
const MAX_KPI_FACTORS = 50;
const MAX_CRITERIA_PER_FACTOR = 100;

const WEIGHT_TOLERANCE = 0.0001;

const DEFAULT_RATING_SCALE = [
  {
    id: "rating-unsatisfactory",
    min: 0,
    max: 74,
    rating: "UNSATISFACTORY",
    description:
      "Performance level is absolutely UNACCEPTABLE; FAILS to meet minimum requirements",
    frequency:
      "Frequency of Poor Rating: 1st - Considered one more chance | 2nd - Demotion | 3rd - Termination",
  },
  {
    id: "rating-below-satisfactory",
    min: 75,
    max: 79,
    rating: "BELOW SATISFACTORY",
    description:
      "Performance level is NORMALLY ACCEPTABLE; meets minimum requirements",
    frequency: "",
  },
  {
    id: "rating-satisfactory",
    min: 80,
    max: 87,
    rating: "SATISFACTORY",
    description:
      "Performance level is MODERATELY ACCEPTABLE; OCCASIONALLY exceeds requirements",
    frequency: "",
  },
  {
    id: "rating-very-satisfactory",
    min: 88,
    max: 94,
    rating: "VERY SATISFACTORY",
    description:
      "Performance level is HIGHLY ACCEPTABLE; FREQUENTLY exceeds requirements",
    frequency: "",
  },
  {
    id: "rating-excellent",
    min: 95,
    max: 100,
    rating: "EXCELLENT",
    description:
      "Performance level is EXCEPTIONAL; CONSISTENTLY exceeds requirements",
    frequency: "",
  },
];

const DEFAULT_KPI_FACTORS = [
  {
    id: "factor-attendance",
    weight: 10,
    factor: "I. ATTENDANCE AND PUNCTUALITY",
    description: "(Pagpasok at kahustuhan sa oras)",
    criteria: [
      {
        id: "attendance-leave-with-permission",
        name: "No. of leave of absences",
        description:
          "Bilang ng araw ng pagliban na may kaukulang pahintulot",
      },
      {
        id: "attendance-without-leave",
        name: "No. of Absences without Leave",
        description:
          "Bilang ng pagliban na walang pahintulot",
      },
      {
        id: "attendance-tardiness",
        name: "Accumulated Tardiness",
        description:
          "Kabuuang bilang sa huling oras na itinakda sa pagpasok",
      },
      {
        id: "attendance-undertime",
        name: "Unauthorized Undertime",
        description:
          "Hindi pagbuo sa walong oras (8) na itinakdang pagpasok",
      },
    ],
  },
  {
    id: "factor-safety",
    weight: 15,
    factor: "II. SAFETY AND HOUSEKEEPING",
    description:
      "Concern for order and cleanliness of work area, including proper decorum at work.",
    criteria: [
      {
        id: "safety-5s",
        name: "Understanding / implementing 5’s",
        description:
          "Pagpapanatili ng kaayusan at kalinisan sa trabaho",
      },
    ],
  },
  {
    id: "factor-dependability",
    weight: 5,
    factor: "III. DEPENDABILITY AND RELIABILITY",
    description:
      "Worthy of confidence, responsible, tried and true solidness; trustability.",
    criteria: [
      {
        id: "dependability-reliability",
        name: "Dependability and Reliability",
        description:
          "Mapagkakatiwalaan at mapapanagutan sa trabaho",
      },
    ],
  },
  {
    id: "factor-attitude",
    weight: 20,
    factor: "IV. JOB WORK ATTITUDE / BEHAVIOR",
    description:
      "General attitude toward work such as desire for self-improvement willingness to help and cooperate with the group, inherent trait of flexibility and resourcefulness in handling situation.",
    criteria: [
      {
        id: "attitude-behavior",
        name: "Job Work Attitude / Behavior",
        description:
          "Kabuuang pagpapakita sa saloobin patungkol sa trabaho, pagpapabuti sa sarili, kahandaang tumulong at makipagtulungan sa pangkat, kakayahang umangkop, at kapamaraanan sa paghawak ng sitwasyon",
      },
    ],
  },
  {
    id: "factor-completion",
    weight: 50,
    factor: "V. COMPLETION OF WORK",
    description:
      "Ability to meet deadlines and target output. (Kakayahang matapos ang gawain sa itinakdang araw)",
    criteria: [
      {
        id: "completion-work",
        name: "Completion of Work",
        description:
          "Kakayahang matapos ang gawain sa itinakdang araw",
      },
      {
        id: "completion-quality-efficiency",
        name: "QUALITY AND EFFICIENCY",
        description:
          "Kalidad at kahusayan sa trabaho",
      },
      {
        id: "completion-accuracy",
        name: "ACCURACY",
        description:
          "Katumpakan o ganap na kawastuhan",
      },
      {
        id: "completion-timeliness",
        name: "TIMELINESS",
        description:
          "Pagiging napapanahon o maagap",
      },
      {
        id: "completion-implementation-execution",
        name: "IMPLEMENTATION AND EXECUTION",
        description:
          "Pagsasagawa at pagsasakatuparan",
      },
    ],
  },
];

const LEGACY_DEFAULT_SUB_FACTORS = {
  "factor-attendance": [
    "No. of leave of absences",
    "(bilang ng araw ng pagliban na may kaukulang pahintulot)",
    "No. of Absences without Leave",
    "(bilang ng pagliban na walang pahintulot)",
    "Accumulated Tardiness",
    "(kabuuang bilang sa huling oras na itinakda sa pagpasok)",
    "Unauthorized Undertime",
    "(hindi pagbuo sa walong oras (8) na itinakdang pagpasok)",
  ],

  "factor-safety": [
    "Understanding / implementing 5’s",
    "(pagpapanatili ng kaayusan at kalinisan sa trabaho)",
  ],

  "factor-dependability": [
    "(Mapagkakatiwalaan at mapapanagutan sa trabaho)",
  ],

  "factor-attitude": [
    "Kabuuang pagpapakita sa saloobin patungkol sa trabaho",
    "pagpapabuti sa sarili, kahandaang tumulong",
    "At makipagtulungan sa pangkat at kakayahang umangkop",
    "at kapamaraanan sa paghawak ng sitwasyon",
  ],

  "factor-completion": [
    "(Kakayahang matapos ang gawain sa itinakdang araw)",
    "QUALITY AND EFFICIENCY (Kalidad at kahusayan sa trabaho)",
    "ACCURACY (Katumpakan o ganap na kawastuhan)",
    "TIMELINESS (Pagiging napapanahon o maagap)",
    "IMPLEMENTATION AND EXECUTION (Pagsasagawa at pagsasakatuparan)",
  ],
};

class PerformanceEvaluationError extends Error {
  constructor(
    message,
    {
      statusCode = 400,
      code = "PERFORMANCE_EVALUATION_ERROR",
    } = {}
  ) {
    super(message);

    this.name = "PerformanceEvaluationError";
    this.statusCode = statusCode;
    this.code = code;
    this.isPerformanceEvaluationError = true;
  }
}

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeString(
  value,
  maxLength = null
) {
  const normalized = String(
    value ?? ""
  ).trim();

  if (
    maxLength &&
    normalized.length > maxLength
  ) {
    return normalized.slice(
      0,
      maxLength
    );
  }

  return normalized;
}

function stripOuterParentheses(value) {
  const normalized =
    normalizeString(value);

  if (
    normalized.startsWith("(") &&
    normalized.endsWith(")") &&
    normalized.length > 2
  ) {
    return normalized
      .slice(1, -1)
      .trim();
  }

  return normalized;
}

function normalizeComparableLegacyList(
  values
) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values.map((value) =>
    normalizeString(value)
  );
}

function isKnownLegacyDefaultFactor(
  factorId,
  subFactors
) {
  const expected =
    LEGACY_DEFAULT_SUB_FACTORS[
      factorId
    ];

  if (
    !expected ||
    !Array.isArray(subFactors)
  ) {
    return false;
  }

  const actualNormalized =
    normalizeComparableLegacyList(
      subFactors
    );

  const expectedNormalized =
    normalizeComparableLegacyList(
      expected
    );

  if (
    actualNormalized.length !==
    expectedNormalized.length
  ) {
    return false;
  }

  return actualNormalized.every(
    (value, index) =>
      value ===
      expectedNormalized[index]
  );
}

function buildLegacyFallbackCriteria(
  factorId,
  subFactors
) {
  const normalizedValues =
    normalizeComparableLegacyList(
      subFactors
    ).filter(Boolean);

  const criteria = [];

  for (const value of normalizedValues) {
    const isParenthesized =
      value.startsWith("(") &&
      value.endsWith(")");

    if (
      isParenthesized &&
      criteria.length > 0
    ) {
      const previous =
        criteria[
          criteria.length - 1
        ];

      if (!previous.description) {
        previous.description =
          stripOuterParentheses(
            value
          );

        continue;
      }
    }

    const position =
      criteria.length + 1;

    criteria.push({
      id:
        `${
          factorId || "factor"
        }-criterion-${position}`,

      name:
        stripOuterParentheses(
          value
        ),

      description: "",
    });
  }

  return criteria;
}

function migrateLegacyCriteria(
  item,
  factorId
) {
  if (
    !Array.isArray(
      item?.subFactors
    )
  ) {
    return null;
  }

  if (
    isKnownLegacyDefaultFactor(
      factorId,
      item.subFactors
    )
  ) {
    const defaultFactor =
      DEFAULT_KPI_FACTORS.find(
        (factor) =>
          factor.id === factorId
      );

    if (defaultFactor) {
      return cloneValue(
        defaultFactor.criteria
      );
    }
  }

  return buildLegacyFallbackCriteria(
    factorId,
    item.subFactors
  );
}

function getDefaultPerformanceEvaluationConfiguration() {
  return {
    schemaVersion:
      PERFORMANCE_EVALUATION_SCHEMA_VERSION,

    ratingScale:
      cloneValue(
        DEFAULT_RATING_SCALE
      ),

    kpiFactors:
      cloneValue(
        DEFAULT_KPI_FACTORS
      ),

    metadata: {
      updatedAt: null,
      updatedBy: null,
      updatedByRole: null,
    },
  };
}

function normalizeRatingScale(
  ratingScale
) {
  if (
    !Array.isArray(
      ratingScale
    )
  ) {
    return {
      valid: false,
      error:
        "Performance rating scale must be an array.",
      ratingScale: [],
    };
  }

  if (
    ratingScale.length === 0
  ) {
    return {
      valid: false,
      error:
        "At least one performance rating range is required.",
      ratingScale: [],
    };
  }

  if (
    ratingScale.length >
    MAX_RATING_SCALE_ITEMS
  ) {
    return {
      valid: false,
      error:
        `Performance rating scale cannot contain more than ${MAX_RATING_SCALE_ITEMS} ranges.`,
      ratingScale: [],
    };
  }

  const normalizedItems = [];
  const usedIds = new Set();

  for (
    let index = 0;
    index < ratingScale.length;
    index += 1
  ) {
    const item =
      ratingScale[index];

    const position =
      index + 1;

    if (
      !item ||
      typeof item !== "object" ||
      Array.isArray(item)
    ) {
      return {
        valid: false,
        error:
          `Performance rating range ${position} is invalid.`,
        ratingScale: [],
      };
    }

    const id =
      normalizeString(
        item.id ||
          `rating-${position}`,
        255
      );

    const min =
      Number(item.min);

    const max =
      Number(item.max);

    const rating =
      normalizeString(
        item.rating,
        150
      );

    const description =
      normalizeString(
        item.description,
        4000
      );

    const frequency =
      normalizeString(
        item.frequency,
        4000
      );

    if (usedIds.has(id)) {
      return {
        valid: false,
        error:
          `Performance rating range ${position} has a duplicate ID.`,
        ratingScale: [],
      };
    }

    usedIds.add(id);

    if (
      !Number.isInteger(min) ||
      !Number.isInteger(max)
    ) {
      return {
        valid: false,
        error:
          `Performance rating range ${position} must use whole-number percentage values.`,
        ratingScale: [],
      };
    }

    if (
      min < 0 ||
      max > 100
    ) {
      return {
        valid: false,
        error:
          `Performance rating range ${position} must remain between 0% and 100%.`,
        ratingScale: [],
      };
    }

    if (min > max) {
      return {
        valid: false,
        error:
          `Performance rating range ${position} has a minimum value greater than its maximum value.`,
        ratingScale: [],
      };
    }

    if (!rating) {
      return {
        valid: false,
        error:
          `Performance rating range ${position} must have a rating name.`,
        ratingScale: [],
      };
    }

    if (!description) {
      return {
        valid: false,
        error:
          `Performance rating range ${position} must have a description.`,
        ratingScale: [],
      };
    }

    normalizedItems.push({
      id,
      min,
      max,
      rating,
      description,
      frequency,
    });
  }

  const sortedItems = [
    ...normalizedItems,
  ].sort(
    (first, second) =>
      first.min - second.min
  );

  if (
    sortedItems[0].min !== 0
  ) {
    return {
      valid: false,
      error:
        "The first performance rating range must begin at 0%.",
      ratingScale: [],
    };
  }

  for (
    let index = 1;
    index < sortedItems.length;
    index += 1
  ) {
    const previous =
      sortedItems[index - 1];

    const current =
      sortedItems[index];

    if (
      current.min <=
      previous.max
    ) {
      return {
        valid: false,
        error:
          `Performance rating ranges ${index} and ${index + 1} overlap.`,
        ratingScale: [],
      };
    }

    if (
      current.min !==
      previous.max + 1
    ) {
      return {
        valid: false,
        error:
          `There is a gap between performance rating ranges ${index} and ${index + 1}.`,
        ratingScale: [],
      };
    }
  }

  if (
    sortedItems[
      sortedItems.length - 1
    ].max !== 100
  ) {
    return {
      valid: false,
      error:
        "The final performance rating range must end at 100%.",
      ratingScale: [],
    };
  }

  return {
    valid: true,
    error: null,
    ratingScale:
      sortedItems,
  };
}

function normalizeCriteria(
  criteria,
  factorId,
  factorPosition
) {
  if (
    !Array.isArray(criteria)
  ) {
    return {
      valid: false,
      error:
        `KPI factor ${factorPosition} must contain an evaluation criteria list.`,
      criteria: [],
    };
  }

  if (
    criteria.length === 0
  ) {
    return {
      valid: false,
      error:
        `KPI factor ${factorPosition} must contain at least one evaluation criterion.`,
      criteria: [],
    };
  }

  if (
    criteria.length >
    MAX_CRITERIA_PER_FACTOR
  ) {
    return {
      valid: false,
      error:
        `KPI factor ${factorPosition} cannot contain more than ${MAX_CRITERIA_PER_FACTOR} evaluation criteria.`,
      criteria: [],
    };
  }

  const normalizedCriteria = [];
  const usedIds = new Set();

  for (
    let index = 0;
    index < criteria.length;
    index += 1
  ) {
    const criterion =
      criteria[index];

    const position =
      index + 1;

    if (
      !criterion ||
      typeof criterion !==
        "object" ||
      Array.isArray(criterion)
    ) {
      return {
        valid: false,
        error:
          `Evaluation criterion ${position} under KPI factor ${factorPosition} is invalid.`,
        criteria: [],
      };
    }

    const id =
      normalizeString(
        criterion.id ||
          `${factorId}-criterion-${position}`,
        255
      );

    const name =
      normalizeString(
        criterion.name,
        1000
      );

    const description =
      normalizeString(
        criterion.description,
        4000
      );

    if (usedIds.has(id)) {
      return {
        valid: false,
        error:
          `Evaluation criterion ${position} under KPI factor ${factorPosition} has a duplicate ID.`,
        criteria: [],
      };
    }

    usedIds.add(id);

    if (!name) {
      return {
        valid: false,
        error:
          `Evaluation criterion ${position} under KPI factor ${factorPosition} must have a name.`,
        criteria: [],
      };
    }

    normalizedCriteria.push({
      id,
      name,
      description,
    });
  }

  return {
    valid: true,
    error: null,
    criteria:
      normalizedCriteria,
  };
}

function normalizeKpiFactors(
  kpiFactors
) {
  if (
    !Array.isArray(
      kpiFactors
    )
  ) {
    return {
      valid: false,
      error:
        "KPI factors must be an array.",
      kpiFactors: [],
    };
  }

  if (
    kpiFactors.length === 0
  ) {
    return {
      valid: false,
      error:
        "At least one KPI factor is required.",
      kpiFactors: [],
    };
  }

  if (
    kpiFactors.length >
    MAX_KPI_FACTORS
  ) {
    return {
      valid: false,
      error:
        `KPI configuration cannot contain more than ${MAX_KPI_FACTORS} factors.`,
      kpiFactors: [],
    };
  }

  const normalizedFactors = [];
  const usedIds = new Set();

  let totalWeight = 0;

  for (
    let index = 0;
    index < kpiFactors.length;
    index += 1
  ) {
    const item =
      kpiFactors[index];

    const position =
      index + 1;

    if (
      !item ||
      typeof item !==
        "object" ||
      Array.isArray(item)
    ) {
      return {
        valid: false,
        error:
          `KPI factor ${position} is invalid.`,
        kpiFactors: [],
      };
    }

    const id =
      normalizeString(
        item.id ||
          `factor-${position}`,
        255
      );

    const factor =
      normalizeString(
        item.factor,
        500
      );

    const description =
      normalizeString(
        item.description,
        4000
      );

    const weight =
      Number(item.weight);

    if (usedIds.has(id)) {
      return {
        valid: false,
        error:
          `KPI factor ${position} has a duplicate ID.`,
        kpiFactors: [],
      };
    }

    usedIds.add(id);

    if (!factor) {
      return {
        valid: false,
        error:
          `KPI factor ${position} must have a factor name.`,
        kpiFactors: [],
      };
    }

    if (!description) {
      return {
        valid: false,
        error:
          `KPI factor ${position} must have a description.`,
        kpiFactors: [],
      };
    }

    if (
      !Number.isFinite(
        weight
      ) ||
      weight <= 0 ||
      weight > 100
    ) {
      return {
        valid: false,
        error:
          `KPI factor ${position} must have a weight greater than 0 and not more than 100.`,
        kpiFactors: [],
      };
    }

    const sourceCriteria =
      Array.isArray(
        item.criteria
      )
        ? item.criteria
        : migrateLegacyCriteria(
            item,
            id
          );

    const criteriaResult =
      normalizeCriteria(
        sourceCriteria,
        id,
        position
      );

    if (
      !criteriaResult.valid
    ) {
      return {
        valid: false,
        error:
          criteriaResult.error,
        kpiFactors: [],
      };
    }

    totalWeight += weight;

    normalizedFactors.push({
      id,
      weight,
      factor,
      description,
      criteria:
        criteriaResult.criteria,
    });
  }

  if (
    Math.abs(
      totalWeight - 100
    ) >
    WEIGHT_TOLERANCE
  ) {
    return {
      valid: false,
      error:
        `KPI factor weights must total exactly 100%. Current total: ${totalWeight}%.`,
      kpiFactors: [],
    };
  }

  return {
    valid: true,
    error: null,
    kpiFactors:
      normalizedFactors,
  };
}

function normalizePerformanceEvaluationConfiguration(
  value
) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return {
      valid: false,
      error:
        "Performance evaluation configuration must be an object.",
      configuration: null,
    };
  }

  const ratingResult =
    normalizeRatingScale(
      value.ratingScale
    );

  if (
    !ratingResult.valid
  ) {
    return {
      valid: false,
      error:
        ratingResult.error,
      configuration: null,
    };
  }

  const factorsResult =
    normalizeKpiFactors(
      value.kpiFactors
    );

  if (
    !factorsResult.valid
  ) {
    return {
      valid: false,
      error:
        factorsResult.error,
      configuration: null,
    };
  }

  return {
    valid: true,
    error: null,

    configuration: {
      schemaVersion:
        PERFORMANCE_EVALUATION_SCHEMA_VERSION,

      ratingScale:
        ratingResult.ratingScale,

      kpiFactors:
        factorsResult.kpiFactors,
    },
  };
}

function parsePerformanceEvaluationSetting(
  settingValue
) {
  if (
    settingValue === null ||
    settingValue === undefined ||
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
    throw new PerformanceEvaluationError(
      "The stored performance evaluation configuration contains invalid JSON.",
      {
        statusCode: 500,
        code:
          "INVALID_STORED_PERFORMANCE_EVALUATION_JSON",
      }
    );
  }

  const normalizedResult =
    normalizePerformanceEvaluationConfiguration(
      parsedValue
    );

  if (
    !normalizedResult.valid
  ) {
    throw new PerformanceEvaluationError(
      `The stored performance evaluation configuration is invalid: ${normalizedResult.error}`,
      {
        statusCode: 500,
        code:
          "INVALID_STORED_PERFORMANCE_EVALUATION",
      }
    );
  }

  return {
    ...normalizedResult.configuration,

    metadata: {
      updatedAt:
        parsedValue
          ?.metadata
          ?.updatedAt ||
        null,

      updatedBy:
        parsedValue
          ?.metadata
          ?.updatedBy ||
        null,

      updatedByRole:
        parsedValue
          ?.metadata
          ?.updatedByRole ||
        null,
    },
  };
}

async function getPerformanceEvaluationConfiguration({
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
        PERFORMANCE_EVALUATION_SETTING_NAME,
      ]
    );

  if (!rows.length) {
    return null;
  }

  return parsePerformanceEvaluationSetting(
    rows[0].setting_value
  );
}

module.exports = {
  PERFORMANCE_EVALUATION_SETTING_NAME,
  PERFORMANCE_EVALUATION_SCHEMA_VERSION,

  PerformanceEvaluationError,

  DEFAULT_RATING_SCALE,
  DEFAULT_KPI_FACTORS,

  getDefaultPerformanceEvaluationConfiguration,

  normalizeRatingScale,
  normalizeCriteria,
  normalizeKpiFactors,
  normalizePerformanceEvaluationConfiguration,
  parsePerformanceEvaluationSetting,

  getPerformanceEvaluationConfiguration,
};