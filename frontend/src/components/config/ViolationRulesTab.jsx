import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

import { NORMALIZED_VIOLATION_RULES as DEFAULT_VIOLATION_RULES } from "../../data/violationRules";
import { API_BASE } from "../../config/api";
import authenticatedFetch from "../../utils/authenticatedFetch";

import ViolationTable from "./ViolationTable";
import Button from "../ui/Button";
import ConfirmDialog from "../ui/ConfirmDialog";
import Dialog from "../ui/Dialog";
import SuccessToast from "../ui/SuccessToast";

const VIOLATION_RULES_API_URL = `${API_BASE}/settings/violation-rules`;
const REQUEST_TIMEOUT_MS = 15000;

const SEVERITY_OPTIONS = ["Minor", "Major", "Critical"];

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

const EMPTY_METADATA = {
  updatedAt: null,
  updatedBy: null,
  updatedByRole: null,
};

const REVIEW_FIELDS = [
  ["category", "Category"],
  ["section", "Section"],
  ["violation", "Violation Title"],
  ["description", "Description"],
  ["penaltyLevel", "Penalty Level"],
  ["severity", "Severity"],
  ["penalties", "Penalties / Actions"],
];

const INPUT_CLASS_NAME = [
  "min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5",
  "text-sm text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400",
  "focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20",
  "disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500",
  "dark:border-slate-700 dark:bg-slate-900 dark:text-white",
  "dark:focus:border-indigo-400 dark:focus:ring-indigo-400/20",
  "dark:disabled:bg-slate-800 dark:disabled:text-gray-500",
].join(" ");

