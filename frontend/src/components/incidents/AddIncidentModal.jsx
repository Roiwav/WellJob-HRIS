import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FiAlertTriangle,
  FiBriefcase,
  FiCalendar,
  FiCheckCircle,
  FiChevronLeft,
  FiFileText,
  FiHash,
  FiSearch,
  FiShield,
  FiUser,
  FiX,
} from "react-icons/fi";
import {
  computeAutoSeverity,
  enrichIncidentIntelligence,
  flattenViolationRules,
  getNextOffenseCount,
  getPenaltyByOffense,
  getPenaltyText,
} from "../../utils/incidentIntelligence";

const severityStyle = {
  Minor: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Major: "bg-amber-100 text-amber-700 border-amber-200",
  Critical: "bg-red-100 text-red-700 border-red-200",
};

const penaltyLevelStyle = {
  Warning: "bg-sky-100 text-sky-700 border-sky-200",
  "Warning / 1–7 Days Suspension": "bg-cyan-100 text-cyan-700 border-cyan-200",
  "1–7 Days Suspension": "bg-cyan-100 text-cyan-700 border-cyan-200",
  "15–30 Days Suspension": "bg-orange-100 text-orange-700 border-orange-200",
  "30 Days Suspension": "bg-orange-100 text-orange-700 border-orange-200",
  "Dismissal / RTA": "bg-red-100 text-red-700 border-red-200",
};

function generateIncidentId(existingIncidents = []) {
  const maxNumber = existingIncidents.reduce((max, item) => {
    const match = String(item.id || "").match(/INC-(\d+)/);
    const num = match ? Number(match[1]) : 0;
    return num > max ? num : max;
  }, 1000);

  return `INC-${maxNumber + 1}`;
}

function getDateOnly(isoDate) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().split("T")[0];
  }

  return date.toISOString().split("T")[0];
}

