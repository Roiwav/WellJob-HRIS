import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  FiAlertTriangle,
  FiBookOpen,
  FiEdit3,
  FiInfo,
  FiPlus,
  FiRotateCcw,
  FiSave,
  FiSearch,
  FiShield,
  FiTrash2,
  FiX,
} from "react-icons/fi";

import {
  NORMALIZED_VIOLATION_RULES as DEFAULT_VIOLATION_RULES,
} from "../../data/violationRules";

import ViolationTable from "./ViolationTable";

import Button from "../ui/Button";
import Dialog from "../ui/Dialog";
import ConfirmDialog from "../ui/ConfirmDialog";
import SuccessToast from "../ui/SuccessToast";

const VIOLATION_RULES_STORAGE_KEY =
  "welljob_system_configuration_violation_rules";

const SEVERITY_OPTIONS = [
  "Minor",
  "Major",
  "Critical",
];

const PENALTY_LEVEL_OPTIONS = [
  "Warning",
  "Warning / 1–7 Days Suspension",
  "1–7 Days Suspension",
  "1 to 7 Days Suspension",
  "7–30 Days Suspension",
  "7–30 Days Suspension / Dismissal / RTA",
  "15-30 Days Suspension",
  "15-30 Days Suspension / Dismissal",
  "15 to 30 Days Suspension",
  "15 to 30 Days Suspension / Dismissal / RTA",
  "15-30 Days Suspension / Dismissal / RTA",
  "30 Days Suspension",
  "30 Days Suspension / Dismissal",
  "30 Days Suspension / Dismissal / RTA",
  "Dismissal / RTA",
  "Re-assignment or Dismissal / RTA",
];

