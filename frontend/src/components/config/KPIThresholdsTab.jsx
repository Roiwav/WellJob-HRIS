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
  FiCheckCircle,
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

const KPI_CONFIGURATION_STORAGE_KEY =
  "welljob_system_configuration_kpi";

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
    subFactors: [
      "No. of leave of absences",
      "(bilang ng araw ng pagliban na may kaukulang pahintulot)",
      "No. of Absences without Leave",
      "(bilang ng pagliban na walang pahintulot)",
      "Accumulated Tardiness",
      "(kabuuang bilang sa huling oras na itinakda sa pagpasok)",
      "Unauthorized Undertime",
      "(hindi pagbuo sa walong oras (8) na itinakdang pagpasok)",
    ],
  },
  {
    id: "factor-safety",
    weight: 15,
    factor: "II. SAFETY AND HOUSEKEEPING",
    description:
      "Concern for order and cleanliness of work area, including proper decorum at work.",
    subFactors: [
      "Understanding / implementing 5’s",
      "(pagpapanatili ng kaayusan at kalinisan sa trabaho)",
    ],
  },
  {
    id: "factor-dependability",
    weight: 5,
    factor: "III. DEPENDABILITY AND RELIABILITY",
    description:
      "Worthy of confidence, responsible, tried and true solidness; trustability.",
    subFactors: [
      "(Mapagkakatiwalaan at mapapanagutan sa trabaho)",
    ],
  },
  {
    id: "factor-attitude",
    weight: 20,
    factor: "IV. JOB WORK ATTITUDE / BEHAVIOR",
    description:
      "General attitude toward work such as desire for self-improvement willingness to help and cooperate with the group, inherent trait of flexibility and resourcefulness in handling situation.",
    subFactors: [
      "Kabuuang pagpapakita sa saloobin patungkol sa trabaho",
      "pagpapabuti sa sarili, kahandaang tumulong",
      "At makipagtulungan sa pangkat at kakayahang umangkop",
      "at kapamaraanan sa paghawak ng sitwasyon",
    ],
  },
  {
    id: "factor-completion",
    weight: 50,
    factor: "V. COMPLETION OF WORK",
    description: "Ability to meet deadlines and target output.",
    subFactors: [
      "(Kakayahang matapos ang gawain sa itinakdang araw)",
      "QUALITY AND EFFICIENCY (Kalidad at kahusayan sa trabaho)",
      "ACCURACY (Katumpakan o ganap na kawastuhan)",
      "TIMELINESS (Pagiging napapanahon o maagap)",
      "IMPLEMENTATION AND EXECUTION (Pagsasagawa at pagsasakatuparan)",
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

const TEXTAREA_CLASS_NAME = `${INPUT_CLASS_NAME} min-h-24 resize-y`;

function cloneConfiguration(value) {
  return JSON.parse(JSON.stringify(value));
}

function getDefaultConfiguration() {
  return {
    ratingScale: cloneConfiguration(DEFAULT_RATING_SCALE),
    kpiFactors: cloneConfiguration(DEFAULT_KPI_FACTORS),
    metadata: {
      updatedAt: null,
      updatedBy: null,
      updatedByRole: null,
    },
  };
}

function normalizeRatingScale(ratingScale) {
  if (!Array.isArray(ratingScale)) {
    return cloneConfiguration(DEFAULT_RATING_SCALE);
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

function normalizeFactors(factors) {
  if (!Array.isArray(factors)) {
    return cloneConfiguration(DEFAULT_KPI_FACTORS);
  }

  return factors.map((item, index) => ({
    id: item?.id || `factor-${index + 1}`,
    weight: Number(item?.weight),
    factor: String(item?.factor || ""),
    description: String(item?.description || ""),
    subFactors: Array.isArray(item?.subFactors)
      ? item.subFactors.map((subFactor) =>
          String(subFactor || "")
        )
      : [],
  }));
}

function loadStoredConfiguration() {
  const fallback = getDefaultConfiguration();

  try {
    const storedValue = localStorage.getItem(
      KPI_CONFIGURATION_STORAGE_KEY
    );

    if (!storedValue) {
      return fallback;
    }

    const parsedValue = JSON.parse(storedValue);

    return {
      ratingScale: normalizeRatingScale(
        parsedValue?.ratingScale
      ),
      kpiFactors: normalizeFactors(
        parsedValue?.kpiFactors
      ),
      metadata: {
        updatedAt:
          parsedValue?.metadata?.updatedAt || null,
        updatedBy:
          parsedValue?.metadata?.updatedBy || null,
        updatedByRole:
          parsedValue?.metadata?.updatedByRole || null,
      },
    };
  } catch (error) {
    console.error(
      "Unable to load stored KPI configuration:",
      error
    );

    return fallback;
  }
}

function getCurrentUserName(user) {
  return (
    user?.full_name ||
    user?.fullName ||
    user?.name ||
    user?.username ||
    "Authorized User"
  );
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

  if (min === 0) {
    return `${max}% and Below`;
  }

  return `${min}%–${max}%`;
}

function validateConfiguration(configuration) {
  const errors = [];

  const ratingScale = configuration?.ratingScale || [];
  const factors = configuration?.kpiFactors || [];

  if (ratingScale.length === 0) {
    errors.push(
      "At least one performance rating range is required."
    );
  }

  const sortedRatings = [...ratingScale].sort(
    (first, second) =>
      Number(first.min) - Number(second.min)
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

    if (!String(item.description || "").trim()) {
      errors.push(
        `Rating range ${position} must have a description.`
      );
    }

    if (index > 0) {
      const previousItem = sortedRatings[index - 1];
      const previousMax = Number(previousItem.max);

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
      sortedRatings[sortedRatings.length - 1].max
    ) !== 100
  ) {
    errors.push(
      "The final rating range must end at 100%."
    );
  }

  if (factors.length === 0) {
    errors.push("At least one KPI factor is required.");
  }

  const totalWeight = factors.reduce(
    (sum, item) => sum + Number(item.weight || 0),
    0
  );

  if (totalWeight !== 100) {
    errors.push(
      `KPI factor weights must total exactly 100%. Current total: ${totalWeight}%.`
    );
  }

  factors.forEach((item, index) => {
    const position = index + 1;
    const weight = Number(item.weight);

    if (!String(item.factor || "").trim()) {
      errors.push(
        `KPI factor ${position} must have a factor name.`
      );
    }

    if (!String(item.description || "").trim()) {
      errors.push(
        `KPI factor ${position} must have a description.`
      );
    }

    if (
      !Number.isFinite(weight) ||
      weight <= 0 ||
      weight > 100
    ) {
      errors.push(
        `KPI factor ${position} must have a weight greater than 0 and not more than 100.`
      );
    }

    const validSubFactors = (
      item.subFactors || []
    ).filter((subFactor) =>
      String(subFactor || "").trim()
    );

    if (validSubFactors.length === 0) {
      errors.push(
        `KPI factor ${position} must contain at least one sub-factor.`
      );
    }
  });

  return errors;
}

function createConfigurationSnapshot(configuration) {
  return JSON.stringify({
    ratingScale: configuration.ratingScale,
    kpiFactors: configuration.kpiFactors,
  });
}

export default function KPIThresholdsTab({
  canEdit = false,
  currentUser = null,
  currentUserRole = "",
}) {
  const [configuration, setConfiguration] = useState(
    loadStoredConfiguration
  );

  const [draftConfiguration, setDraftConfiguration] =
    useState(() =>
      cloneConfiguration(loadStoredConfiguration())
    );

  const [isEditing, setIsEditing] = useState(false);
  const [showReviewDialog, setShowReviewDialog] =
    useState(false);
  const [showDiscardDialog, setShowDiscardDialog] =
    useState(false);
  const [showRestoreDialog, setShowRestoreDialog] =
    useState(false);

  const [validationErrors, setValidationErrors] =
    useState([]);
  const [successMessage, setSuccessMessage] =
    useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!canEdit && isEditing) {
      setIsEditing(false);
      setShowReviewDialog(false);
      setShowDiscardDialog(false);
      setDraftConfiguration(
        cloneConfiguration(configuration)
      );
      setValidationErrors([]);
    }
  }, [canEdit, configuration, isEditing]);

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

  const hasUnsavedChanges = useMemo(() => {
    return (
      createConfigurationSnapshot(configuration) !==
      createConfigurationSnapshot(draftConfiguration)
    );
  }, [configuration, draftConfiguration]);

  const activeConfiguration = isEditing
    ? draftConfiguration
    : configuration;

  const handleStartEditing = useCallback(() => {
    if (!canEdit) {
      return;
    }

    setDraftConfiguration(
      cloneConfiguration(configuration)
    );
    setValidationErrors([]);
    setIsEditing(true);
  }, [canEdit, configuration]);

  const handleRequestCancel = useCallback(() => {
    if (!isEditing || isSaving) {
      return;
    }

    if (hasUnsavedChanges) {
      setShowDiscardDialog(true);
      return;
    }

    setIsEditing(false);
    setValidationErrors([]);
  }, [hasUnsavedChanges, isEditing, isSaving]);

  const handleDiscardChanges = useCallback(() => {
    if (isSaving) {
      return;
    }

    setDraftConfiguration(
      cloneConfiguration(configuration)
    );
    setValidationErrors([]);
    setShowDiscardDialog(false);
    setShowReviewDialog(false);
    setIsEditing(false);
  }, [configuration, isSaving]);

  const handleRatingChange = useCallback(
    (ratingId, field, value) => {
      if (!canEdit || !isEditing) {
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
    [canEdit, isEditing]
  );

  const handleFactorChange = useCallback(
    (factorId, field, value) => {
      if (!canEdit || !isEditing) {
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
    [canEdit, isEditing]
  );

  const handleSubFactorChange = useCallback(
    (factorId, subFactorIndex, value) => {
      if (!canEdit || !isEditing) {
        return;
      }

      setDraftConfiguration(
        (currentConfiguration) => ({
          ...currentConfiguration,
          kpiFactors:
            currentConfiguration.kpiFactors.map(
              (factor) => {
                if (factor.id !== factorId) {
                  return factor;
                }

                const nextSubFactors = [
                  ...factor.subFactors,
                ];

                nextSubFactors[subFactorIndex] = value;

                return {
                  ...factor,
                  subFactors: nextSubFactors,
                };
              }
            ),
        })
      );

      setValidationErrors([]);
    },
    [canEdit, isEditing]
  );

  const handleAddSubFactor = useCallback(
    (factorId) => {
      if (!canEdit || !isEditing) {
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
                      subFactors: [
                        ...factor.subFactors,
                        "",
                      ],
                    }
                  : factor
            ),
        })
      );
    },
    [canEdit, isEditing]
  );

  const handleRemoveSubFactor = useCallback(
    (factorId, subFactorIndex) => {
      if (!canEdit || !isEditing) {
        return;
      }

      setDraftConfiguration(
        (currentConfiguration) => ({
          ...currentConfiguration,
          kpiFactors:
            currentConfiguration.kpiFactors.map(
              (factor) => {
                if (factor.id !== factorId) {
                  return factor;
                }

                return {
                  ...factor,
                  subFactors:
                    factor.subFactors.filter(
                      (_, index) =>
                        index !== subFactorIndex
                    ),
                };
              }
            ),
        })
      );

      setValidationErrors([]);
    },
    [canEdit, isEditing]
  );

  const handleReviewChanges = useCallback(() => {
    if (
      !canEdit ||
      !isEditing ||
      !hasUnsavedChanges
    ) {
      return;
    }

    const errors = validateConfiguration(
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

  const handleConfirmSave = useCallback(async () => {
    if (
      !canEdit ||
      !isEditing ||
      isSaving
    ) {
      return;
    }

    const errors = validateConfiguration(
      draftConfiguration
    );

    if (errors.length > 0) {
      setValidationErrors(errors);
      setShowReviewDialog(false);
      return;
    }

    try {
      setIsSaving(true);

      const savedConfiguration = {
        ratingScale:
          draftConfiguration.ratingScale.map(
            (item) => ({
              ...item,
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
              ...item,
              weight: Number(item.weight),
              factor: item.factor.trim(),
              description:
                item.description.trim(),
              subFactors: item.subFactors
                .map((subFactor) =>
                  subFactor.trim()
                )
                .filter(Boolean),
            })
          ),
        metadata: {
          updatedAt: new Date().toISOString(),
          updatedBy:
            getCurrentUserName(currentUser),
          updatedByRole:
            currentUserRole ||
            currentUser?.role ||
            "Authorized User",
        },
      };

      localStorage.setItem(
        KPI_CONFIGURATION_STORAGE_KEY,
        JSON.stringify(savedConfiguration)
      );

      setConfiguration(
        cloneConfiguration(savedConfiguration)
      );
      setDraftConfiguration(
        cloneConfiguration(savedConfiguration)
      );

      setValidationErrors([]);
      setShowReviewDialog(false);
      setIsEditing(false);

      setSuccessMessage(
        "KPI thresholds and performance factors were updated successfully."
      );

      window.dispatchEvent(
        new CustomEvent("dataUpdated", {
          detail: {
            source: "kpi-threshold-configuration",
            domain: "system-configuration",
            action: "UPDATE_KPI_CONFIGURATION",
            at: Date.now(),
          },
        })
      );
    } catch (error) {
      console.error(
        "Unable to save KPI configuration:",
        error
      );

      setValidationErrors([
        "The KPI configuration could not be saved in this browser. Please check browser storage permissions and try again.",
      ]);
      setShowReviewDialog(false);
    } finally {
      setIsSaving(false);
    }
  }, [
    canEdit,
    currentUser,
    currentUserRole,
    draftConfiguration,
    isEditing,
    isSaving,
  ]);

  const handleRestoreDefaults = useCallback(() => {
    if (!canEdit || isSaving) {
      return;
    }

    const defaults = getDefaultConfiguration();

    setDraftConfiguration(defaults);
    setValidationErrors([]);
    setShowRestoreDialog(false);
    setIsEditing(true);
  }, [canEdit, isSaving]);

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
                Configuration validation failed
              </h3>

              <p className="mt-1 text-sm">
                Correct the following items before
                reviewing and saving:
              </p>

              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
                {validationErrors.map(
                  (error, index) => (
                    <li key={`${error}-${index}`}>
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
                  KPI Evaluation Framework
                </h2>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-100">
                  Company performance rating ranges and
                  weighted KPI factors used for employee
                  evaluation and decision-support
                  computation.
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white ring-1 ring-white/20">
                    Total weight: {totalWeight}%
                  </span>

                  <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white ring-1 ring-white/20">
                    {isEditing
                      ? "Editing mode"
                      : canEdit
                        ? "Editable configuration"
                        : "View-only configuration"}
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
                    leftIcon={<FiRotateCcw />}
                    onClick={() =>
                      setShowRestoreDialog(true)
                    }
                  >
                    Restore Defaults
                  </Button>

                  <Button
                    type="button"
                    leftIcon={<FiEdit3 />}
                    onClick={handleStartEditing}
                  >
                    Edit Configuration
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
                    onClick={handleRequestCancel}
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
                    onClick={handleReviewChanges}
                  >
                    Review Changes
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="border-b border-gray-200 p-5 sm:p-6 dark:border-white/10">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-extrabold uppercase tracking-wide text-gray-700 dark:text-gray-300">
                Rating Scale
              </h3>

              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Rating ranges must cover 0% to 100%
                without gaps or overlaps.
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
                            value={item.min}
                            onChange={(event) =>
                              handleRatingChange(
                                item.id,
                                "min",
                                event.target.value
                              )
                            }
                            className={INPUT_CLASS_NAME}
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
                            value={item.max}
                            onChange={(event) =>
                              handleRatingChange(
                                item.id,
                                "max",
                                event.target.value
                              )
                            }
                            className={INPUT_CLASS_NAME}
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
                          className={INPUT_CLASS_NAME}
                        />
                      </label>

                      <label className="block">
                        <span className="mb-1.5 block text-xs font-bold">
                          Description
                        </span>

                        <textarea
                          value={item.description}
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
                          Frequency or Action Notes
                        </span>

                        <textarea
                          value={item.frequency}
                          placeholder="Optional policy notes..."
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
                        <div className="mt-3 rounded-xl bg-white/70 p-2 text-xs font-medium dark:bg-slate-900/50">
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
                KPI Factors
              </h3>

              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Combined KPI factor weights must equal
                exactly 100%.
              </p>
            </div>

            <span
              className={[
                "inline-flex w-fit rounded-xl border px-3 py-1.5 text-xs font-extrabold",
                totalWeight === 100
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
                  : "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300",
              ].join(" ")}
            >
              Total: {totalWeight}%
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
                            Factor Name
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
                            className={INPUT_CLASS_NAME}
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
                            className={INPUT_CLASS_NAME}
                          />
                        </label>
                      </div>

                      <label className="block">
                        <span className="mb-1.5 block text-sm font-bold text-gray-700 dark:text-gray-200">
                          Description
                        </span>

                        <textarea
                          value={item.description}
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
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                              Sub-Factors
                            </h4>

                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              Add the evaluation items
                              included under this factor.
                            </p>
                          </div>

                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            leftIcon={<FiPlus />}
                            onClick={() =>
                              handleAddSubFactor(
                                item.id
                              )
                            }
                          >
                            Add Sub-Factor
                          </Button>
                        </div>

                        <div className="space-y-3">
                          {item.subFactors.map(
                            (
                              subFactor,
                              subFactorIndex
                            ) => (
                              <div
                                key={`${item.id}-${subFactorIndex}`}
                                className="flex items-start gap-2"
                              >
                                <span className="mt-3 text-xs font-bold text-gray-400">
                                  {subFactorIndex + 1}.
                                </span>

                                <input
                                  type="text"
                                  value={subFactor}
                                  placeholder="Enter sub-factor..."
                                  onChange={(event) =>
                                    handleSubFactorChange(
                                      item.id,
                                      subFactorIndex,
                                      event.target.value
                                    )
                                  }
                                  className={
                                    INPUT_CLASS_NAME
                                  }
                                />

                                <button
                                  type="button"
                                  aria-label={`Remove sub-factor ${
                                    subFactorIndex + 1
                                  } from factor ${
                                    factorIndex + 1
                                  }`}
                                  title="Remove sub-factor"
                                  onClick={() =>
                                    handleRemoveSubFactor(
                                      item.id,
                                      subFactorIndex
                                    )
                                  }
                                  className="mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-red-600 transition hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:text-red-300 dark:hover:bg-red-500/10"
                                >
                                  <FiTrash2
                                    aria-hidden="true"
                                  />
                                </button>
                              </div>
                            )
                          )}

                          {item.subFactors.length ===
                            0 && (
                            <div className="rounded-2xl border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500 dark:border-slate-700 dark:text-gray-400">
                              No sub-factors added.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h4 className="font-bold text-gray-900 dark:text-white">
                            {item.factor}
                          </h4>

                          <p className="mt-1 text-sm leading-6 text-gray-600 dark:text-gray-400">
                            {item.description}
                          </p>
                        </div>

                        <span className="shrink-0 rounded-xl bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                          {item.weight}%
                        </span>
                      </div>

                      <div className="mt-4 space-y-2 text-sm text-gray-700 dark:text-gray-300">
                        {item.subFactors.map(
                          (
                            subFactor,
                            subFactorIndex
                          ) => (
                            <p
                              key={`${item.id}-${subFactorIndex}`}
                              className="flex gap-2"
                            >
                              <FiCheckCircle
                                className="mt-1 shrink-0 text-emerald-500"
                                size={14}
                                aria-hidden="true"
                              />

                              <span>
                                {subFactor}
                              </span>
                            </p>
                          )
                        )}
                      </div>
                    </>
                  )}
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
                  KPI ratings are based on the
                  organization’s approved performance
                  evaluation policy.
                </p>

                <p className="mt-1 text-xs leading-5">
                  Current frontend changes are stored in
                  this browser temporarily. Permanent,
                  organization-wide persistence will be
                  connected to the backend configuration
                  API later.
                </p>

                <p className="mt-2 text-xs font-semibold">
                  Last updated:{" "}
                  {formatDateTime(
                    configuration.metadata?.updatedAt
                  )}
                  {configuration.metadata?.updatedBy
                    ? ` by ${configuration.metadata.updatedBy}`
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
        title="Review KPI Configuration Changes"
        description="Verify the rating ranges and KPI factor weights before applying the updated policy."
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
                        RATING_STYLES.length -
                          1
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
                  totalWeight === 100
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
                        {item.weight}%
                      </span>
                    </div>

                    <p className="mt-3 text-xs font-semibold text-gray-500 dark:text-gray-400">
                      {item.subFactors.filter(
                        (subFactor) =>
                          subFactor.trim()
                      ).length}{" "}
                      sub-factor(s)
                    </p>
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
                Saving will replace the current
                browser-based KPI configuration. The
                updated thresholds may affect future
                frontend decision-support calculations
                that read this configuration.
              </p>
            </div>
          </div>
        </div>
      </Dialog>

      <ConfirmDialog
        open={showDiscardDialog}
        title="Discard KPI Changes?"
        tone="warning"
        confirmLabel="Discard Changes"
        cancelLabel="Continue Editing"
        loading={false}
        closeOnBackdrop={!isSaving}
        onClose={() =>
          setShowDiscardDialog(false)
        }
        onConfirm={handleDiscardChanges}
      >
        <p>
          All unsaved changes to the rating scale
          and KPI factors will be removed.
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={showRestoreDialog}
        title="Restore Default KPI Configuration?"
        tone="warning"
        confirmLabel="Load Defaults"
        cancelLabel="Cancel"
        loading={false}
        closeOnBackdrop={!isSaving}
        onClose={() =>
          setShowRestoreDialog(false)
        }
        onConfirm={handleRestoreDefaults}
      >
        <p>
          The original company rating scale and KPI
          factor values will be loaded into editing
          mode.
        </p>

        <p className="mt-2 font-semibold">
          You must still review and save before the
          defaults are applied.
        </p>
      </ConfirmDialog>

      <SuccessToast
        title="KPI configuration updated"
        message={successMessage}
        duration={4000}
        onClose={() => setSuccessMessage("")}
      />
    </div>
  );
}