function formatDateTime(isoDate) {
  if (!isoDate) return "-";

  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getOrdinalSuffix(number) {
  if (number === 1) return "st";
  if (number === 2) return "nd";
  if (number === 3) return "rd";
  return "th";
}

export default function AddIncidentModal({
  isOpen,
  onClose,
  onSave,
  employees = [],
  deployments = [],
  existingIncidents = [],
}) {
  const modalRef = useRef(null);
  const violationBoxRef = useRef(null);
  const employeeBoxRef = useRef(null);

  const violationOptions = useMemo(() => flattenViolationRules(), []);

  const employeeOptions = useMemo(() => {
    return employees
      .filter((emp) => {
        const status = String(emp.status || "").trim().toLowerCase();

        return status === "deployed" || status === "active deployed";
      })
      .map((emp) => ({
        id: emp.id || emp.employeeId || emp.employee_id || emp.name,
        name: emp.name || emp.full_name || "",
        company: emp.company || "",
      }));
  }, [employees]);

  const createInitialFormData = useCallback(() => {
    const now = new Date().toISOString();

    return {
      id: generateIncidentId(existingIncidents),
      employeeId: "",
      employee: "",
      company: "",
      violation: "",
      violationCategory: "",
      violationSection: "",
      violationDescription: "",
      penaltyLevel: "",
      penalties: [],
      offenseCount: 1,
      selectedPenalty: null,
      severity: "",
      sanction: "",
      status: "Open",
      date: getDateOnly(now),
      reportedAt: now,
      description: "",
      actions: [],
      reviewComments: [],
      timeline: [],
    };
  }, [existingIncidents]);

  const [formData, setFormData] = useState(() => createInitialFormData());
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [violationSearch, setViolationSearch] = useState("");
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const [showViolationDropdown, setShowViolationDropdown] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);

  const [customAlert, setCustomAlert] = useState({
    show: false,
    type: "error",
    title: "",
    message: "",
  });

  const showCustomAlert = ({ type = "error", title, message }) => {
    setCustomAlert({
      show: true,
      type,
      title,
      message,
    });
  };

  const closeCustomAlert = () => {
    setCustomAlert((prev) => ({
      ...prev,
      show: false,
    }));
  };

  useEffect(() => {
    if (!isOpen) return;

    const timeoutId = window.setTimeout(() => {
      setFormData(createInitialFormData());
      setEmployeeSearch("");
      setViolationSearch("");
      setShowEmployeeDropdown(false);
      setShowViolationDropdown(false);
      setIsReviewing(false);
      closeCustomAlert();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [isOpen, createInitialFormData]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        employeeBoxRef.current &&
        !employeeBoxRef.current.contains(event.target)
      ) {
        setShowEmployeeDropdown(false);
      }

      if (
        violationBoxRef.current &&
        !violationBoxRef.current.contains(event.target)
      ) {
        setShowViolationDropdown(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const filteredEmployees = useMemo(() => {
    const keyword = employeeSearch.trim().toLowerCase();
    if (!keyword) return [];

    return employeeOptions
      .filter((emp) =>
        [emp.name, emp.id, emp.company]
          .join(" ")
          .toLowerCase()
          .includes(keyword)
      )
      .slice(0, 8);
  }, [employeeOptions, employeeSearch]);

  const filteredViolations = useMemo(() => {
    const keyword = violationSearch.trim().toLowerCase();
    if (!keyword) return violationOptions.slice(0, 12);

    return violationOptions
      .filter((item) =>
        [
          item.category,
          item.section,
          item.violation,
          item.description,
          item.penaltyLevel,
          item.severity,
          ...(item.penalties || []).map((penalty) =>
            typeof penalty === "string"
              ? penalty
              : `${penalty.label || ""} ${penalty.action || ""}`
          ),
        ]
          .join(" ")
          .replace(/<[^>]*>/g, "")
          .toLowerCase()
          .includes(keyword)
      )
      .slice(0, 12);
  }, [violationOptions, violationSearch]);

  const computePenaltyData = useCallback(
    ({ employeeId, violation, penalties, description }) => {
      if (!violation) {
        return {
          offenseCount: 1,
          selectedPenalty: null,
          sanction: "",
          severity: "",
        };
      }

      const offenseCount = getNextOffenseCount(
        existingIncidents,
        employeeId,
        violation
      );

      const selectedPenalty = getPenaltyByOffense(penalties, offenseCount);
      const sanction = getPenaltyText(selectedPenalty);

      const selectedRule = violationOptions.find(
        (rule) => rule.violation === violation
      );

      const severity = computeAutoSeverity({
        baseSeverity: selectedRule?.severity || "Minor",
        offenseCount,
        sanction,
        description,
      });

      return {
        offenseCount,
        selectedPenalty,
        sanction,
        severity,
      };
    },
    [existingIncidents, violationOptions]
  );

  const handleSelectEmployee = (selectedEmployee) => {
    const activeDeployment = deployments.find((dep) => {
      const sameId =
        String(dep.employeeId || dep.id || "").trim() ===
        String(selectedEmployee.id || "").trim();

      const sameName =
        String(dep.employee || "").trim().toLowerCase() ===
        String(selectedEmployee.name || "").trim().toLowerCase();

      const status = String(dep.status || dep.deploymentStatus || "Active")
        .trim()
        .toLowerCase();

      return (
        (sameId || sameName) &&
        ["active", "deployed", "ongoing"].includes(status)
      );
    });

    setFormData((prev) => ({
      ...prev,
      employeeId: selectedEmployee.id,
      employee: selectedEmployee.name,
      company:
        activeDeployment?.company ||
        activeDeployment?.clientCompany ||
        selectedEmployee.company ||
        "",
      offenseCount: 1,
      selectedPenalty: null,
      sanction: "",
      severity: "",
    }));

    setEmployeeSearch(`${selectedEmployee.name} (${selectedEmployee.id})`);
    setShowEmployeeDropdown(false);
    setIsReviewing(false);
  };

  const handleEmployeeInputChange = (event) => {
    const value = event.target.value;

    setEmployeeSearch(value);
    setShowEmployeeDropdown(true);
    setIsReviewing(false);

    setFormData((prev) => ({
      ...prev,
      employeeId: "",
      employee: "",
      company: "",
      offenseCount: 1,
      selectedPenalty: null,
      sanction: "",
      severity: "",
    }));
  };

  const handleSelectViolation = (selectedRule) => {
    setFormData((prev) => {
      const penalties = selectedRule.penalties || [];

      const penaltyData = computePenaltyData({
        employeeId: prev.employeeId,
        violation: selectedRule.violation,
        penalties,
        description: prev.description,
      });

      return {
        ...prev,
        violation: selectedRule.violation,
        violationCategory: selectedRule.category,
        violationSection: selectedRule.section,
        violationDescription: selectedRule.description || "",
        penaltyLevel: selectedRule.penaltyLevel || "",
        penalties,
        ...penaltyData,
      };
    });

    setViolationSearch(`${selectedRule.section} — ${selectedRule.violation}`);
    setShowViolationDropdown(false);
    setIsReviewing(false);
  };

  const handleViolationInputChange = (event) => {
    const value = event.target.value;

    setViolationSearch(value);
    setShowViolationDropdown(true);
    setIsReviewing(false);

    setFormData((prev) => ({
      ...prev,
      violation: "",
      violationCategory: "",
      violationSection: "",
      violationDescription: "",
      penaltyLevel: "",
      penalties: [],
      offenseCount: 1,
      selectedPenalty: null,
      severity: "",
      sanction: "",
    }));
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setIsReviewing(false);

    setFormData((prev) => {
      const updated = { ...prev, [name]: value };

      if (name === "description" && updated.violation) {
        const penaltyData = computePenaltyData({
          employeeId: updated.employeeId,
          violation: updated.violation,
          penalties: updated.penalties,
          description: value,
        });

        return {
          ...updated,
          ...penaltyData,
        };
      }

      return updated;
    });
  };

  const validateForm = () => {
    if (!formData.employeeId || !formData.employee) {
      showCustomAlert({
        type: "error",
        title: "Employee Required",
        message: "Please select an employee from the suggested list.",
      });
      return false;
    }

    if (!formData.violation) {
      showCustomAlert({
        type: "error",
        title: "Violation Required",
        message: "Please select a violation type from the suggested list.",
      });
      return false;
    }

    if (!formData.description.trim()) {
      showCustomAlert({
        type: "error",
        title: "Incident Description Required",
        message: "Please enter the incident description before reviewing.",
      });
      return false;
    }

    return true;
  };

  const handleReview = (event) => {
    event.preventDefault();

    if (!validateForm()) return;

    const penaltyData = computePenaltyData({
      employeeId: formData.employeeId,
      violation: formData.violation,
      penalties: formData.penalties,
      description: formData.description,
    });

    setFormData((prev) => ({
      ...prev,
      ...penaltyData,
    }));

    setIsReviewing(true);

    showCustomAlert({
      type: "success",
      title: "Report Ready for Review",
      message:
        "Incident details have been validated. Please review the report before final saving.",
    });
  };

  const handleFinalSave = () => {
    if (!validateForm()) return;

    const activeDeployment = deployments.find((dep) => {
      const sameId =
        String(dep.employeeId || dep.id || "").trim() ===
        String(formData.employeeId || "").trim();

      const sameName =
        String(dep.employee || "").trim().toLowerCase() ===
        String(formData.employee || "").trim().toLowerCase();

      const status = String(dep.status || dep.deploymentStatus || "Active")
        .trim()
        .toLowerCase();

      return (
        (sameId || sameName) &&
        ["active", "deployed", "ongoing"].includes(status)
      );
    });

    if (!activeDeployment) {
      showCustomAlert({
        type: "error",
        title: "Invalid Employee",
        message:
          "Only employees with an active deployment record can be reported in incidents.",
      });
      return;
    }

    // 🔥 PREVENT DUPLICATE INCIDENT SAME DAY
const existingSame = existingIncidents.find(
  (inc) =>
    String(inc.employeeId) === String(formData.employeeId) &&
    inc.violation === formData.violation &&
    new Date(inc.date).toDateString() === new Date(formData.date).toDateString()
);

if (existingSame) {
  showCustomAlert({
    type: "error",
    title: "Duplicate Incident",
    message: "This employee already has the same violation reported today.",
  });
  return;
}

const hasActiveCase = existingIncidents.some(
  (inc) =>
    String(inc.employeeId) === String(formData.employeeId) &&
    ["Open", "Investigating"].includes(inc.status)
);

if (hasActiveCase) {
  showCustomAlert({
    type: "warning",
    title: "Active Case Exists",
    message:
      "This employee already has an ongoing case. Please resolve it first before creating a new one.",
  });
  return;
}

    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const now = formData.reportedAt || new Date().toISOString();
    const createdBy = user?.name || user?.username || "Unknown";

    const penaltyData = computePenaltyData({
      employeeId: formData.employeeId,
      violation: formData.violation,
      penalties: formData.penalties,
      description: formData.description,
    });

    const finalIncident = enrichIncidentIntelligence(
      {
        ...formData,
        ...penaltyData,
        status: "Open",
        date: getDateOnly(now),
        reportedAt: now,
        reportedBy: createdBy,
        actions: [],
        reviewComments: [],
        timeline: [
          {
            id: `TL-${Date.now()}`,
            title: "Incident Reported",
            description: "Incident report was created and saved.",
            createdAt: now,
            createdBy,
            status: "Open",
          },
        ],
      },
      existingIncidents
    );

    onSave(finalIncident);

    showCustomAlert({
      type: "success",
      title: "Incident Report Saved",
      message:
        "The incident report has been successfully saved and added to the report list.",
    });

    window.setTimeout(() => {
      closeCustomAlert();
      onClose();
    }, 1200);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div
        ref={modalRef}
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900"
      >
        <div className="bg-gradient-to-r from-red-600 to-rose-600 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-white/15 p-3 text-white ring-1 ring-white/20">
                <FiAlertTriangle size={22} />
              </div>

              <div>
                <h2 className="text-xl font-extrabold text-white">
                  Add Incident Report
                </h2>
                <p className="mt-1 text-sm text-red-100">
                  Review the incident report before final saving.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-white/10 p-2 text-white hover:bg-white/20"
              aria-label="Close modal"
            >
              <FiX size={20} />
            </button>
          </div>
        </div>

        {!isReviewing ? (
          <form
            onSubmit={handleReview}
            className="flex-1 space-y-6 overflow-y-auto px-6 py-6"
          >
            <section className="rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-white/10 dark:bg-slate-950/50">
              <SectionTitle icon={<FiFileText />} title="Incident Information" />

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Field label="Incident ID" icon={<FiHash />}>
                  <input
                    type="text"
                    value={formData.id}
                    disabled
                    className="input-field bg-gray-100 text-gray-500 dark:bg-slate-800"
                  />
                </Field>

                <Field label="Reported Date and Time" icon={<FiCalendar />}>
                  <input
                    type="text"
                    value={formatDateTime(formData.reportedAt)}
                    disabled
                    className="input-field bg-gray-100 text-gray-600 dark:bg-slate-800"
                  />
                </Field>

                <Field label="Status">
                  <input
                    type="text"
                    value="Open"
                    disabled
                    className="input-field bg-gray-100 font-semibold text-gray-600 dark:bg-slate-800"
                  />
                </Field>
              </div>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-white/10 dark:bg-slate-950/50">
              <SectionTitle icon={<FiUser />} title="Employee Details" />

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div ref={employeeBoxRef} className="relative">
                  <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Employee <span className="text-red-500">*</span>
                  </label>

                  <div className="relative">
                    {!employeeSearch && (
                      <FiSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    )}

                    <input
                      type="text"
                      value={employeeSearch}
                      onChange={handleEmployeeInputChange}
                      onFocus={() => setShowEmployeeDropdown(true)}
                      placeholder="Search deployed employee name, ID number, or company..."
                      className="input-field"
                      style={{
                        paddingLeft: employeeSearch ? "1rem" : "2.55rem",
                      }}
                    />
                  </div>

                  {showEmployeeDropdown && filteredEmployees.length > 0 && (
                    <div className="absolute z-30 mt-2 max-h-60 w-full overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
                      {filteredEmployees.map((emp) => (
                        <button
                          key={emp.id}
                          type="button"
                          onClick={() => handleSelectEmployee(emp)}
                          className="w-full border-b border-gray-100 px-4 py-3 text-left transition last:border-b-0 hover:bg-gray-50 dark:border-slate-800 dark:hover:bg-slate-800"
                        >
                          <p className="text-sm font-bold text-gray-900 dark:text-white">
                            {emp.name}
                          </p>
                          <p className="mt-0.5 text-xs text-gray-500">
                            ID: {emp.id} {emp.company ? `• ${emp.company}` : ""}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}

                  {showEmployeeDropdown &&
                    employeeSearch &&
                    filteredEmployees.length === 0 && (
                      <div className="absolute z-30 mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-500 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                        No deployed employee found.
                      </div>
                    )}
                </div>

                <Field label="Company / Client" icon={<FiBriefcase />}>
                  <input
                    type="text"
                    value={formData.company || ""}
                    placeholder="Auto-filled from deployment if available"
                    disabled
                    className="input-field bg-gray-100 text-gray-500 dark:bg-slate-800"
                  />
                </Field>
              </div>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-white/10 dark:bg-slate-950/50">
              <SectionTitle icon={<FiShield />} title="Violation Classification" />

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div ref={violationBoxRef} className="relative">
                  <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Violation Type <span className="text-red-500">*</span>
                  </label>

                  <div className="relative">
                    {!violationSearch && (
                      <FiSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    )}

                    <input
                      type="text"
                      value={violationSearch}
                      onChange={handleViolationInputChange}
                      onFocus={() => setShowViolationDropdown(true)}
                      placeholder="Search by section, number, category, or violation..."
                      className="input-field"
                      style={{
                        paddingLeft: violationSearch ? "1rem" : "2.55rem",
                      }}
                    />
                  </div>

                  {showViolationDropdown && filteredViolations.length > 0 && (
                    <div className="absolute z-30 mt-2 max-h-72 w-full overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
                      {filteredViolations.map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => handleSelectViolation(item)}
                          className="w-full border-b border-gray-100 px-4 py-3 text-left transition last:border-b-0 hover:bg-gray-50 dark:border-slate-800 dark:hover:bg-slate-800"
                        >
                          <p className="text-sm font-bold text-gray-900 dark:text-white">
                            {item.section} — {item.violation}
                          </p>
                          <p className="mt-0.5 text-xs text-gray-500">
                            {item.category} • {item.penaltyLevel} •{" "}
                            {item.severity}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}

                  {showViolationDropdown &&
                    violationSearch &&
                    filteredViolations.length === 0 && (
                      <div className="absolute z-30 mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-500 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                        No matching violation found.
                      </div>
                    )}
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <ReadonlyBadge
                    label="Penalty Level"
                    value={formData.violation ? formData.penaltyLevel : ""}
                    styleMap={penaltyLevelStyle}
                    placeholder="Auto-generated"
                  />

                  <ReadonlyBadge
                    label="Severity"
                    value={formData.violation ? formData.severity : ""}
                    styleMap={severityStyle}
                    placeholder="Auto-generated"
                  />
                </div>
              </div>

              {formData.violation && (
                <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <PolicyCard formData={formData} />
                  <PenaltiesCard
                    penalties={formData.penalties}
                    offenseCount={formData.offenseCount}
                  />
                </div>
              )}

              {formData.violation && (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
                  <p className="font-bold">Auto-selected Sanction</p>
                  <p className="mt-1">
                    {formData.offenseCount}
                    {getOrdinalSuffix(Number(formData.offenseCount))} offense:{" "}
                    <span className="font-semibold">
                      {formData.sanction || "No sanction selected yet"}
                    </span>
                  </p>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-white/10 dark:bg-slate-950/50">
              <Field label="Incident Description" required>
                <textarea
                  name="description"
                  rows="5"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Write specific incident details, context, and supporting notes..."
                  className="input-field resize-none"
                />
              </Field>
            </section>

            <FooterButtons>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>

              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-red-700"
              >
                <FiCheckCircle />
                Review Report
              </button>
            </FooterButtons>
          </form>
        ) : (
          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
            <section className="rounded-2xl border border-green-200 bg-green-50 p-5 text-green-800 dark:border-green-900/40 dark:bg-green-950/30 dark:text-green-300">
              <div className="flex gap-3">
                <FiCheckCircle className="mt-0.5 shrink-0" />
                <div>
                  <h3 className="font-bold">Review Incident Report</h3>
                  <p className="mt-1 text-sm">
                    Please check all details carefully before final saving.
                  </p>
                </div>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              <ReviewItem label="Incident ID" value={formData.id} />
              <ReviewItem
                label="Reported Date and Time"
                value={formatDateTime(formData.reportedAt)}
              />
              <ReviewItem label="Status" value="Open" />
              <ReviewItem
                label="Employee"
                value={`${formData.employee} (${formData.employeeId})`}
              />
              <ReviewItem label="Company / Client" value={formData.company} />
              <ReviewItem label="Violation" value={formData.violation} />
              <ReviewItem label="Penalty Level" value={formData.penaltyLevel} />
              <ReviewItem label="Severity" value={formData.severity} />
              <ReviewItem
                label="Offense Count"
                value={`${formData.offenseCount} offense`}
              />
              <ReviewItem label="Auto Sanction" value={formData.sanction} />
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <PolicyCard formData={formData} />
              <PenaltiesCard
                penalties={formData.penalties}
                offenseCount={formData.offenseCount}
              />
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
                Incident Description
              </p>
              <p className="mt-3 whitespace-pre-line text-sm leading-6 text-gray-700 dark:text-gray-300">
                {formData.description}
              </p>
            </section>

            <FooterButtons>
              <button
                type="button"
                onClick={() => setIsReviewing(false)}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:text-gray-300 dark:hover:bg-slate-800"
              >
                <FiChevronLeft />
                Back
              </button>

              <button
                type="button"
                onClick={handleFinalSave}
                className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-green-700"
              >
                <FiCheckCircle />
                Final Save Report
              </button>
            </FooterButtons>
          </div>
        )}
      </div>

      {customAlert.show && (
        <CustomAlert
          type={customAlert.type}
          title={customAlert.title}
          message={customAlert.message}
          onClose={closeCustomAlert}
        />
      )}

      <style>{`
        .input-field {
          width: 100%;
          border-radius: 0.875rem;
          border: 1px solid rgb(209 213 219);
          background: white;
          padding: 0.75rem 1rem;
          font-size: 0.875rem;
          outline: none;
        }

        .input-field:focus {
          border-color: rgb(239 68 68);
          box-shadow: 0 0 0 3px rgb(254 226 226);
        }

        .dark .input-field {
          border-color: rgba(255, 255, 255, 0.1);
          background: rgb(15 23 42);
          color: white;
        }

        .dark .input-field::placeholder {
          color: rgb(148 163 184);
        }
      `}</style>
    </div>
  );
}

function CustomAlert({ type = "error", title, message, onClose }) {
  const isSuccess = type === "success";

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900">
        <div
          className={`px-6 py-5 ${
            isSuccess
              ? "bg-gradient-to-r from-emerald-600 to-green-600"
              : "bg-gradient-to-r from-red-600 to-rose-600"
          }`}
        >
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-white/15 p-3 text-white ring-1 ring-white/20">
              {isSuccess ? (
                <FiCheckCircle size={24} />
              ) : (
                <FiAlertTriangle size={24} />
              )}
            </div>

            <div>
              <h3 className="text-lg font-extrabold text-white">{title}</h3>
              <p className="mt-1 text-sm text-white/85">{message}</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className={`rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-sm ${
              isSuccess
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-red-600 hover:bg-red-700"
            }`}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ icon, title }) {
  return (
    <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-gray-700 dark:text-gray-300">
      {icon}
      {title}
    </h3>
  );
}

function Field({ label, required = false, icon = null, children }) {
  return (
    <div>
      <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
        {icon}
        <span>
          {label} {required && <span className="text-red-500">*</span>}
        </span>
      </label>
      {children}
    </div>
  );
}

function ReadonlyBadge({ label, value, styleMap, placeholder }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300">
        {label}
      </label>

      <div className="flex min-h-[46px] items-center rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-slate-900">
        {value ? (
          <span
            className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${
              styleMap[value] || "border-gray-200 bg-gray-100 text-gray-700"
            }`}
          >
            {value}
          </span>
        ) : (
          <span className="text-sm text-gray-400">{placeholder}</span>
        )}
      </div>
    </div>
  );
}

function PolicyCard({ formData }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
        Policy Reference
      </p>

      <p className="mt-2 text-sm font-bold text-gray-900 dark:text-white">
        {formData.violationCategory} • {formData.violationSection}
      </p>

      <p
        className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-400"
        dangerouslySetInnerHTML={{
          __html: formData.violationDescription || "",
        }}
      />
    </div>
  );
}

function PenaltiesCard({ penalties = [], offenseCount }) {
  if (!Array.isArray(penalties) || penalties.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
          Penalties
        </p>
        <p className="mt-2 text-sm text-gray-500">No penalties configured.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
        Penalties
      </p>

      <ul className="mt-2 space-y-2 text-sm text-gray-700 dark:text-gray-300">
        {penalties.map((penalty, index) => {
          const isSelected =
            Number(penalty?.offenseNo) === Number(offenseCount);

          return (
            <li
              key={`${penalty?.label || "penalty"}-${index}`}
              className={`flex gap-2 rounded-xl px-2 py-1.5 ${
                isSelected
                  ? "bg-red-50 font-semibold text-red-700 dark:bg-red-950/30 dark:text-red-300"
                  : ""
              }`}
            >
              <span className="text-red-500">•</span>
              <span>
                <span className="font-semibold">
                  {penalty?.label || `${index + 1} offense`}:
                </span>{" "}
                {penalty?.action || "No penalty specified"}
                {isSelected && (
                  <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase text-red-700">
                    Selected
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ReviewItem({ label, value }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-white/10 dark:bg-slate-900">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
        {value || "-"}
      </p>
    </div>
  );
}

function FooterButtons({ children }) {
  return (
    <div className="flex justify-end gap-3 border-t border-gray-200 bg-white pt-5 dark:border-white/10 dark:bg-slate-900">
      {children}
    </div>
  );
}