const TEXTAREA_CLASS_NAME = `${INPUT_CLASS_NAME} min-h-28 resize-y`;

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function createRuleId() {
  return `violation-rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeSeverity(value) {
  const items = Array.isArray(value) ? value : value ? [value] : [];
  const validSeverities = items
    .map((item) => String(item || "").trim())
    .filter((item) => SEVERITY_OPTIONS.includes(item));

  if (!validSeverities.length) return [];

  const highestSeverity = validSeverities.reduce((highest, current) =>
    SEVERITY_OPTIONS.indexOf(current) > SEVERITY_OPTIONS.indexOf(highest)
      ? current
      : highest
  );

  return [highestSeverity];
}

function formatPenaltyForStorage(penalty, index) {
  if (typeof penalty === "string") return penalty.trim();
  if (!penalty || typeof penalty !== "object") return "";

  const label = penalty.label || `Offense ${penalty.offenseNo || index + 1}`;
  const action = penalty.action || "No action";
  return `${label}: ${action}`;
}

function normalizeRules(groups) {
  if (!Array.isArray(groups)) return [];

  return groups
    .map((group, groupIndex) => ({
      category: String(group?.category || `Category ${groupIndex + 1}`).trim(),
      rows: Array.isArray(group?.rows)
        ? group.rows.map((item, rowIndex) => ({
            id: item?.id || `rule-${groupIndex + 1}-${rowIndex + 1}`,
            section: String(item?.section || "").trim(),
            violation: String(item?.violation || "").trim(),
            description: String(item?.description || "").trim(),
            penaltyLevel: String(item?.penaltyLevel || "").trim(),
            severity: normalizeSeverity(item?.severity),
            penalties: Array.isArray(item?.penalties)
              ? item.penalties
                  .map((penalty, penaltyIndex) =>
                    formatPenaltyForStorage(penalty, penaltyIndex)
                  )
                  .filter(Boolean)
              : [],
          }))
        : [],
    }))
    .filter((group) => group.category && group.rows.length > 0);
}

function getDefaultRules() {
  return normalizeRules(cloneValue(DEFAULT_VIOLATION_RULES));
}

function getDefaultConfiguration() {
  return {
    rules: getDefaultRules(),
    metadata: { ...EMPTY_METADATA },
    configured: false,
  };
}

function normalizeApiConfiguration(data) {
  const configured = data?.configured === true && Array.isArray(data?.rules);

  return {
    rules: configured ? normalizeRules(data.rules) : getDefaultRules(),
    metadata: {
      updatedAt: data?.metadata?.updatedAt || null,
      updatedBy: data?.metadata?.updatedBy || null,
      updatedByRole: data?.metadata?.updatedByRole || null,
    },
    configured,
  };
}

async function requestJson(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await authenticatedFetch(url, {
      ...options,
      signal: controller.signal,
      headers: { Accept: "application/json", ...(options.headers || {}) },
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(
        data?.message || data?.error || `Request failed with status ${response.status}`
      );
    }

    return data;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function getConfigurationErrorMessage(error, fallbackMessage) {
  if (error?.name === "AbortError") {
    return "The server took too long to respond. Check that the backend and database are running, then try again.";
  }
  return error?.message || fallbackMessage;
}

function stripHtml(value) {
  return String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function getPenaltySearchText(penalties) {
  return (penalties || [])
    .map((penalty, index) => formatPenaltyForStorage(penalty, index))
    .join(" ");
}

function getRuleLocation(groups, ruleId) {
  for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
    const rowIndex = groups[groupIndex].rows.findIndex((item) => item.id === ruleId);
    if (rowIndex !== -1) return { groupIndex, rowIndex };
  }
  return null;
}

function validateRuleInput(rule, prefix = "", includeCategory = true) {
  const errors = [];
  const add = (message) => errors.push(`${prefix}${message}`);

  if (includeCategory && !String(rule.category || "").trim()) add("Category is required.");
  if (!String(rule.section || "").trim()) add("Section is required.");
  if (!String(rule.violation || "").trim()) add("Violation title is required.");
  if (!String(rule.description || "").trim()) add("Violation description is required.");
  if (!String(rule.penaltyLevel || "").trim()) add("Penalty level is required.");
  if (normalizeSeverity(rule.severity).length !== 1) {
    add("Exactly one severity level is required.");
  }

  const hasPenalty = (rule.penalties || []).some((penalty, index) =>
    formatPenaltyForStorage(penalty, index)
  );
  if (!hasPenalty) add("At least one penalty or disciplinary action is required.");

  return errors;
}

function validateAllRules(groups) {
  if (!groups.length) return ["At least one violation category is required."];

  return groups.flatMap((group, groupIndex) => {
    const category = String(group.category || "").trim();
    const errors = [];

    if (!category) errors.push(`Category ${groupIndex + 1} must have a name.`);
    if (!group.rows.length) {
      errors.push(`${category || `Category ${groupIndex + 1}`} must contain at least one rule.`);
      return errors;
    }

    group.rows.forEach((rule, ruleIndex) => {
      errors.push(
        ...validateRuleInput(
          { ...rule, category },
          `${category || `Category ${groupIndex + 1}`}, Rule ${ruleIndex + 1}: `,
          false
        )
      );
    });

    return errors;
  });
}

function normalizeRuleForm(form) {
  return {
    category: form.category.trim(),
    section: form.section.trim(),
    violation: form.violation.trim(),
    description: form.description.trim(),
    penaltyLevel: form.penaltyLevel.trim(),
    severity: normalizeSeverity(form.severity),
    penalties: form.penalties.map((penalty) => penalty.trim()).filter(Boolean),
  };
}

function ruleToForm(group, rule) {
  return {
    category: group.category,
    section: rule.section,
    violation: rule.violation,
    description: rule.description,
    penaltyLevel: rule.penaltyLevel,
    severity: normalizeSeverity(rule.severity),
    penalties: rule.penalties.length ? cloneValue(rule.penalties) : [""],
  };
}

function flattenRules(groups) {
  return groups.flatMap((group) =>
    group.rows.map((rule) => ({ ...rule, category: group.category }))
  );
}

function comparableValue(field, value) {
  if (field === "severity") return normalizeSeverity(value);
  if (field === "penalties") {
    return (value || []).map((penalty, index) => formatPenaltyForStorage(penalty, index));
  }
  return String(value || "").trim();
}

function valuesMatch(field, before, after) {
  return JSON.stringify(comparableValue(field, before)) === JSON.stringify(comparableValue(field, after));
}

function buildPolicyChanges(savedRules, draftRules) {
  const beforeRules = flattenRules(savedRules);
  const afterRules = flattenRules(draftRules);
  const beforeById = new Map(beforeRules.map((rule) => [rule.id, rule]));
  const afterById = new Map(afterRules.map((rule) => [rule.id, rule]));
  const changes = [];

  afterRules.forEach((after) => {
    const before = beforeById.get(after.id);
    if (!before) {
      changes.push({ type: "added", id: after.id, after });
      return;
    }

    const fields = REVIEW_FIELDS
      .filter(([field]) => !valuesMatch(field, before[field], after[field]))
      .map(([field, label]) => ({
        field,
        label,
        before: before[field],
        after: after[field],
      }));

    if (fields.length) changes.push({ type: "modified", id: after.id, before, after, fields });
  });

  beforeRules.forEach((before) => {
    if (!afterById.has(before.id)) changes.push({ type: "removed", id: before.id, before });
  });

  return changes;
}

function formatReviewValue(field, value) {
  if (field === "description") return stripHtml(value) || "—";
  if (field === "severity") return normalizeSeverity(value).join(", ") || "—";
  if (field === "penalties") {
    return (value || [])
      .map((penalty, index) => formatPenaltyForStorage(penalty, index))
      .filter(Boolean)
      .join("\n") || "—";
  }
  return String(value || "").trim() || "—";
}

function formatDateTime(value) {
  if (!value) return "Not yet modified";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";

  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function ReviewValue({ field, value }) {
  return (
    <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-gray-700 dark:text-gray-300">
      {formatReviewValue(field, value)}
    </p>
  );
}

function ChangeCard({ change }) {
  const referenceRule = change.after || change.before;
  const badge =
    change.type === "added"
      ? "Added"
      : change.type === "removed"
        ? "Removed"
        : "Modified";

  const badgeClass =
    change.type === "added"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
      : change.type === "removed"
        ? "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"
        : "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300";

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 dark:border-white/10">
      <div className="flex flex-wrap items-start justify-between gap-3 bg-gray-50 px-4 py-3 dark:bg-slate-800/70">
        <div>
          <p className="font-extrabold text-gray-900 dark:text-white">
            {referenceRule.section} — {referenceRule.violation}
          </p>
          <p className="mt-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
            {referenceRule.category}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${badgeClass}`}>
          {badge}
        </span>
      </div>

      {change.type === "modified" ? (
        <div className="divide-y divide-gray-200 dark:divide-white/10">
          {change.fields.map((fieldChange) => (
            <div key={fieldChange.field} className="p-4">
              <p className="text-xs font-extrabold uppercase tracking-wide text-gray-500">
                {fieldChange.label}
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-red-200 bg-red-50/60 p-3 dark:border-red-500/20 dark:bg-red-500/10">
                  <p className="text-xs font-bold uppercase tracking-wide text-red-700 dark:text-red-300">
                    Before
                  </p>
                  <ReviewValue field={fieldChange.field} value={fieldChange.before} />
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-500/20 dark:bg-emerald-500/10">
                  <p className="text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                    After
                  </p>
                  <ReviewValue field={fieldChange.field} value={fieldChange.after} />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          {REVIEW_FIELDS.map(([field, label]) => (
            <div key={field} className="rounded-xl border border-gray-200 p-3 dark:border-white/10">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{label}</p>
              <ReviewValue field={field} value={referenceRule[field]} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function ViolationRulesTab({ canEdit = false }) {
  const isMountedRef = useRef(true);

  const [savedConfiguration, setSavedConfiguration] = useState(getDefaultConfiguration);
  const [draftRules, setDraftRules] = useState(() => cloneValue(getDefaultConfiguration().rules));
  const [isLoadingConfiguration, setIsLoadingConfiguration] = useState(true);
  const [configurationError, setConfigurationError] = useState("");
  const [query, setQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState("All");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [ruleDialogMode, setRuleDialogMode] = useState(null);
  const [ruleForm, setRuleForm] = useState(cloneValue(EMPTY_RULE_FORM));
  const [editingRuleId, setEditingRuleId] = useState(null);
  const [ruleFormErrors, setRuleFormErrors] = useState([]);
  const [validationErrors, setValidationErrors] = useState([]);
  const [pendingDeleteRule, setPendingDeleteRule] = useState(null);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const loadConfiguration = useCallback(async ({ showLoading = true, showError = true } = {}) => {
    if (showLoading) setIsLoadingConfiguration(true);
    if (showError) setConfigurationError("");

    try {
      const data = await requestJson(VIOLATION_RULES_API_URL);
      if (!isMountedRef.current) return false;

      const nextConfiguration = normalizeApiConfiguration(data);
      setSavedConfiguration(cloneValue(nextConfiguration));
      setDraftRules(cloneValue(nextConfiguration.rules));
      return true;
    } catch (error) {
      console.error("Unable to load violation rules configuration:", error);
      if (showError && isMountedRef.current) {
        setConfigurationError(
          getConfigurationErrorMessage(
            error,
            "Unable to load the system-wide violation rules configuration."
          )
        );
      }
      return false;
    } finally {
      if (showLoading && isMountedRef.current) setIsLoadingConfiguration(false);
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    loadConfiguration();
    return () => {
      isMountedRef.current = false;
    };
  }, [loadConfiguration]);

  useEffect(() => {
    if (!canEdit && isEditing) {
      setIsEditing(false);
      setRuleDialogMode(null);
      setDraftRules(cloneValue(savedConfiguration.rules));
      setValidationErrors([]);
      setRuleFormErrors([]);
    }
  }, [canEdit, isEditing, savedConfiguration.rules]);

  const activeRules = isEditing ? draftRules : savedConfiguration.rules;
  const policyChanges = useMemo(
    () => buildPolicyChanges(savedConfiguration.rules, draftRules),
    [draftRules, savedConfiguration.rules]
  );
  const hasUnsavedChanges = policyChanges.length > 0;

  const changeCounts = useMemo(
    () =>
      policyChanges.reduce(
        (counts, change) => ({ ...counts, [change.type]: counts[change.type] + 1 }),
        { added: 0, modified: 0, removed: 0 }
      ),
    [policyChanges]
  );

  const totalRules = useMemo(
    () => activeRules.reduce((total, group) => total + group.rows.length, 0),
    [activeRules]
  );

  const filteredRules = useMemo(() => {
    const search = query.trim().toLowerCase();

    return activeRules
      .map((group) => ({
        ...group,
        rows: group.rows.filter((item) => {
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

          const matchesSearch = !search || searchableText.includes(search);
          const matchesSeverity =
            severityFilter === "All" || normalizeSeverity(item.severity).includes(severityFilter);
          return matchesSearch && matchesSeverity;
        }),
      }))
      .filter((group) => group.rows.length > 0);
  }, [activeRules, query, severityFilter]);

  const handleStartEditing = useCallback(() => {
    if (!canEdit || isLoadingConfiguration || configurationError) return;
    setDraftRules(cloneValue(savedConfiguration.rules));
    setValidationErrors([]);
    setIsEditing(true);
  }, [canEdit, configurationError, isLoadingConfiguration, savedConfiguration.rules]);

  const handleRequestCancel = useCallback(() => {
    if (!isEditing || isSaving) return;
    if (hasUnsavedChanges) {
      setShowDiscardDialog(true);
      return;
    }
    setIsEditing(false);
    setValidationErrors([]);
  }, [hasUnsavedChanges, isEditing, isSaving]);

  const handleDiscardChanges = useCallback(() => {
    if (isSaving) return;
    setDraftRules(cloneValue(savedConfiguration.rules));
    setValidationErrors([]);
    setRuleFormErrors([]);
    setRuleDialogMode(null);
    setShowReviewDialog(false);
    setShowDiscardDialog(false);
    setIsEditing(false);
  }, [isSaving, savedConfiguration.rules]);

  const handleOpenAddDialog = useCallback(() => {
    if (!canEdit || !isEditing) return;
    setEditingRuleId(null);
    setRuleForm(cloneValue(EMPTY_RULE_FORM));
    setRuleFormErrors([]);
    setRuleDialogMode("add");
  }, [canEdit, isEditing]);

  const handleOpenEditDialog = useCallback(
    (ruleId) => {
      if (!canEdit || !isEditing) return;
      const location = getRuleLocation(draftRules, ruleId);
      if (!location) return;

      const group = draftRules[location.groupIndex];
      const rule = group.rows[location.rowIndex];
      setEditingRuleId(ruleId);
      setRuleForm(ruleToForm(group, rule));
      setRuleFormErrors([]);
      setRuleDialogMode("edit");
    },
    [canEdit, draftRules, isEditing]
  );

  const handleCloseRuleDialog = useCallback(() => {
    if (isSaving) return;
    setRuleDialogMode(null);
    setEditingRuleId(null);
    setRuleFormErrors([]);
    setRuleForm(cloneValue(EMPTY_RULE_FORM));
  }, [isSaving]);

  const handleRuleFieldChange = useCallback((field, value) => {
    setRuleForm((currentForm) => ({ ...currentForm, [field]: value }));
    setRuleFormErrors([]);
  }, []);

  const handleSelectSeverity = useCallback((severity) => {
    setRuleForm((currentForm) => ({
      ...currentForm,
      severity: [severity],
    }));
    setRuleFormErrors([]);
  }, []);

  const handlePenaltyChange = useCallback((index, value) => {
    setRuleForm((currentForm) => {
      const penalties = [...currentForm.penalties];
      penalties[index] = value;
      return { ...currentForm, penalties };
    });
    setRuleFormErrors([]);
  }, []);

  const handleAddPenalty = useCallback(() => {
    setRuleForm((currentForm) => ({
      ...currentForm,
      penalties: [...currentForm.penalties, ""],
    }));
  }, []);

  const handleRemovePenalty = useCallback((index) => {
    setRuleForm((currentForm) => {
      const penalties = currentForm.penalties.filter((_, penaltyIndex) => penaltyIndex !== index);
      return { ...currentForm, penalties: penalties.length ? penalties : [""] };
    });
    setRuleFormErrors([]);
  }, []);

  const handleSaveRuleForm = useCallback(() => {
    if (!canEdit || !isEditing) return;

    const errors = validateRuleInput(ruleForm);
    setRuleFormErrors(errors);
    if (errors.length) return;

    const normalizedForm = normalizeRuleForm(ruleForm);

    setDraftRules((currentRules) => {
      const nextRules = cloneValue(currentRules);

      if (ruleDialogMode === "edit") {
        const location = getRuleLocation(nextRules, editingRuleId);
        if (!location) return currentRules;

        const sourceGroup = nextRules[location.groupIndex];
        const currentRule = sourceGroup.rows[location.rowIndex];
        const updatedRule = { ...currentRule, ...normalizedForm };
        delete updatedRule.category;

        const sameCategory =
          sourceGroup.category.toLowerCase() === normalizedForm.category.toLowerCase();

        if (sameCategory) {
          // Preserve the rule's exact table position when its category did not change.
          sourceGroup.rows[location.rowIndex] = updatedRule;
          return nextRules;
        }

        sourceGroup.rows.splice(location.rowIndex, 1);
        let targetGroup = nextRules.find(
          (group) => group.category.toLowerCase() === normalizedForm.category.toLowerCase()
        );

        if (!targetGroup) {
          targetGroup = { category: normalizedForm.category, rows: [] };
          nextRules.push(targetGroup);
        }
        targetGroup.rows.push(updatedRule);

        if (!sourceGroup.rows.length) nextRules.splice(location.groupIndex, 1);
        return nextRules;
      }

      const newRule = {
        id: createRuleId(),
        section: normalizedForm.section,
        violation: normalizedForm.violation,
        description: normalizedForm.description,
        penaltyLevel: normalizedForm.penaltyLevel,
        severity: normalizedForm.severity,
        penalties: normalizedForm.penalties,
      };

      let targetGroup = nextRules.find(
        (group) => group.category.toLowerCase() === normalizedForm.category.toLowerCase()
      );
      if (!targetGroup) {
        targetGroup = { category: normalizedForm.category, rows: [] };
        nextRules.push(targetGroup);
      }
      targetGroup.rows.push(newRule);
      return nextRules;
    });

    handleCloseRuleDialog();
  }, [canEdit, editingRuleId, handleCloseRuleDialog, isEditing, ruleDialogMode, ruleForm]);

  const handleRequestDeleteRule = useCallback(
    (ruleId) => {
      if (!canEdit || !isEditing) return;
      const location = getRuleLocation(draftRules, ruleId);
      if (!location) return;

      const group = draftRules[location.groupIndex];
      const rule = group.rows[location.rowIndex];
      setPendingDeleteRule({ id: ruleId, category: group.category, violation: rule.violation });
    },
    [canEdit, draftRules, isEditing]
  );

  const handleConfirmDeleteRule = useCallback(() => {
    if (!pendingDeleteRule || isSaving) return;
    setDraftRules((currentRules) =>
      currentRules
        .map((group) => ({
          ...group,
          rows: group.rows.filter((item) => item.id !== pendingDeleteRule.id),
        }))
        .filter((group) => group.rows.length > 0)
    );
    setPendingDeleteRule(null);
    setValidationErrors([]);
  }, [isSaving, pendingDeleteRule]);

  const handleReviewChanges = useCallback(() => {
    if (!canEdit || !isEditing || !hasUnsavedChanges) return;
    const errors = validateAllRules(draftRules);
    setValidationErrors(errors);

    if (errors.length) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setShowReviewDialog(true);
  }, [canEdit, draftRules, hasUnsavedChanges, isEditing]);

  const handleConfirmSave = useCallback(async () => {
    if (!canEdit || !isEditing || isSaving || isLoadingConfiguration || configurationError) return;

    const errors = validateAllRules(draftRules);
    if (errors.length) {
      setValidationErrors(errors);
      setShowReviewDialog(false);
      return;
    }

    try {
      setIsSaving(true);
      setConfigurationError("");

      const data = await requestJson(VIOLATION_RULES_API_URL, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules: normalizeRules(draftRules) }),
      });

      if (data?.success !== true || data?.configured !== true || !Array.isArray(data?.rules)) {
        throw new Error("The server did not return a valid saved violation rules configuration.");
      }

      const nextConfiguration = normalizeApiConfiguration(data);
      if (!nextConfiguration.configured || !nextConfiguration.rules.length) {
        throw new Error("The saved violation rules configuration could not be verified.");
      }

      setSavedConfiguration(cloneValue(nextConfiguration));
      setDraftRules(cloneValue(nextConfiguration.rules));
      setValidationErrors([]);
      setShowReviewDialog(false);
      setIsEditing(false);
      setSuccessMessage(data?.message || "Violation rules were updated successfully.");

      window.dispatchEvent(
        new CustomEvent("dataUpdated", {
          detail: {
            source: "violation-rules-configuration",
            domain: "system-configuration",
            action: "UPDATE_VIOLATION_RULES",
            at: Date.now(),
          },
        })
      );
    } catch (error) {
      console.error("Unable to save violation rules:", error);
      setValidationErrors([
        getConfigurationErrorMessage(
          error,
          "The system-wide violation rules could not be saved. Please try again."
        ),
      ]);
      setShowReviewDialog(false);
    } finally {
      setIsSaving(false);
    }
  }, [canEdit, configurationError, draftRules, isEditing, isLoadingConfiguration, isSaving]);

  const handleRestoreDefaults = useCallback(() => {
    if (!canEdit || isSaving || isLoadingConfiguration || configurationError) return;
    setDraftRules(getDefaultRules());
    setValidationErrors([]);
    setShowRestoreDialog(false);
    setIsEditing(true);
  }, [canEdit, configurationError, isLoadingConfiguration, isSaving]);

  return (
    <div className="space-y-6">
      {configurationError && (
        <section
          role="alert"
          className="rounded-3xl border border-red-200 bg-red-50 p-5 text-red-800 shadow-sm dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
        >
          <div className="flex items-start gap-3">
            <FiAlertTriangle className="mt-0.5 shrink-0" size={20} aria-hidden="true" />
            <div className="min-w-0">
              <h3 className="font-extrabold">Unable to load system policy</h3>
              <p className="mt-1 text-sm leading-6">{configurationError}</p>
              <div className="mt-3">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={isLoadingConfiguration}
                  onClick={() => loadConfiguration()}
                >
                  Retry
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}

      {isLoadingConfiguration && (
        <section
          role="status"
          className="rounded-3xl border border-indigo-200 bg-indigo-50 p-5 text-sm font-semibold text-indigo-800 shadow-sm dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300"
        >
          Loading the system-wide violation rules configuration...
        </section>
      )}

      {validationErrors.length > 0 && (
        <section
          role="alert"
          className="rounded-3xl border border-red-200 bg-red-50 p-5 text-red-800 shadow-sm dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
        >
          <div className="flex items-start gap-3">
            <FiAlertTriangle className="mt-0.5 shrink-0" size={20} aria-hidden="true" />
            <div>
              <h3 className="font-extrabold">Policy validation failed</h3>
              <p className="mt-1 text-sm">Correct the following items before saving:</p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
                {validationErrors.map((error, index) => (
                  <li key={`${error}-${index}`}>{error}</li>
                ))}
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
                <FiBookOpen size={22} aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-white">Code of Conduct Violation Rules</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-indigo-100">
                  Configure violation categories, disciplinary penalties, penalty levels, and severity mappings used by incident classification and HR decision support.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white ring-1 ring-white/20">
                    {totalRules} policy rule(s)
                  </span>
                  <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white ring-1 ring-white/20">
                    {savedConfiguration.configured ? "System-wide policy" : "Default policy"}
                  </span>
                  <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white ring-1 ring-white/20">
                    {isEditing ? "Editing mode" : canEdit ? "Editable policy" : "View-only policy"}
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
                    disabled={isLoadingConfiguration || Boolean(configurationError)}
                    onClick={() => setShowRestoreDialog(true)}
                  >
                    Restore Defaults
                  </Button>
                  <Button
                    type="button"
                    leftIcon={<FiEdit3 />}
                    disabled={isLoadingConfiguration || Boolean(configurationError)}
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
                    onClick={handleRequestCancel}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    leftIcon={<FiPlus />}
                    disabled={isSaving}
                    onClick={handleOpenAddDialog}
                  >
                    Add Rule
                  </Button>
                  <Button
                    type="button"
                    variant="success"
                    leftIcon={<FiSave />}
                    disabled={isSaving || !hasUnsavedChanges}
                    onClick={handleReviewChanges}
                  >
                    Review Changes{hasUnsavedChanges ? ` (${policyChanges.length})` : ""}
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
                <FiEdit3 className="mt-0.5 shrink-0" aria-hidden="true" />
              ) : (
                <FiInfo className="mt-0.5 shrink-0" aria-hidden="true" />
              )}
              <p className="leading-6">
                {isEditing
                  ? "Editing is enabled. Update, add, or remove rules, then review only the actual changes before saving."
                  : canEdit
                    ? savedConfiguration.configured
                      ? "This system-wide policy is protected by default. Select Edit Policy to make authorized changes."
                      : "The server has no saved custom violation policy yet, so the approved default Code of Conduct is being shown. Select Edit Policy to create the first system-wide configuration."
                    : savedConfiguration.configured
                      ? "Violation rules are available for reference only. Your assigned role cannot modify company policy."
                      : "The server has no saved custom violation policy yet, so the approved default Code of Conduct is being shown in view-only mode."}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400">
            <FiShield aria-hidden="true" />
            <span>
              Last updated: {formatDateTime(savedConfiguration.metadata?.updatedAt)}
              {savedConfiguration.metadata?.updatedBy
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
            <label htmlFor="violation-policy-search" className="sr-only">
              Search violation rules
            </label>
            <input
              id="violation-policy-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search section, violation, penalty, or category..."
              className={`${INPUT_CLASS_NAME} pl-11`}
            />
          </div>

          <div>
            <label htmlFor="violation-severity-filter" className="sr-only">
              Filter by severity
            </label>
            <select
              id="violation-severity-filter"
              value={severityFilter}
              onChange={(event) => setSeverityFilter(event.target.value)}
              className={INPUT_CLASS_NAME}
            >
              <option value="All">All Severity</option>
              {SEVERITY_OPTIONS.map((severity) => (
                <option key={severity} value={severity}>
                  {severity}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <ViolationTable
        rules={filteredRules}
        canEdit={canEdit && isEditing}
        onEdit={handleOpenEditDialog}
        onDelete={handleRequestDeleteRule}
      />

      <Dialog
        open={Boolean(ruleDialogMode)}
        onClose={handleCloseRuleDialog}
        title={ruleDialogMode === "edit" ? "Edit Violation Rule" : "Add Violation Rule"}
        description="Define the policy classification, severity, and disciplinary actions for this violation."
        size="xl"
        preventClose={isSaving}
        closeOnOverlay={!isSaving}
        closeOnEscape={!isSaving}
        footer={
          <>
            <Button type="button" variant="secondary" disabled={isSaving} onClick={handleCloseRuleDialog}>
              Cancel
            </Button>
            <Button
              type="button"
              leftIcon={ruleDialogMode === "edit" ? <FiSave /> : <FiPlus />}
              disabled={isSaving}
              onClick={handleSaveRuleForm}
            >
              {ruleDialogMode === "edit" ? "Apply Rule Changes" : "Add Rule"}
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
                <FiAlertTriangle className="mt-0.5 shrink-0" aria-hidden="true" />
                <ul className="list-disc space-y-1 pl-4 text-sm">
                  {ruleFormErrors.map((error, index) => (
                    <li key={`${error}-${index}`}>{error}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-gray-700 dark:text-gray-200">Category</span>
              <input
                type="text"
                value={ruleForm.category}
                placeholder="Example: Attendance Violations"
                onChange={(event) => handleRuleFieldChange("category", event.target.value)}
                className={INPUT_CLASS_NAME}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-bold text-gray-700 dark:text-gray-200">Section</span>
              <input
                type="text"
                value={ruleForm.section}
                placeholder="Example: Section 1.1"
                onChange={(event) => handleRuleFieldChange("section", event.target.value)}
                className={INPUT_CLASS_NAME}
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-gray-700 dark:text-gray-200">Violation Title</span>
            <input
              type="text"
              value={ruleForm.violation}
              placeholder="Enter violation title"
              onChange={(event) => handleRuleFieldChange("violation", event.target.value)}
              className={INPUT_CLASS_NAME}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-gray-700 dark:text-gray-200">Description</span>
            <textarea
              value={ruleForm.description}
              placeholder="Describe the violation and relevant policy conditions"
              onChange={(event) => handleRuleFieldChange("description", event.target.value)}
              className={TEXTAREA_CLASS_NAME}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-gray-700 dark:text-gray-200">Penalty Level</span>
            <select
              value={ruleForm.penaltyLevel}
              onChange={(event) => handleRuleFieldChange("penaltyLevel", event.target.value)}
              className={INPUT_CLASS_NAME}
            >
              <option value="">Select penalty level</option>
              {PENALTY_LEVEL_OPTIONS.map((penaltyLevel) => (
                <option key={penaltyLevel} value={penaltyLevel}>
                  {penaltyLevel}
                </option>
              ))}
            </select>
          </label>

          <fieldset>
            <legend className="text-sm font-bold text-gray-700 dark:text-gray-200">Severity</legend>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Select exactly one base severity for this violation rule.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              {SEVERITY_OPTIONS.map((severity) => {
                const checked = ruleForm.severity[0] === severity;
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
                      type="radio"
                      name="violation-rule-severity"
                      value={severity}
                      checked={checked}
                      onChange={() => handleSelectSeverity(severity)}
                      className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    {severity}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200">Penalties and Actions</h3>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Enter each offense level or disciplinary action separately.
                </p>
              </div>
              <Button type="button" variant="secondary" size="sm" leftIcon={<FiPlus />} onClick={handleAddPenalty}>
                Add Penalty
              </Button>
            </div>

            <div className="mt-3 space-y-3">
              {ruleForm.penalties.map((penalty, index) => (
                <div key={`penalty-${index}`} className="flex items-start gap-2">
                  <span className="mt-3 text-xs font-bold text-gray-400">{index + 1}.</span>
                  <input
                    type="text"
                    value={penalty}
                    placeholder={`Example: ${index + 1}st offense - Written warning`}
                    onChange={(event) => handlePenaltyChange(index, event.target.value)}
                    className={INPUT_CLASS_NAME}
                  />
                  <button
                    type="button"
                    title="Remove penalty"
                    aria-label={`Remove penalty ${index + 1}`}
                    onClick={() => handleRemovePenalty(index)}
                    className="mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-red-600 transition hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:text-red-300 dark:hover:bg-red-500/10"
                  >
                    <FiTrash2 aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={showReviewDialog}
        onClose={() => !isSaving && setShowReviewDialog(false)}
        title="Review Violation Policy Changes"
        description="Review only the rules and fields that changed before applying the system-wide policy update."
        size="xl"
        preventClose={isSaving}
        closeOnOverlay={!isSaving}
        closeOnEscape={!isSaving}
        footer={
          <>
            <Button type="button" variant="secondary" disabled={isSaving} onClick={() => setShowReviewDialog(false)}>
              Back to Edit
            </Button>
            <Button
              type="button"
              variant="success"
              leftIcon={<FiSave />}
              loading={isSaving}
              disabled={isSaving || !policyChanges.length}
              onClick={handleConfirmSave}
            >
              Confirm and Save
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["Modified", changeCounts.modified],
              ["Added", changeCounts.added],
              ["Removed", changeCounts.removed],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-gray-200 p-4 dark:border-white/10">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
                <p className="mt-2 text-2xl font-extrabold text-gray-900 dark:text-white">{value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-800 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300">
            {policyChanges.length} pending policy change{policyChanges.length === 1 ? "" : "s"}. Unchanged rules are hidden to keep this review focused.
          </div>

          <div className="max-h-[520px] space-y-4 overflow-y-auto pr-1">
            {policyChanges.map((change) => (
              <ChangeCard key={`${change.type}-${change.id}`} change={change} />
            ))}
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
            <div className="flex items-start gap-3">
              <FiAlertTriangle className="mt-0.5 shrink-0" aria-hidden="true" />
              <p>
                Saving will replace the current system-wide violation policy stored on the server. Existing incident records will not be retroactively changed.
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
        onClose={() => setPendingDeleteRule(null)}
        onConfirm={handleConfirmDeleteRule}
      >
        <p>
          The rule <strong>{pendingDeleteRule?.violation}</strong> will be removed from{" "}
          <strong>{pendingDeleteRule?.category}</strong>.
        </p>
        <p className="mt-2">The removal will not become permanent until you review and save the policy.</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={showDiscardDialog}
        title="Discard Violation Policy Changes?"
        tone="warning"
        confirmLabel="Discard Changes"
        cancelLabel="Continue Editing"
        loading={false}
        closeOnBackdrop={!isSaving}
        onClose={() => setShowDiscardDialog(false)}
        onConfirm={handleDiscardChanges}
      >
        <p>All unsaved rule additions, edits, and removals will be discarded.</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={showRestoreDialog}
        title="Restore Default Violation Rules?"
        tone="warning"
        confirmLabel="Load Defaults"
        cancelLabel="Cancel"
        loading={false}
        closeOnBackdrop={!isSaving}
        onClose={() => setShowRestoreDialog(false)}
        onConfirm={handleRestoreDefaults}
      >
        <p>The original Code of Conduct rules will be loaded into editing mode.</p>
        <p className="mt-2 font-semibold">
          You must still review and save before the defaults replace the current policy.
        </p>
      </ConfirmDialog>

      <SuccessToast
        title="Violation policy updated"
        message={successMessage}
        duration={4000}
        onClose={() => setSuccessMessage("")}
      />
    </div>
  );
}