const EMPTY_RULE_FORM = {
  category: "",
  section: "",
  violation: "",
  description: "",
  penaltyLevel: "",
  severity: ["Minor"],
  penalties: [""],
};

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
  `${INPUT_CLASS_NAME} min-h-28 resize-y`;

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function createRuleId() {
  return `violation-rule-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function normalizeSeverity(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }

  if (!value) {
    return [];
  }

  return [String(value).trim()].filter(Boolean);
}

function formatPenaltyForStorage(penalty, index) {
  if (typeof penalty === "string") {
    return penalty.trim();
  }

  if (penalty && typeof penalty === "object") {
    const label =
      penalty.label ||
      `Offense ${penalty.offenseNo || index + 1}`;

    const action =
      penalty.action || "No action";

    return `${label}: ${action}`;
  }

  return "";
}

function normalizeRules(groups) {
  if (!Array.isArray(groups)) {
    return [];
  }

  return groups
    .map((group, groupIndex) => ({
      category:
        String(
          group?.category ||
            `Category ${groupIndex + 1}`
        ).trim(),
      rows: Array.isArray(group?.rows)
        ? group.rows.map((item, rowIndex) => ({
            id:
              item?.id ||
              `rule-${groupIndex + 1}-${rowIndex + 1}`,
            section: String(item?.section || "").trim(),
            violation: String(
              item?.violation || ""
            ).trim(),
            description: String(
              item?.description || ""
            ).trim(),
            penaltyLevel: String(
              item?.penaltyLevel || ""
            ).trim(),
            severity: normalizeSeverity(
              item?.severity
            ),
            penalties: Array.isArray(item?.penalties)
              ? item.penalties
                  .map((penalty, penaltyIndex) =>
                    formatPenaltyForStorage(
                      penalty,
                      penaltyIndex
                    )
                  )
                  .filter(Boolean)
              : [],
          }))
        : [],
    }))
    .filter(
      (group) =>
        group.category && group.rows.length > 0
    );
}

function getDefaultRules() {
  return normalizeRules(
    cloneValue(DEFAULT_VIOLATION_RULES)
  );
}

function loadStoredRules() {
  try {
    const storedValue = localStorage.getItem(
      VIOLATION_RULES_STORAGE_KEY
    );

    if (!storedValue) {
      return {
        rules: getDefaultRules(),
        metadata: {
          updatedAt: null,
          updatedBy: null,
          updatedByRole: null,
        },
      };
    }

    const parsedValue = JSON.parse(storedValue);

    return {
      rules: normalizeRules(parsedValue?.rules),
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
      "Unable to load violation rules:",
      error
    );

    return {
      rules: getDefaultRules(),
      metadata: {
        updatedAt: null,
        updatedBy: null,
        updatedByRole: null,
      },
    };
  }
}

function createRulesSnapshot(rules) {
  return JSON.stringify(normalizeRules(rules));
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

function stripHtml(value) {
  return String(value || "").replace(
    /<[^>]*>/g,
    " "
  );
}

function getPenaltySearchText(penalties) {
  return (penalties || [])
    .map((penalty, index) =>
      formatPenaltyForStorage(penalty, index)
    )
    .join(" ");
}

function findRuleById(groups, ruleId) {
  for (const group of groups) {
    const rule = group.rows.find(
      (item) => item.id === ruleId
    );

    if (rule) {
      return {
        group,
        rule,
      };
    }
  }

  return null;
}

function validateRuleForm(form) {
  const errors = [];

  if (!form.category.trim()) {
    errors.push("Category is required.");
  }

  if (!form.section.trim()) {
    errors.push("Section is required.");
  }

  if (!form.violation.trim()) {
    errors.push("Violation title is required.");
  }

  if (!form.description.trim()) {
    errors.push("Violation description is required.");
  }

  if (!form.penaltyLevel.trim()) {
    errors.push("Penalty level is required.");
  }

  if (
    !Array.isArray(form.severity) ||
    form.severity.length === 0
  ) {
    errors.push(
      "At least one severity level is required."
    );
  }

  const validPenalties = form.penalties.filter(
    (penalty) => penalty.trim()
  );

  if (validPenalties.length === 0) {
    errors.push(
      "At least one penalty or disciplinary action is required."
    );
  }

  return errors;
}

function validateAllRules(groups) {
  const errors = [];

  if (!groups.length) {
    errors.push(
      "At least one violation category is required."
    );

    return errors;
  }

  groups.forEach((group, groupIndex) => {
    if (!group.category.trim()) {
      errors.push(
        `Category ${groupIndex + 1} must have a name.`
      );
    }

    if (!group.rows.length) {
      errors.push(
        `${group.category || `Category ${groupIndex + 1}`} must contain at least one rule.`
      );
    }

    group.rows.forEach((rule, ruleIndex) => {
      const prefix = `${
        group.category || `Category ${groupIndex + 1}`
      }, Rule ${ruleIndex + 1}`;

      if (!rule.section.trim()) {
        errors.push(`${prefix}: section is required.`);
      }

      if (!rule.violation.trim()) {
        errors.push(
          `${prefix}: violation title is required.`
        );
      }

      if (!rule.description.trim()) {
        errors.push(
          `${prefix}: description is required.`
        );
      }

      if (!rule.penaltyLevel.trim()) {
        errors.push(
          `${prefix}: penalty level is required.`
        );
      }

      if (
        !normalizeSeverity(rule.severity).length
      ) {
        errors.push(
          `${prefix}: at least one severity is required.`
        );
      }

      if (
        !(rule.penalties || []).some((penalty) =>
          String(penalty || "").trim()
        )
      ) {
        errors.push(
          `${prefix}: at least one penalty is required.`
        );
      }
    });
  });

  return errors;
}

export default function ViolationRulesTab({
  canEdit = false,
  currentUser = null,
  currentUserRole = "",
}) {
  const [savedConfiguration, setSavedConfiguration] =
    useState(loadStoredRules);

  const [draftRules, setDraftRules] = useState(() =>
    cloneValue(loadStoredRules().rules)
  );

  const [query, setQuery] = useState("");
  const [severityFilter, setSeverityFilter] =
    useState("All");

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [ruleDialogMode, setRuleDialogMode] =
    useState(null);

  const [ruleForm, setRuleForm] = useState(
    cloneValue(EMPTY_RULE_FORM)
  );

  const [editingRuleId, setEditingRuleId] =
    useState(null);

  const [ruleFormErrors, setRuleFormErrors] =
    useState([]);

  const [validationErrors, setValidationErrors] =
    useState([]);

  const [pendingDeleteRule, setPendingDeleteRule] =
    useState(null);

  const [showReviewDialog, setShowReviewDialog] =
    useState(false);

  const [showDiscardDialog, setShowDiscardDialog] =
    useState(false);

  const [showRestoreDialog, setShowRestoreDialog] =
    useState(false);

  const [successMessage, setSuccessMessage] =
    useState("");

  useEffect(() => {
    if (!canEdit && isEditing) {
      setIsEditing(false);
      setRuleDialogMode(null);
      setDraftRules(
        cloneValue(savedConfiguration.rules)
      );
      setValidationErrors([]);
      setRuleFormErrors([]);
    }
  }, [
    canEdit,
    isEditing,
    savedConfiguration.rules,
  ]);

  const activeRules = isEditing
    ? draftRules
    : savedConfiguration.rules;

  const hasUnsavedChanges = useMemo(() => {
    return (
      createRulesSnapshot(draftRules) !==
      createRulesSnapshot(savedConfiguration.rules)
    );
  }, [draftRules, savedConfiguration.rules]);

  const totalRules = useMemo(() => {
    return activeRules.reduce(
      (total, group) =>
        total + group.rows.length,
      0
    );
  }, [activeRules]);

  const filteredRules = useMemo(() => {
    const search = query.trim().toLowerCase();

    return activeRules
      .map((group) => {
        const rows = group.rows.filter((item) => {
          const searchableText = [
            group.category,
            item.section,
            item.violation,
            stripHtml(item.description),
            item.penaltyLevel,
            normalizeSeverity(item.severity).join(" "),
            getPenaltySearchText(item.penalties),
          ]
            .join(" ")
            .toLowerCase();

          const matchesSearch =
            !search ||
            searchableText.includes(search);

          const itemSeverity =
            normalizeSeverity(item.severity);

          const matchesSeverity =
            severityFilter === "All" ||
            itemSeverity.includes(severityFilter);

          return (
            matchesSearch && matchesSeverity
          );
        });

        return {
          ...group,
          rows,
        };
      })
      .filter(
        (group) => group.rows.length > 0
      );
  }, [
    activeRules,
    query,
    severityFilter,
  ]);

  const handleStartEditing = useCallback(() => {
    if (!canEdit) {
      return;
    }

    setDraftRules(
      cloneValue(savedConfiguration.rules)
    );
    setValidationErrors([]);
    setIsEditing(true);
  }, [canEdit, savedConfiguration.rules]);

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
  }, [
    hasUnsavedChanges,
    isEditing,
    isSaving,
  ]);

  const handleDiscardChanges = useCallback(() => {
    if (isSaving) {
      return;
    }

    setDraftRules(
      cloneValue(savedConfiguration.rules)
    );
    setValidationErrors([]);
    setRuleFormErrors([]);
    setRuleDialogMode(null);
    setShowReviewDialog(false);
    setShowDiscardDialog(false);
    setIsEditing(false);
  }, [isSaving, savedConfiguration.rules]);

  const handleOpenAddDialog = useCallback(() => {
    if (!canEdit || !isEditing) {
      return;
    }

    setEditingRuleId(null);
    setRuleForm(
      cloneValue(EMPTY_RULE_FORM)
    );
    setRuleFormErrors([]);
    setRuleDialogMode("add");
  }, [canEdit, isEditing]);

  const handleOpenEditDialog = useCallback(
    (ruleId) => {
      if (!canEdit || !isEditing) {
        return;
      }

      const result = findRuleById(
        draftRules,
        ruleId
      );

      if (!result) {
        return;
      }

      setEditingRuleId(ruleId);
      setRuleForm({
        category: result.group.category,
        section: result.rule.section,
        violation: result.rule.violation,
        description: result.rule.description,
        penaltyLevel:
          result.rule.penaltyLevel,
        severity: normalizeSeverity(
          result.rule.severity
        ),
        penalties:
          result.rule.penalties.length > 0
            ? cloneValue(
                result.rule.penalties
              )
            : [""],
      });

      setRuleFormErrors([]);
      setRuleDialogMode("edit");
    },
    [canEdit, draftRules, isEditing]
  );

  const handleCloseRuleDialog = useCallback(() => {
    if (isSaving) {
      return;
    }

    setRuleDialogMode(null);
    setEditingRuleId(null);
    setRuleFormErrors([]);
    setRuleForm(
      cloneValue(EMPTY_RULE_FORM)
    );
  }, [isSaving]);

  const handleRuleFieldChange = useCallback(
    (field, value) => {
      setRuleForm((currentForm) => ({
        ...currentForm,
        [field]: value,
      }));

      setRuleFormErrors([]);
    },
    []
  );

  const handleToggleSeverity = useCallback(
    (severity) => {
      setRuleForm((currentForm) => {
        const existing =
          normalizeSeverity(
            currentForm.severity
          );

        const nextSeverity = existing.includes(
          severity
        )
          ? existing.filter(
              (item) => item !== severity
            )
          : [...existing, severity];

        return {
          ...currentForm,
          severity: nextSeverity,
        };
      });

      setRuleFormErrors([]);
    },
    []
  );

  const handlePenaltyChange = useCallback(
    (index, value) => {
      setRuleForm((currentForm) => {
        const nextPenalties = [
          ...currentForm.penalties,
        ];

        nextPenalties[index] = value;

        return {
          ...currentForm,
          penalties: nextPenalties,
        };
      });

      setRuleFormErrors([]);
    },
    []
  );

  const handleAddPenalty = useCallback(() => {
    setRuleForm((currentForm) => ({
      ...currentForm,
      penalties: [
        ...currentForm.penalties,
        "",
      ],
    }));
  }, []);

  const handleRemovePenalty = useCallback(
    (index) => {
      setRuleForm((currentForm) => {
        const nextPenalties =
          currentForm.penalties.filter(
            (_, penaltyIndex) =>
              penaltyIndex !== index
          );

        return {
          ...currentForm,
          penalties:
            nextPenalties.length > 0
              ? nextPenalties
              : [""],
        };
      });

      setRuleFormErrors([]);
    },
    []
  );

  const handleSaveRuleForm = useCallback(() => {
    if (!canEdit || !isEditing) {
      return;
    }

    const errors =
      validateRuleForm(ruleForm);

    setRuleFormErrors(errors);

    if (errors.length > 0) {
      return;
    }

    const normalizedForm = {
      category: ruleForm.category.trim(),
      section: ruleForm.section.trim(),
      violation: ruleForm.violation.trim(),
      description:
        ruleForm.description.trim(),
      penaltyLevel:
        ruleForm.penaltyLevel.trim(),
      severity: normalizeSeverity(
        ruleForm.severity
      ),
      penalties: ruleForm.penalties
        .map((penalty) => penalty.trim())
        .filter(Boolean),
    };

    setDraftRules((currentRules) => {
      const nextRules =
        cloneValue(currentRules);

      if (ruleDialogMode === "edit") {
        let updatedRule = null;

        for (const group of nextRules) {
          const rowIndex =
            group.rows.findIndex(
              (item) =>
                item.id === editingRuleId
            );

          if (rowIndex === -1) {
            continue;
          }

          updatedRule = {
            ...group.rows[rowIndex],
            section: normalizedForm.section,
            violation:
              normalizedForm.violation,
            description:
              normalizedForm.description,
            penaltyLevel:
              normalizedForm.penaltyLevel,
            severity:
              normalizedForm.severity,
            penalties:
              normalizedForm.penalties,
          };

          group.rows.splice(rowIndex, 1);
          break;
        }

        if (!updatedRule) {
          return currentRules;
        }

        let targetGroup =
          nextRules.find(
            (group) =>
              group.category.toLowerCase() ===
              normalizedForm.category.toLowerCase()
          );

        if (!targetGroup) {
          targetGroup = {
            category:
              normalizedForm.category,
            rows: [],
          };

          nextRules.push(targetGroup);
        }

        targetGroup.rows.push(updatedRule);
      } else {
        const newRule = {
          id: createRuleId(),
          section: normalizedForm.section,
          violation:
            normalizedForm.violation,
          description:
            normalizedForm.description,
          penaltyLevel:
            normalizedForm.penaltyLevel,
          severity:
            normalizedForm.severity,
          penalties:
            normalizedForm.penalties,
        };

        let targetGroup =
          nextRules.find(
            (group) =>
              group.category.toLowerCase() ===
              normalizedForm.category.toLowerCase()
          );

        if (!targetGroup) {
          targetGroup = {
            category:
              normalizedForm.category,
            rows: [],
          };

          nextRules.push(targetGroup);
        }

        targetGroup.rows.push(newRule);
      }

      return nextRules.filter(
        (group) => group.rows.length > 0
      );
    });

    handleCloseRuleDialog();
  }, [
    canEdit,
    editingRuleId,
    handleCloseRuleDialog,
    isEditing,
    ruleDialogMode,
    ruleForm,
  ]);

  const handleRequestDeleteRule =
    useCallback(
      (ruleId) => {
        if (!canEdit || !isEditing) {
          return;
        }

        const result = findRuleById(
          draftRules,
          ruleId
        );

        if (!result) {
          return;
        }

        setPendingDeleteRule({
          id: ruleId,
          category: result.group.category,
          violation:
            result.rule.violation,
        });
      },
      [canEdit, draftRules, isEditing]
    );

  const handleConfirmDeleteRule =
    useCallback(() => {
      if (
        !pendingDeleteRule ||
        isSaving
      ) {
        return;
      }

      setDraftRules((currentRules) =>
        currentRules
          .map((group) => ({
            ...group,
            rows: group.rows.filter(
              (item) =>
                item.id !==
                pendingDeleteRule.id
            ),
          }))
          .filter(
            (group) =>
              group.rows.length > 0
          )
      );

      setPendingDeleteRule(null);
      setValidationErrors([]);
    }, [isSaving, pendingDeleteRule]);

  const handleReviewChanges = useCallback(() => {
    if (
      !canEdit ||
      !isEditing ||
      !hasUnsavedChanges
    ) {
      return;
    }

    const errors =
      validateAllRules(draftRules);

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
    draftRules,
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

    const errors =
      validateAllRules(draftRules);

    if (errors.length > 0) {
      setValidationErrors(errors);
      setShowReviewDialog(false);
      return;
    }

    try {
      setIsSaving(true);

      const savedRules =
        normalizeRules(draftRules);

      const nextConfiguration = {
        rules: savedRules,
        metadata: {
          updatedAt:
            new Date().toISOString(),
          updatedBy:
            getCurrentUserName(currentUser),
          updatedByRole:
            currentUserRole ||
            currentUser?.role ||
            "Authorized User",
        },
      };

      localStorage.setItem(
        VIOLATION_RULES_STORAGE_KEY,
        JSON.stringify(nextConfiguration)
      );

      setSavedConfiguration(
        cloneValue(nextConfiguration)
      );

      setDraftRules(
        cloneValue(savedRules)
      );

      setValidationErrors([]);
      setShowReviewDialog(false);
      setIsEditing(false);

      setSuccessMessage(
        "Violation rules were updated successfully."
      );

      window.dispatchEvent(
        new CustomEvent("dataUpdated", {
          detail: {
            source:
              "violation-rules-configuration",
            domain:
              "system-configuration",
            action:
              "UPDATE_VIOLATION_RULES",
            at: Date.now(),
          },
        })
      );
    } catch (error) {
      console.error(
        "Unable to save violation rules:",
        error
      );

      setValidationErrors([
        "The violation rules could not be saved in this browser. Check browser storage permissions and try again.",
      ]);

      setShowReviewDialog(false);
    } finally {
      setIsSaving(false);
    }
  }, [
    canEdit,
    currentUser,
    currentUserRole,
    draftRules,
    isEditing,
    isSaving,
  ]);

  const handleRestoreDefaults =
    useCallback(() => {
      if (!canEdit || isSaving) {
        return;
      }

      setDraftRules(getDefaultRules());
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
                Policy validation failed
              </h3>

              <p className="mt-1 text-sm">
                Correct the following items before
                saving:
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
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-6 sm:px-6 sm:py-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-white/15 p-3 text-white ring-1 ring-white/20">
                <FiBookOpen
                  size={22}
                  aria-hidden="true"
                />
              </div>

              <div>
                <h2 className="text-xl font-extrabold text-white">
                  Code of Conduct Violation Rules
                </h2>

                <p className="mt-2 max-w-3xl text-sm leading-6 text-indigo-100">
                  Configure violation categories,
                  disciplinary penalties, penalty
                  levels, and severity mappings used
                  by incident classification and HR
                  decision support.
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white ring-1 ring-white/20">
                    {totalRules} policy rule(s)
                  </span>

                  <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white ring-1 ring-white/20">
                    {isEditing
                      ? "Editing mode"
                      : canEdit
                        ? "Editable policy"
                        : "View-only policy"}
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
                    variant="secondary"
                    leftIcon={<FiPlus />}
                    disabled={isSaving}
                    onClick={
                      handleOpenAddDialog
                    }
                  >
                    Add Rule
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

        <div className="p-5 sm:p-6">
          <div
            className={[
              "rounded-2xl border border-dashed p-4",
              isEditing
                ? "border-amber-300 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10"
                : "border-indigo-200 bg-indigo-50/50 dark:border-indigo-500/30 dark:bg-indigo-500/10",
            ].join(" ")}
          >
            <div
              className={[
                "flex items-start gap-3 text-sm",
                isEditing
                  ? "text-amber-800 dark:text-amber-300"
                  : "text-indigo-800 dark:text-indigo-300",
              ].join(" ")}
            >
              {isEditing ? (
                <FiEdit3
                  className="mt-0.5 shrink-0"
                  aria-hidden="true"
                />
              ) : (
                <FiInfo
                  className="mt-0.5 shrink-0"
                  aria-hidden="true"
                />
              )}

              <p className="leading-6">
                {isEditing
                  ? "Editing is enabled. Use the actions in each row to update or remove a rule. Changes are not applied until they are reviewed and saved."
                  : canEdit
                    ? "This policy is protected by default. Select Edit Policy to make authorized changes."
                    : "Violation rules are available for reference only. Your assigned role cannot modify company policy."}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
            <FiShield aria-hidden="true" />

            <span>
              Last updated:{" "}
              {formatDateTime(
                savedConfiguration.metadata
                  ?.updatedAt
              )}
              {savedConfiguration.metadata
                ?.updatedBy
                ? ` by ${savedConfiguration.metadata.updatedBy}`
                : ""}
            </span>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
          <div className="relative">
            <FiSearch
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
              aria-hidden="true"
            />

            <label
              htmlFor="violation-policy-search"
              className="sr-only"
            >
              Search violation rules
            </label>

            <input
              id="violation-policy-search"
              type="search"
              value={query}
              onChange={(event) =>
                setQuery(event.target.value)
              }
              placeholder="Search section, violation, penalty, or category..."
              className={`${INPUT_CLASS_NAME} pl-11`}
            />
          </div>

          <div>
            <label
              htmlFor="violation-severity-filter"
              className="sr-only"
            >
              Filter by severity
            </label>

            <select
              id="violation-severity-filter"
              value={severityFilter}
              onChange={(event) =>
                setSeverityFilter(
                  event.target.value
                )
              }
              className={INPUT_CLASS_NAME}
            >
              <option value="All">
                All Severity
              </option>

              {SEVERITY_OPTIONS.map(
                (severity) => (
                  <option
                    key={severity}
                    value={severity}
                  >
                    {severity}
                  </option>
                )
              )}
            </select>
          </div>
        </div>
      </section>

      <ViolationTable
        rules={filteredRules}
        canEdit={canEdit && isEditing}
        onEdit={handleOpenEditDialog}
        onDelete={
          handleRequestDeleteRule
        }
      />

      <Dialog
        open={Boolean(ruleDialogMode)}
        onClose={handleCloseRuleDialog}
        title={
          ruleDialogMode === "edit"
            ? "Edit Violation Rule"
            : "Add Violation Rule"
        }
        description="Define the policy classification, severity, and disciplinary actions for this violation."
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
              onClick={
                handleCloseRuleDialog
              }
            >
              Cancel
            </Button>

            <Button
              type="button"
              leftIcon={
                ruleDialogMode === "edit" ? (
                  <FiSave />
                ) : (
                  <FiPlus />
                )
              }
              disabled={isSaving}
              onClick={
                handleSaveRuleForm
              }
            >
              {ruleDialogMode === "edit"
                ? "Apply Rule Changes"
                : "Add Rule"}
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          {ruleFormErrors.length > 0 && (
            <div
              role="alert"
              className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
            >
              <div className="flex items-start gap-3">
                <FiAlertTriangle
                  className="mt-0.5 shrink-0"
                  aria-hidden="true"
                />

                <ul className="list-disc space-y-1 pl-4 text-sm">
                  {ruleFormErrors.map(
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
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-gray-700 dark:text-gray-200">
                Category
              </span>

              <input
                type="text"
                value={ruleForm.category}
                placeholder="Example: Attendance Violations"
                onChange={(event) =>
                  handleRuleFieldChange(
                    "category",
                    event.target.value
                  )
                }
                className={INPUT_CLASS_NAME}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-gray-700 dark:text-gray-200">
                Section
              </span>

              <input
                type="text"
                value={ruleForm.section}
                placeholder="Example: Section 1.1"
                onChange={(event) =>
                  handleRuleFieldChange(
                    "section",
                    event.target.value
                  )
                }
                className={INPUT_CLASS_NAME}
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-gray-700 dark:text-gray-200">
              Violation Title
            </span>

            <input
              type="text"
              value={ruleForm.violation}
              placeholder="Enter violation title"
              onChange={(event) =>
                handleRuleFieldChange(
                  "violation",
                  event.target.value
                )
              }
              className={INPUT_CLASS_NAME}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-gray-700 dark:text-gray-200">
              Description
            </span>

            <textarea
              value={ruleForm.description}
              placeholder="Describe the violation and relevant policy conditions"
              onChange={(event) =>
                handleRuleFieldChange(
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
            <span className="mb-1.5 block text-sm font-bold text-gray-700 dark:text-gray-200">
              Penalty Level
            </span>

            <select
              value={ruleForm.penaltyLevel}
              onChange={(event) =>
                handleRuleFieldChange(
                  "penaltyLevel",
                  event.target.value
                )
              }
              className={INPUT_CLASS_NAME}
            >
              <option value="">
                Select penalty level
              </option>

              {PENALTY_LEVEL_OPTIONS.map(
                (penaltyLevel) => (
                  <option
                    key={penaltyLevel}
                    value={penaltyLevel}
                  >
                    {penaltyLevel}
                  </option>
                )
              )}
            </select>
          </label>

          <fieldset>
            <legend className="text-sm font-bold text-gray-700 dark:text-gray-200">
              Severity Mapping
            </legend>

            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Select one or more severity levels
              applicable to this rule.
            </p>

            <div className="mt-3 flex flex-wrap gap-3">
              {SEVERITY_OPTIONS.map(
                (severity) => {
                  const checked =
                    ruleForm.severity.includes(
                      severity
                    );

                  return (
                    <label
                      key={severity}
                      className={[
                        "inline-flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition",
                        checked
                          ? "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-300"
                          : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-white/10 dark:bg-slate-900 dark:text-gray-300 dark:hover:bg-slate-800",
                      ].join(" ")}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          handleToggleSeverity(
                            severity
                          )
                        }
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />

                      {severity}
                    </label>
                  );
                }
              )}
            </div>
          </fieldset>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200">
                  Penalties and Actions
                </h3>

                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Enter each offense level or
                  disciplinary action separately.
                </p>
              </div>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                leftIcon={<FiPlus />}
                onClick={handleAddPenalty}
              >
                Add Penalty
              </Button>
            </div>

            <div className="mt-3 space-y-3">
              {ruleForm.penalties.map(
                (penalty, index) => (
                  <div
                    key={`penalty-${index}`}
                    className="flex items-start gap-2"
                  >
                    <span className="mt-3 text-xs font-bold text-gray-400">
                      {index + 1}.
                    </span>

                    <input
                      type="text"
                      value={penalty}
                      placeholder={`Example: ${
                        index + 1
                      }st offense - Written warning`}
                      onChange={(event) =>
                        handlePenaltyChange(
                          index,
                          event.target.value
                        )
                      }
                      className={
                        INPUT_CLASS_NAME
                      }
                    />

                    <button
                      type="button"
                      title="Remove penalty"
                      aria-label={`Remove penalty ${
                        index + 1
                      }`}
                      onClick={() =>
                        handleRemovePenalty(
                          index
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
            </div>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={showReviewDialog}
        onClose={() => {
          if (!isSaving) {
            setShowReviewDialog(false);
          }
        }}
        title="Review Violation Policy Changes"
        description="Confirm that the updated violation categories, severity mappings, and penalties match the approved company policy."
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
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-gray-200 p-4 dark:border-white/10">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Categories
              </p>

              <p className="mt-2 text-2xl font-extrabold text-gray-900 dark:text-white">
                {draftRules.length}
              </p>
            </div>

            <div className="rounded-2xl border border-gray-200 p-4 dark:border-white/10">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Total Rules
              </p>

              <p className="mt-2 text-2xl font-extrabold text-gray-900 dark:text-white">
                {draftRules.reduce(
                  (total, group) =>
                    total +
                    group.rows.length,
                  0
                )}
              </p>
            </div>

            <div className="rounded-2xl border border-gray-200 p-4 dark:border-white/10">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Policy Status
              </p>

              <p className="mt-2 font-extrabold text-indigo-700 dark:text-indigo-300">
                Ready to Save
              </p>
            </div>
          </div>

          <div className="max-h-[420px] space-y-4 overflow-y-auto pr-1">
            {draftRules.map((group) => (
              <section
                key={group.category}
                className="overflow-hidden rounded-2xl border border-gray-200 dark:border-white/10"
              >
                <div className="bg-gray-100 px-4 py-3 font-extrabold text-gray-900 dark:bg-slate-800 dark:text-white">
                  {group.category}
                </div>

                <div className="divide-y divide-gray-200 dark:divide-white/10">
                  {group.rows.map((rule) => (
                    <div
                      key={rule.id}
                      className="p-4"
                    >
                      <p className="font-bold text-gray-900 dark:text-white">
                        {rule.section} —{" "}
                        {rule.violation}
                      </p>

                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {rule.penaltyLevel}
                      </p>

                      <div className="mt-2 flex flex-wrap gap-2">
                        {normalizeSeverity(
                          rule.severity
                        ).map((severity) => (
                          <span
                            key={severity}
                            className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-bold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300"
                          >
                            {severity}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
            <div className="flex items-start gap-3">
              <FiAlertTriangle
                className="mt-0.5 shrink-0"
                aria-hidden="true"
              />

              <p>
                Saving will replace the current
                browser-based violation policy.
                Future incident classification may
                use these updated rules once the
                configuration is connected to the
                incident workflow.
              </p>
            </div>
          </div>
        </div>
      </Dialog>

      <ConfirmDialog
        open={Boolean(pendingDeleteRule)}
        title="Remove Violation Rule?"
        tone="danger"
        confirmLabel="Remove Rule"
        cancelLabel="Keep Rule"
        loading={false}
        closeOnBackdrop={!isSaving}
        onClose={() =>
          setPendingDeleteRule(null)
        }
        onConfirm={
          handleConfirmDeleteRule
        }
      >
        <p>
          The rule{" "}
          <strong>
            {pendingDeleteRule?.violation}
          </strong>{" "}
          will be removed from{" "}
          <strong>
            {pendingDeleteRule?.category}
          </strong>
          .
        </p>

        <p className="mt-2">
          The removal will not become permanent
          until you review and save the policy.
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={showDiscardDialog}
        title="Discard Violation Policy Changes?"
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
          All unsaved rule additions, edits, and
          removals will be discarded.
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={showRestoreDialog}
        title="Restore Default Violation Rules?"
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
          The original Code of Conduct rules will
          be loaded into editing mode.
        </p>

        <p className="mt-2 font-semibold">
          You must still review and save before
          the defaults replace the current policy.
        </p>
      </ConfirmDialog>

      <SuccessToast
        title="Violation policy updated"
        message={successMessage}
        duration={4000}
        onClose={() =>
          setSuccessMessage("")
        }
      />
    </div>
  );
}