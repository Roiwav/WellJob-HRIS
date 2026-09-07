import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  FiAlertTriangle,
  FiAward,
  FiBarChart2,
  FiEdit3,
  FiInfo,
  FiLock,
  FiPlus,
  FiRotateCcw,
  FiSave,
  FiTrash2,
  FiX,
} from "react-icons/fi";

import Button from "../ui/Button";
import Dialog from "../ui/Dialog";
import ConfirmDialog from "../ui/ConfirmDialog";
import SuccessToast from "../ui/SuccessToast";

import authenticatedFetch from "../../utils/authenticatedFetch";
import { API_BASE } from "../../config/api";

const PERFORMANCE_EVALUATION_API =
  `${API_BASE}/settings/performance-evaluation`;

const PERFORMANCE_EVALUATION_SCHEMA_VERSION = 2;
const REQUEST_TIMEOUT_MS = 60 * 1000;
const WEIGHT_TOLERANCE = 0.0001;

const RATING_STYLES = [
  "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300",
  "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300",
  "border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-500/30 dark:bg-yellow-500/10 dark:text-yellow-300",
  "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300",
  "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300",
];

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

const INPUT_CLASS_NAME = [
  "min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5",
  "text-sm text-gray-900 shadow-sm outline-none transition",
  "placeholder:text-gray-400",
  "focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20",
  "disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500",
  "dark:border-slate-700 dark:bg-slate-900 dark:text-white",
  "dark:focus:border-indigo-400 dark:focus:ring-indigo-400/20",
  "dark:disabled:bg-slate-800 dark:disabled:text-gray-500",
].join(" ");

const TEXTAREA_CLASS_NAME =
  `${INPUT_CLASS_NAME} min-h-24 resize-y`;

function cloneConfiguration(value) {
  return JSON.parse(JSON.stringify(value));
}

function getDefaultConfiguration() {
  return {
    schemaVersion:
      PERFORMANCE_EVALUATION_SCHEMA_VERSION,
    ratingScale:
      cloneConfiguration(DEFAULT_RATING_SCALE),
    kpiFactors:
      cloneConfiguration(DEFAULT_KPI_FACTORS),
    metadata: {
      updatedAt: null,
      updatedBy: null,
      updatedByRole: null,
    },
  };
}

function createCriterionId(factorId) {
  const randomId =
    globalThis.crypto?.randomUUID?.();

  if (randomId) {
    return `${factorId}-criterion-${randomId}`;
  }

  return `${factorId}-criterion-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function normalizeRatingScale(ratingScale) {
  if (!Array.isArray(ratingScale)) {
    throw new Error(
      "The server returned an invalid performance rating scale."
    );
  }

  return ratingScale.map((item, index) => ({
    id: item?.id || `rating-${index + 1}`,
    min: Number(item?.min),
    max: Number(item?.max),
    rating: String(item?.rating || ""),
    description: String(item?.description || ""),
    frequency: String(item?.frequency || ""),
  }));
}

function normalizeCriteria(
  criteria,
  factorId
) {
  if (!Array.isArray(criteria)) {
    throw new Error(
      `The server returned an invalid evaluation criteria list for ${factorId}.`
    );
  }

  return criteria.map(
    (criterion, index) => ({
      id:
        criterion?.id ||
        `${factorId}-criterion-${index + 1}`,
      name:
        String(criterion?.name || ""),
      description:
        String(
          criterion?.description || ""
        ),
    })
  );
}

function normalizeFactors(factors) {
  if (!Array.isArray(factors)) {
    throw new Error(
      "The server returned an invalid KPI factor list."
    );
  }

  return factors.map((item, index) => {
    const factorId =
      item?.id ||
      `factor-${index + 1}`;

    return {
      id: factorId,
      weight: Number(item?.weight),
      factor: String(item?.factor || ""),
      description:
        String(item?.description || ""),
      criteria:
        normalizeCriteria(
          item?.criteria,
          factorId
        ),
    };
  });
}

function normalizeConfiguration(value) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new Error(
      "The server returned an invalid performance evaluation configuration."
    );
  }

  if (
    !Array.isArray(value.ratingScale) ||
    !Array.isArray(value.kpiFactors)
  ) {
    throw new Error(
      "The server returned an incomplete performance evaluation configuration."
    );
  }

  return {
    schemaVersion:
      Number(
        value?.schemaVersion ||
          PERFORMANCE_EVALUATION_SCHEMA_VERSION
      ),
    ratingScale:
      normalizeRatingScale(
        value.ratingScale
      ),
    kpiFactors:
      normalizeFactors(
        value.kpiFactors
      ),
    metadata: {
      updatedAt:
        value?.metadata?.updatedAt || null,
      updatedBy:
        value?.metadata?.updatedBy || null,
      updatedByRole:
        value?.metadata?.updatedByRole || null,
    },
  };
}

async function requestJson(url, options = {}) {
  const controller = new AbortController();

  const timeoutId = globalThis.setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const response = await authenticatedFetch(
      url,
      {
        ...options,
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(options.headers || {}),
        },
      }
    );

    const data = await response
      .json()
      .catch(() => null);

    if (!response.ok) {
      throw new Error(
        data?.error ||
          data?.message ||
          `Request failed with status ${response.status}`
      );
    }

    return data;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(
        "The server took too long to respond. Check that the backend server and database are running, then try again."
      );
    }

    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

function formatDateTime(value) {
  if (!value) {
    return "Not yet modified";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatRatingRange(item) {
  const min = Number(item?.min);
  const max = Number(item?.max);

  return `${min}%–${max}%`;
}

function validateConfiguration(configuration) {
  const errors = [];

  const ratingScale =
    configuration?.ratingScale || [];

  const factors =
    configuration?.kpiFactors || [];

  if (ratingScale.length === 0) {
    errors.push(
      "At least one performance rating range is required."
    );
  }

  const sortedRatings = [...ratingScale].sort(
    (first, second) =>
      Number(first.min) -
      Number(second.min)
  );

  sortedRatings.forEach((item, index) => {
    const min = Number(item.min);
    const max = Number(item.max);
    const position = index + 1;

    if (
      !Number.isFinite(min) ||
      !Number.isFinite(max)
    ) {
      errors.push(
        `Rating range ${position} must have valid numeric minimum and maximum values.`
      );
      return;
    }

    if (
      !Number.isInteger(min) ||
      !Number.isInteger(max)
    ) {
      errors.push(
        `Rating range ${position} must use whole-number percentage values.`
      );
    }

    if (min < 0 || max > 100) {
      errors.push(
        `Rating range ${position} must remain between 0% and 100%.`
      );
    }

    if (min > max) {
      errors.push(
        `Rating range ${position} has a minimum value greater than its maximum value.`
      );
    }

    if (!String(item.rating || "").trim()) {
      errors.push(
        `Rating range ${position} must have a rating name.`
      );
    }

    if (
      !String(
        item.description || ""
      ).trim()
    ) {
      errors.push(
        `Rating range ${position} must have a description.`
      );
    }

    if (index > 0) {
      const previousItem =
        sortedRatings[index - 1];

      const previousMax =
        Number(previousItem.max);

      if (min <= previousMax) {
        errors.push(
          `Rating ranges ${index} and ${
            index + 1
          } overlap.`
        );
      }

      if (min !== previousMax + 1) {
        errors.push(
          `There is a gap between rating ranges ${index} and ${
            index + 1
          }.`
        );
      }
    }
  });

  if (
    sortedRatings.length > 0 &&
    Number(sortedRatings[0].min) !== 0
  ) {
    errors.push(
      "The first rating range must begin at 0%."
    );
  }

  if (
    sortedRatings.length > 0 &&
    Number(
      sortedRatings[
        sortedRatings.length - 1
      ].max
    ) !== 100
  ) {
    errors.push(
      "The final rating range must end at 100%."
    );
  }

  if (factors.length === 0) {
    errors.push(
      "At least one KPI evaluation factor is required."
    );
  }

  const totalWeight = factors.reduce(
    (sum, item) =>
      sum + Number(item.weight || 0),
    0
  );

  if (
    Math.abs(totalWeight - 100) >
    WEIGHT_TOLERANCE
  ) {
    errors.push(
      `KPI evaluation factor weights must total exactly 100%. Current total: ${totalWeight}%.`
    );
  }

  factors.forEach((item, index) => {
    const factorPosition = index + 1;
    const weight = Number(item.weight);

    if (!String(item.factor || "").trim()) {
      errors.push(
        `KPI evaluation factor ${factorPosition} must have a factor name.`
      );
    }

    if (
      !String(
        item.description || ""
      ).trim()
    ) {
      errors.push(
        `KPI evaluation factor ${factorPosition} must have a description.`
      );
    }

    if (
      !Number.isFinite(weight) ||
      weight <= 0 ||
      weight > 100
    ) {
      errors.push(
        `KPI evaluation factor ${factorPosition} must have a weight greater than 0 and not more than 100.`
      );
    }

    const criteria =
      Array.isArray(item.criteria)
        ? item.criteria
        : [];

    if (criteria.length === 0) {
      errors.push(
        `KPI evaluation factor ${factorPosition} must contain at least one evaluation criterion.`
      );
      return;
    }

    const usedCriterionIds = new Set();

    criteria.forEach(
      (criterion, criterionIndex) => {
        const criterionPosition =
          criterionIndex + 1;

        const criterionId =
          String(
            criterion?.id || ""
          ).trim();

        const criterionName =
          String(
            criterion?.name || ""
          ).trim();

        if (!criterionId) {
          errors.push(
            `Evaluation criterion ${criterionPosition} under KPI factor ${factorPosition} must have an ID.`
          );
        } else if (
          usedCriterionIds.has(
            criterionId
          )
        ) {
          errors.push(
            `Evaluation criterion ${criterionPosition} under KPI factor ${factorPosition} has a duplicate ID.`
          );
        } else {
          usedCriterionIds.add(
            criterionId
          );
        }

        if (!criterionName) {
          errors.push(
            `Evaluation criterion ${criterionPosition} under KPI factor ${factorPosition} must have a criterion name.`
          );
        }
      }
    );
  });

  return errors;
}

function createConfigurationSnapshot(
  configuration
) {
  return JSON.stringify({
    ratingScale:
      configuration.ratingScale,
    kpiFactors:
      configuration.kpiFactors,
  });
}

export default function KPIThresholdsTab({
  canEdit = false,
}) {
  const [
    configuration,
    setConfiguration,
  ] = useState(
    getDefaultConfiguration
  );

  const [
    draftConfiguration,
    setDraftConfiguration,
  ] = useState(
    getDefaultConfiguration
  );

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    loadError,
    setLoadError,
  ] = useState("");

  const [
    isEditing,
    setIsEditing,
  ] = useState(false);

  const [
    showReviewDialog,
    setShowReviewDialog,
  ] = useState(false);

  const [
    showDiscardDialog,
    setShowDiscardDialog,
  ] = useState(false);

  const [
    showRestoreDialog,
    setShowRestoreDialog,
  ] = useState(false);

  const [
    validationErrors,
    setValidationErrors,
  ] = useState([]);

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const [
    isSaving,
    setIsSaving,
  ] = useState(false);

  const loadConfiguration = useCallback(
    async () => {
      try {
        setIsLoading(true);
        setLoadError("");

        const response =
          await requestJson(
            PERFORMANCE_EVALUATION_API
          );

        const nextConfiguration =
          normalizeConfiguration(
            response
          );

        const serverValidationErrors =
          validateConfiguration(
            nextConfiguration
          );

        if (
          serverValidationErrors.length > 0
        ) {
          throw new Error(
            "The saved performance evaluation policy is invalid. Contact an authorized administrator before making further changes."
          );
        }

        setConfiguration(
          cloneConfiguration(
            nextConfiguration
          )
        );

        setDraftConfiguration(
          cloneConfiguration(
            nextConfiguration
          )
        );

        setValidationErrors([]);
        setIsEditing(false);
      } catch (error) {
        console.error(
          "Unable to load performance evaluation configuration:",
          error
        );

        setLoadError(
          error?.message ||
            "Unable to load the performance evaluation policy."
        );
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    loadConfiguration();
  }, [loadConfiguration]);

  useEffect(() => {
    if (
      !canEdit &&
      isEditing
    ) {
      setIsEditing(false);
      setShowReviewDialog(false);
      setShowDiscardDialog(false);

      setDraftConfiguration(
        cloneConfiguration(
          configuration
        )
      );

      setValidationErrors([]);
    }
  }, [
    canEdit,
    configuration,
    isEditing,
  ]);

  const totalWeight = useMemo(() => {
    const factors = isEditing
      ? draftConfiguration.kpiFactors
      : configuration.kpiFactors;

    return factors.reduce(
      (sum, item) =>
        sum + Number(item.weight || 0),
      0
    );
  }, [
    configuration.kpiFactors,
    draftConfiguration.kpiFactors,
    isEditing,
  ]);

  const isWeightTotalValid =
    Math.abs(totalWeight - 100) <=
    WEIGHT_TOLERANCE;

  const hasUnsavedChanges =
    useMemo(() => {
      return (
        createConfigurationSnapshot(
          configuration
        ) !==
        createConfigurationSnapshot(
          draftConfiguration
        )
      );
    }, [
      configuration,
      draftConfiguration,
    ]);

  const activeConfiguration =
    isEditing
      ? draftConfiguration
      : configuration;

  const handleStartEditing =
    useCallback(() => {
      if (
        !canEdit ||
        isLoading ||
        loadError
      ) {
        return;
      }

      setDraftConfiguration(
        cloneConfiguration(
          configuration
        )
      );

      setValidationErrors([]);
      setIsEditing(true);
    }, [
      canEdit,
      configuration,
      isLoading,
      loadError,
    ]);

  const handleRequestCancel =
    useCallback(() => {
      if (
        !isEditing ||
        isSaving
      ) {
        return;
      }

      if (hasUnsavedChanges) {
        setShowDiscardDialog(true);
        return;
      }

      setIsEditing(false);
      setValidationErrors([]);
    }, [
      hasUnsavedChanges,
      isEditing,
      isSaving,
    ]);

  const handleDiscardChanges =
    useCallback(() => {
      if (isSaving) {
        return;
      }

      setDraftConfiguration(
        cloneConfiguration(
          configuration
        )
      );

      setValidationErrors([]);
      setShowDiscardDialog(false);
      setShowReviewDialog(false);
      setIsEditing(false);
    }, [
      configuration,
      isSaving,
    ]);

  const handleRatingChange =
    useCallback(
      (
        ratingId,
        field,
        value
      ) => {
        if (
          !canEdit ||
          !isEditing
        ) {
          return;
        }

        setDraftConfiguration(
          (currentConfiguration) => ({
            ...currentConfiguration,
            ratingScale:
              currentConfiguration.ratingScale.map(
                (item) =>
                  item.id === ratingId
                    ? {
                        ...item,
                        [field]:
                          field === "min" ||
                          field === "max"
                            ? value === ""
                              ? ""
                              : Number(value)
                            : value,
                      }
                    : item
              ),
          })
        );

        setValidationErrors([]);
      },
      [
        canEdit,
        isEditing,
      ]
    );

  const handleFactorChange =
    useCallback(
      (
        factorId,
        field,
        value
      ) => {
        if (
          !canEdit ||
          !isEditing
        ) {
          return;
        }

        setDraftConfiguration(
          (currentConfiguration) => ({
            ...currentConfiguration,
            kpiFactors:
              currentConfiguration.kpiFactors.map(
                (item) =>
                  item.id === factorId
                    ? {
                        ...item,
                        [field]:
                          field === "weight"
                            ? value === ""
                              ? ""
                              : Number(value)
                            : value,
                      }
                    : item
              ),
          })
        );

        setValidationErrors([]);
      },
      [
        canEdit,
        isEditing,
      ]
    );

  const handleCriterionChange =
    useCallback(
      (
        factorId,
        criterionId,
        field,
        value
      ) => {
        if (
          !canEdit ||
          !isEditing
        ) {
          return;
        }

        setDraftConfiguration(
          (currentConfiguration) => ({
            ...currentConfiguration,
            kpiFactors:
              currentConfiguration.kpiFactors.map(
                (factor) => {
                  if (
                    factor.id !== factorId
                  ) {
                    return factor;
                  }

                  return {
                    ...factor,
                    criteria:
                      factor.criteria.map(
                        (criterion) =>
                          criterion.id ===
                          criterionId
                            ? {
                                ...criterion,
                                [field]:
                                  value,
                              }
                            : criterion
                      ),
                  };
                }
              ),
          })
        );

        setValidationErrors([]);
      },
      [
        canEdit,
        isEditing,
      ]
    );

  const handleAddCriterion =
    useCallback(
      (factorId) => {
        if (
          !canEdit ||
          !isEditing
        ) {
          return;
        }

        setDraftConfiguration(
          (currentConfiguration) => ({
            ...currentConfiguration,
            kpiFactors:
              currentConfiguration.kpiFactors.map(
                (factor) =>
                  factor.id === factorId
                    ? {
                        ...factor,
                        criteria: [
                          ...factor.criteria,
                          {
                            id:
                              createCriterionId(
                                factorId
                              ),
                            name: "",
                            description: "",
                          },
                        ],
                      }
                    : factor
              ),
          })
        );

        setValidationErrors([]);
      },
      [
        canEdit,
        isEditing,
      ]
    );

  const handleRemoveCriterion =
    useCallback(
      (
        factorId,
        criterionId
      ) => {
        if (
          !canEdit ||
          !isEditing
        ) {
          return;
        }

        setDraftConfiguration(
          (currentConfiguration) => ({
            ...currentConfiguration,
            kpiFactors:
              currentConfiguration.kpiFactors.map(
                (factor) => {
                  if (
                    factor.id !== factorId
                  ) {
                    return factor;
                  }

                  return {
                    ...factor,
                    criteria:
                      factor.criteria.filter(
                        (criterion) =>
                          criterion.id !==
                          criterionId
                      ),
                  };
                }
              ),
          })
        );

        setValidationErrors([]);
      },
      [
        canEdit,
        isEditing,
      ]
    );

  const handleReviewChanges =
    useCallback(() => {
      if (
        !canEdit ||
        !isEditing ||
        !hasUnsavedChanges
      ) {
        return;
      }

      const errors =
        validateConfiguration(
          draftConfiguration
        );

      setValidationErrors(errors);

      if (errors.length > 0) {
        window.scrollTo({
          top: 0,
          behavior: "smooth",
        });

        return;
      }

      setShowReviewDialog(true);
    }, [
      canEdit,
      draftConfiguration,
      hasUnsavedChanges,
      isEditing,
    ]);

  const handleConfirmSave =
    useCallback(
      async () => {
        if (
          !canEdit ||
          !isEditing ||
          isSaving
        ) {
          return;
        }

        const errors =
          validateConfiguration(
            draftConfiguration
          );

        if (errors.length > 0) {
          setValidationErrors(errors);
          setShowReviewDialog(false);
          return;
        }

        const payload = {
          schemaVersion:
            PERFORMANCE_EVALUATION_SCHEMA_VERSION,

          ratingScale:
            draftConfiguration.ratingScale.map(
              (item) => ({
                id: item.id,
                min: Number(item.min),
                max: Number(item.max),
                rating: item.rating.trim(),
                description:
                  item.description.trim(),
                frequency:
                  item.frequency.trim(),
              })
            ),

          kpiFactors:
            draftConfiguration.kpiFactors.map(
              (item) => ({
                id: item.id,
                weight:
                  Number(item.weight),
                factor:
                  item.factor.trim(),
                description:
                  item.description.trim(),
                criteria:
                  item.criteria.map(
                    (criterion) => ({
                      id:
                        criterion.id,
                      name:
                        criterion.name.trim(),
                      description:
                        criterion.description.trim(),
                    })
                  ),
              })
            ),
        };

        try {
          setIsSaving(true);

          const response =
            await requestJson(
              PERFORMANCE_EVALUATION_API,
              {
                method: "PUT",
                body:
                  JSON.stringify(
                    payload
                  ),
              }
            );

          const savedConfiguration =
            normalizeConfiguration(
              response
            );

          setConfiguration(
            cloneConfiguration(
              savedConfiguration
            )
          );

          setDraftConfiguration(
            cloneConfiguration(
              savedConfiguration
            )
          );

          setValidationErrors([]);
          setShowReviewDialog(false);
          setIsEditing(false);

          setSuccessMessage(
            "Performance evaluation policy was updated successfully."
          );

          window.dispatchEvent(
            new CustomEvent(
              "dataUpdated",
              {
                detail: {
                  source:
                    "performance-evaluation-configuration",
                  domain:
                    "system-configuration",
                  action:
                    "UPDATE_PERFORMANCE_EVALUATION",
                  at: Date.now(),
                },
              }
            )
          );
        } catch (error) {
          console.error(
            "Unable to save performance evaluation configuration:",
            error
          );

          setValidationErrors([
            error?.message ||
              "The performance evaluation policy could not be saved. Please try again.",
          ]);

          setShowReviewDialog(false);
        } finally {
          setIsSaving(false);
        }
      },
      [
        canEdit,
        draftConfiguration,
        isEditing,
        isSaving,
      ]
    );

  const handleRestoreDefaults =
    useCallback(() => {
      if (
        !canEdit ||
        isSaving
      ) {
        return;
      }

      setDraftConfiguration(
        getDefaultConfiguration()
      );

      setValidationErrors([]);
      setShowRestoreDialog(false);
      setIsEditing(true);
    }, [
      canEdit,
      isSaving,
    ]);

  if (isLoading) {
    return (
      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900">
        <div className="flex items-start gap-3">
          <FiBarChart2
            className="mt-0.5 shrink-0 text-indigo-600 dark:text-indigo-300"
            size={20}
            aria-hidden="true"
          />

          <div>
            <h2 className="font-extrabold text-gray-900 dark:text-white">
              Loading Performance Evaluation Policy
            </h2>

            <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">
              Retrieving the organization-wide rating
              scale and KPI evaluation factors from
              the server.
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (loadError) {
    return (
      <section
        role="alert"
        className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-800 shadow-sm dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
      >
        <div className="flex items-start gap-3">
          <FiAlertTriangle
            className="mt-0.5 shrink-0"
            size={20}
            aria-hidden="true"
          />

          <div className="min-w-0 flex-1">
            <h2 className="font-extrabold">
              Unable to Load Performance Evaluation Policy
            </h2>

            <p className="mt-1 text-sm leading-6">
              {loadError}
            </p>

            <div className="mt-4">
              <Button
                type="button"
                variant="secondary"
                leftIcon={
                  <FiRotateCcw />
                }
                onClick={
                  loadConfiguration
                }
              >
                Retry
              </Button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      {validationErrors.length > 0 && (
        <section
          role="alert"
          className="rounded-3xl border border-red-200 bg-red-50 p-5 text-red-800 shadow-sm dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
        >
          <div className="flex items-start gap-3">
            <FiAlertTriangle
              className="mt-0.5 shrink-0"
              size={20}
              aria-hidden="true"
            />

            <div>
              <h3 className="font-extrabold">
                Policy validation failed
              </h3>

              <p className="mt-1 text-sm">
                Correct the following items before
                reviewing and saving:
              </p>

              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
                {validationErrors.map(
                  (error, index) => (
                    <li
                      key={`${error}-${index}`}
                    >
                      {error}
                    </li>
                  )
                )}
              </ul>
            </div>
          </div>
        </section>
      )}

      <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900">
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-6 sm:px-6 sm:py-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-white/15 p-3 text-white ring-1 ring-white/20">
                <FiBarChart2
                  size={22}
                  aria-hidden="true"
                />
              </div>

              <div>
                <h2 className="text-xl font-extrabold text-white">
                  Performance Evaluation Policy
                </h2>

                <p className="mt-2 max-w-3xl text-sm leading-6 text-emerald-100">
                  Configure how employee performance
                  scores are interpreted and how much
                  each KPI factor contributes to the
                  final evaluation score.
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white ring-1 ring-white/20">
                    Performance Evaluation Setup
                  </span>

                  <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white ring-1 ring-white/20">
                    Total KPI Weight: {totalWeight}%
                  </span>

                  <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white ring-1 ring-white/20">
                    {isEditing
                      ? "Editing Mode"
                      : canEdit
                        ? "Editable"
                        : "View Only"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {canEdit && !isEditing && (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    leftIcon={
                      <FiRotateCcw />
                    }
                    onClick={() =>
                      setShowRestoreDialog(
                        true
                      )
                    }
                  >
                    Load Defaults
                  </Button>

                  <Button
                    type="button"
                    leftIcon={<FiEdit3 />}
                    onClick={
                      handleStartEditing
                    }
                  >
                    Edit Policy
                  </Button>
                </>
              )}

              {canEdit && isEditing && (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    leftIcon={<FiX />}
                    disabled={isSaving}
                    onClick={
                      handleRequestCancel
                    }
                  >
                    Cancel
                  </Button>

                  <Button
                    type="button"
                    variant="success"
                    leftIcon={<FiSave />}
                    disabled={
                      isSaving ||
                      !hasUnsavedChanges
                    }
                    onClick={
                      handleReviewChanges
                    }
                  >
                    Review Changes
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="border-b border-gray-200 bg-slate-50 p-5 sm:p-6 dark:border-white/10 dark:bg-slate-950/40">
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-blue-900 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200">
            <div className="flex items-start gap-3">
              <FiInfo
                className="mt-0.5 shrink-0"
                size={18}
                aria-hidden="true"
              />

              <div>
                <h3 className="text-sm font-extrabold">
                  About this setup
                </h3>

                <p className="mt-1 text-sm leading-6">
                  Use this page to manage the rating
                  scale, KPI weights, and evaluation
                  criteria used by HR when reviewing
                  employee performance.
                </p>
              </div>
            </div>
          </div>


        </div>

        <div className="border-b border-gray-200 p-5 sm:p-6 dark:border-white/10">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-extrabold uppercase tracking-wide text-gray-700 dark:text-gray-300">
                Performance Rating Scale
              </h3>

              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Every possible final score from 0% to
                100% must belong to exactly one rating
                range.
              </p>
            </div>

            <div className="inline-flex w-fit items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
              {isEditing ? (
                <FiEdit3 size={14} />
              ) : (
                <FiLock size={14} />
              )}

              {isEditing
                ? "Editing Enabled"
                : "Protected Policy"}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {activeConfiguration.ratingScale.map(
              (item, index) => (
                <article
                  key={item.id}
                  className={`rounded-2xl border p-4 shadow-sm ${
                    RATING_STYLES[index] ||
                    RATING_STYLES[
                      RATING_STYLES.length - 1
                    ]
                  }`}
                >
                  {isEditing ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <label className="block">
                          <span className="mb-1.5 block text-xs font-bold">
                            Minimum %
                          </span>

                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="1"
                            value={item.min}
                            onChange={(event) =>
                              handleRatingChange(
                                item.id,
                                "min",
                                event.target.value
                              )
                            }
                            className={
                              INPUT_CLASS_NAME
                            }
                          />
                        </label>

                        <label className="block">
                          <span className="mb-1.5 block text-xs font-bold">
                            Maximum %
                          </span>

                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="1"
                            value={item.max}
                            onChange={(event) =>
                              handleRatingChange(
                                item.id,
                                "max",
                                event.target.value
                              )
                            }
                            className={
                              INPUT_CLASS_NAME
                            }
                          />
                        </label>
                      </div>

                      <label className="block">
                        <span className="mb-1.5 block text-xs font-bold">
                          Rating Name
                        </span>

                        <input
                          type="text"
                          value={item.rating}
                          onChange={(event) =>
                            handleRatingChange(
                              item.id,
                              "rating",
                              event.target.value
                            )
                          }
                          className={
                            INPUT_CLASS_NAME
                          }
                        />
                      </label>

                      <label className="block">
                        <span className="mb-1.5 block text-xs font-bold">
                          Rating Description
                        </span>

                        <textarea
                          value={
                            item.description
                          }
                          onChange={(event) =>
                            handleRatingChange(
                              item.id,
                              "description",
                              event.target.value
                            )
                          }
                          className={
                            TEXTAREA_CLASS_NAME
                          }
                        />
                      </label>

                      <label className="block">
                        <span className="mb-1.5 block text-xs font-bold">
                          Policy / Action Notes
                        </span>

                        <textarea
                          value={
                            item.frequency
                          }
                          placeholder="Optional policy or action notes..."
                          onChange={(event) =>
                            handleRatingChange(
                              item.id,
                              "frequency",
                              event.target.value
                            )
                          }
                          className={
                            TEXTAREA_CLASS_NAME
                          }
                        />
                      </label>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-bold">
                          {formatRatingRange(item)}
                        </span>

                        <FiAward
                          size={16}
                          aria-hidden="true"
                        />
                      </div>

                      <h4 className="mt-2 text-base font-extrabold">
                        {item.rating}
                      </h4>

                      <p className="mt-2 text-xs leading-5">
                        {item.description}
                      </p>

                      {item.frequency && (
                        <div className="mt-3 rounded-xl bg-white/70 p-2 text-xs font-medium leading-5 dark:bg-slate-900/50">
                          {item.frequency}
                        </div>
                      )}
                    </>
                  )}
                </article>
              )
            )}
          </div>
        </div>

        <div className="p-5 sm:p-6">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-extrabold uppercase tracking-wide text-gray-700 dark:text-gray-300">
                KPI Evaluation Factors & Weights
              </h3>

              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Each weight represents that factor’s
                contribution to the final employee
                performance score. Combined weights
                must equal 100%.
              </p>
            </div>

            <span
              className={[
                "inline-flex w-fit rounded-xl border px-3 py-1.5 text-xs font-extrabold",
                isWeightTotalValid
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                  : "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300",
              ].join(" ")}
            >
              Total Weight: {totalWeight}%
            </span>
          </div>

          <div className="space-y-4">
            {activeConfiguration.kpiFactors.map(
              (item, factorIndex) => (
                <article
                  key={item.id}
                  className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900"
                >
                  {isEditing ? (
                    <div className="space-y-5">
                      <div className="grid gap-4 lg:grid-cols-[1fr_160px]">
                        <label className="block">
                          <span className="mb-1.5 block text-sm font-bold text-gray-700 dark:text-gray-200">
                            KPI Factor Name
                          </span>

                          <input
                            type="text"
                            value={item.factor}
                            onChange={(event) =>
                              handleFactorChange(
                                item.id,
                                "factor",
                                event.target.value
                              )
                            }
                            className={
                              INPUT_CLASS_NAME
                            }
                          />
                        </label>

                        <label className="block">
                          <span className="mb-1.5 block text-sm font-bold text-gray-700 dark:text-gray-200">
                            Weight %
                          </span>

                          <input
                            type="number"
                            min="1"
                            max="100"
                            value={item.weight}
                            onChange={(event) =>
                              handleFactorChange(
                                item.id,
                                "weight",
                                event.target.value
                              )
                            }
                            className={
                              INPUT_CLASS_NAME
                            }
                          />
                        </label>
                      </div>

                      <label className="block">
                        <span className="mb-1.5 block text-sm font-bold text-gray-700 dark:text-gray-200">
                          Factor Description
                        </span>

                        <textarea
                          value={
                            item.description
                          }
                          onChange={(event) =>
                            handleFactorChange(
                              item.id,
                              "description",
                              event.target.value
                            )
                          }
                          className={
                            TEXTAREA_CLASS_NAME
                          }
                        />
                      </label>

                      <div>
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                              Evaluation Criteria
                            </h4>

                            <p className="mt-1 max-w-2xl text-xs leading-5 text-gray-500 dark:text-gray-400">
                              Add or update the items HR
                              will consider when assessing
                              employee performance.
                            </p>
                          </div>

                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            leftIcon={<FiPlus />}
                            onClick={() =>
                              handleAddCriterion(
                                item.id
                              )
                            }
                          >
                            Add Criterion
                          </Button>
                        </div>

                        <div className="space-y-4">
                          {item.criteria.map(
                            (
                              criterion,
                              criterionIndex
                            ) => (
                              <div
                                key={criterion.id}
                                className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-white/10 dark:bg-slate-950/50"
                              >
                                <div className="flex items-start gap-3">
                                  <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-extrabold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                                    {criterionIndex + 1}
                                  </span>

                                  <div className="min-w-0 flex-1 space-y-3">
                                    <label className="block">
                                      <span className="mb-1.5 block text-xs font-bold text-gray-700 dark:text-gray-300">
                                        Criterion Name
                                      </span>

                                      <input
                                        type="text"
                                        value={criterion.name}
                                        placeholder="Enter criterion name..."
                                        onChange={(event) =>
                                          handleCriterionChange(
                                            item.id,
                                            criterion.id,
                                            "name",
                                            event.target.value
                                          )
                                        }
                                        className={
                                          INPUT_CLASS_NAME
                                        }
                                      />
                                    </label>

                                    <label className="block">
                                      <span className="mb-1.5 block text-xs font-bold text-gray-700 dark:text-gray-300">
                                        Description / Translation
                                      </span>

                                      <textarea
                                        value={
                                          criterion.description
                                        }
                                        placeholder="Optional explanation, translation, or evaluation guidance..."
                                        onChange={(event) =>
                                          handleCriterionChange(
                                            item.id,
                                            criterion.id,
                                            "description",
                                            event.target.value
                                          )
                                        }
                                        className={
                                          TEXTAREA_CLASS_NAME
                                        }
                                      />
                                    </label>
                                  </div>

                                  <button
                                    type="button"
                                    aria-label={`Remove evaluation criterion ${
                                      criterionIndex + 1
                                    } from KPI factor ${
                                      factorIndex + 1
                                    }`}
                                    title="Remove criterion"
                                    onClick={() =>
                                      handleRemoveCriterion(
                                        item.id,
                                        criterion.id
                                      )
                                    }
                                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-red-600 transition hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:text-red-300 dark:hover:bg-red-500/10"
                                  >
                                    <FiTrash2
                                      aria-hidden="true"
                                    />
                                  </button>
                                </div>
                              </div>
                            )
                          )}

                          {item.criteria.length === 0 && (
                            <div className="rounded-2xl border border-dashed border-gray-300 p-5 text-center text-sm text-gray-500 dark:border-slate-700 dark:text-gray-400">
                              No evaluation criteria
                              configured for this factor.
                              Add at least one criterion
                              before reviewing and saving
                              the policy.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <h4 className="font-bold text-gray-900 dark:text-white">
                            {item.factor}
                          </h4>

                          <p className="mt-1 text-sm leading-6 text-gray-600 dark:text-gray-400">
                            {item.description}
                          </p>
                        </div>

                        <span className="w-fit shrink-0 rounded-xl bg-indigo-100 px-3 py-1.5 text-xs font-bold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                          Weight: {item.weight}%
                        </span>
                      </div>

                      <div className="mt-5 border-t border-gray-100 pt-4 dark:border-white/10">
                        <div className="mb-3">
                          <h5 className="text-xs font-extrabold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            Evaluation Criteria
                          </h5>


                        </div>

                        <ol className="space-y-3">
                          {item.criteria.map(
                            (
                              criterion,
                              criterionIndex
                            ) => (
                              <li
                                key={criterion.id}
                                className="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-white/5 dark:bg-slate-950/40"
                              >
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-200 text-xs font-extrabold text-gray-700 dark:bg-slate-800 dark:text-gray-300">
                                  {criterionIndex + 1}
                                </span>

                                <div className="min-w-0">
                                  <p className="text-sm font-bold leading-6 text-gray-900 dark:text-white">
                                    {criterion.name}
                                  </p>

                                  {criterion.description && (
                                    <p className="mt-0.5 text-sm leading-6 text-gray-600 dark:text-gray-400">
                                      {criterion.description}
                                    </p>
                                  )}
                                </div>
                              </li>
                            )
                          )}
                        </ol>
                      </div>
                    </>                  )}
                </article>
              )
            )}
          </div>
        </div>

        <div className="border-t border-gray-200 p-5 sm:p-6 dark:border-white/10">
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300">
            <div className="flex items-start gap-3">
              <FiInfo
                className="mt-0.5 shrink-0"
                aria-hidden="true"
              />

              <div>
                <p className="text-sm font-semibold leading-6">
                  Performance evaluation settings
                </p>

                <p className="mt-1 text-xs leading-5">
                  These settings apply to the
                  organization’s employee performance
                  evaluation process.
                </p>

                <p className="mt-2 text-xs leading-5">
                  Incident and disciplinary evaluations
                  are handled separately.
                </p>

                <p className="mt-3 text-xs font-semibold">
                  Last updated:{" "}
                  {formatDateTime(
                    configuration.metadata?.updatedAt
                  )}
                  {configuration.metadata?.updatedBy
                    ? ` by ${configuration.metadata.updatedBy}`
                    : ""}
                  {configuration.metadata?.updatedByRole
                    ? ` (${configuration.metadata.updatedByRole})`
                    : ""}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Dialog
        open={showReviewDialog}
        onClose={() => {
          if (!isSaving) {
            setShowReviewDialog(false);
          }
        }}
        title="Review Performance Evaluation Policy"
        description="Verify the rating ranges, KPI factor weights, and evaluation criteria before applying this organization-wide policy."
        tone="default"
        size="xl"
        preventClose={isSaving}
        closeOnOverlay={!isSaving}
        closeOnEscape={!isSaving}
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              disabled={isSaving}
              onClick={() =>
                setShowReviewDialog(false)
              }
            >
              Back to Edit
            </Button>

            <Button
              type="button"
              variant="success"
              leftIcon={<FiSave />}
              loading={isSaving}
              disabled={isSaving}
              onClick={handleConfirmSave}
            >
              Confirm and Save
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          <section>
            <h3 className="text-sm font-extrabold uppercase tracking-wide text-gray-700 dark:text-gray-300">
              Rating Scale Review
            </h3>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {draftConfiguration.ratingScale.map(
                (item, index) => (
                  <div
                    key={item.id}
                    className={`rounded-2xl border p-4 ${
                      RATING_STYLES[index] ||
                      RATING_STYLES[
                        RATING_STYLES.length - 1
                      ]
                    }`}
                  >
                    <p className="text-xs font-bold">
                      {formatRatingRange(item)}
                    </p>

                    <p className="mt-1 font-extrabold">
                      {item.rating}
                    </p>

                    <p className="mt-2 text-xs leading-5">
                      {item.description}
                    </p>
                  </div>
                )
              )}
            </div>
          </section>

          <section>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-extrabold uppercase tracking-wide text-gray-700 dark:text-gray-300">
                KPI Factor Review
              </h3>

              <span
                className={[
                  "rounded-full px-3 py-1 text-xs font-extrabold",
                  isWeightTotalValid
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                    : "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
                ].join(" ")}
              >
                Total Weight: {totalWeight}%
              </span>
            </div>

            <div className="mt-3 space-y-3">
              {draftConfiguration.kpiFactors.map(
                (item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-gray-200 p-4 dark:border-white/10"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-gray-900 dark:text-white">
                          {item.factor}
                        </p>

                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                          {item.description}
                        </p>
                      </div>

                      <span className="shrink-0 rounded-xl bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                        Weight: {item.weight}%
                      </span>
                    </div>

                    <div className="mt-4 border-t border-gray-100 pt-3 dark:border-white/10">
                      <p className="text-xs font-extrabold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        {item.criteria.length}{" "}
                        {item.criteria.length === 1
                          ? "Evaluation Criterion"
                          : "Evaluation Criteria"}
                      </p>

                      <div className="mt-2 space-y-2">
                        {item.criteria.map(
                          (
                            criterion,
                            criterionIndex
                          ) => (
                            <div
                              key={criterion.id}
                              className="rounded-xl bg-gray-50 p-3 dark:bg-slate-950/40"
                            >
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                {criterionIndex + 1}.{" "}
                                {criterion.name}
                              </p>

                              {criterion.description && (
                                <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">
                                  {criterion.description}
                                </p>
                              )}
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
          </section>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
            <div className="flex items-start gap-3">
              <FiAlertTriangle
                className="mt-0.5 shrink-0"
                aria-hidden="true"
              />

              <p>
                Saving updates the organization-wide
                performance evaluation policy. It does
                not create or modify an individual
                employee evaluation and does not change
                the separate incident-based DSS rules.
              </p>
            </div>
          </div>
        </div>
      </Dialog>

      <ConfirmDialog
        open={showDiscardDialog}
        title="Discard Performance Evaluation Changes?"
        tone="warning"
        confirmLabel="Discard Changes"
        cancelLabel="Continue Editing"
        loading={false}
        closeOnBackdrop={!isSaving}
        onClose={() =>
          setShowDiscardDialog(false)
        }
        onConfirm={
          handleDiscardChanges
        }
      >
        <p>
          All unsaved changes to the rating scale,
          KPI factors, weights, and evaluation criteria
          will be discarded.
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={showRestoreDialog}
        title="Load Default Performance Evaluation Policy?"
        tone="warning"
        confirmLabel="Load Defaults"
        cancelLabel="Cancel"
        loading={false}
        closeOnBackdrop={!isSaving}
        onClose={() =>
          setShowRestoreDialog(false)
        }
        onConfirm={
          handleRestoreDefaults
        }
      >
        <p>
          The original company rating scale, KPI
          factors, weights, and evaluation criteria
          will be loaded into editing mode.
        </p>

        <p className="mt-2 font-semibold">
          Nothing will be changed in the organization
          database until you review and save.
        </p>
      </ConfirmDialog>

      <SuccessToast
        title="Performance evaluation policy updated"
        message={successMessage}
        duration={4000}
        onClose={() =>
          setSuccessMessage("")
        }
      />
    </div>
  );
}