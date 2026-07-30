import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FiBriefcase,
  FiCalendar,
  FiCheckCircle,
  FiChevronLeft,
  FiFileText,
  FiHash,
  FiSearch,
  FiShield,
  FiUser,
} from "react-icons/fi";

import {
  computeAutoSeverity,
  flattenViolationRules,
  getNextOffenseCount,
  getPenaltyByOffense,
  getPenaltyText,
} from "../../../utils/incidentIntelligence";

import {
  buildFinalIncident,
  findActiveDeployment,
  formatDateTime,
  generateIncidentId,
  getDateOnly,
  getDuplicateIncidentCandidates,
  getOrdinalSuffix,
  penaltyLevelStyle,
  severityStyle,
} from "../../../utils/incidents/addIncidentHelpers";

import {
  DuplicateIncidentVerificationPanel,
  Field,
  FooterButtons,
  ModalStyle,
  PenaltiesCard,
  PolicyCard,
  ReadonlyBadge,
  ReviewItem,
  SectionTitle,
} from "../add/AddIncidentUI";

import {
  BaseModal,
  NoticeModal,
} from "../shared/ModalUI";

export default function AddIncidentModal({
  isOpen,
  onClose,
  onSave,
  employees = [],
  deployments = [],
  existingIncidents = [],
}) {
  const violationBoxRef = useRef(null);
  const employeeBoxRef = useRef(null);
  const employeeInputRef = useRef(null);
  const closeTimerRef = useRef(null);

  const [formData, setFormData] = useState(null);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [violationSearch, setViolationSearch] = useState("");

  const [
    showEmployeeDropdown,
    setShowEmployeeDropdown,
  ] = useState(false);

  const [
    showViolationDropdown,
    setShowViolationDropdown,
  ] = useState(false);

  const [isReviewing, setIsReviewing] =
    useState(false);

  const [
    duplicateConfirmed,
    setDuplicateConfirmed,
  ] = useState(false);

  const [isSaving, setIsSaving] =
    useState(false);

  const [customAlert, setCustomAlert] =
    useState({
      show: false,
      type: "error",
      title: "",
      message: "",
    });

  const violationOptions = useMemo(
    () => flattenViolationRules(),
    []
  );

  const employeeOptions = useMemo(() => {
    return employees
      .filter((employee) => {
        const status = String(
          employee?.status || ""
        )
          .trim()
          .toLowerCase();

        return (
          status === "deployed" ||
          status === "active deployed"
        );
      })
      .map((employee) => ({
        id:
          employee?.id ||
          employee?.employeeId ||
          employee?.employee_id ||
          employee?.name,

        name:
          employee?.name ||
          employee?.full_name ||
          employee?.fullName ||
          "",

        company:
          employee?.company || "",
      }));
  }, [employees]);

  const createInitialFormData =
    useCallback(() => {
      const now =
        new Date().toISOString();

      return {
        id: generateIncidentId(
          existingIncidents
        ),

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

        duplicateVerified: false,
        duplicateVerificationNote: "",

        timeline: [],
      };
    }, [existingIncidents]);

  const showCustomAlert = useCallback(
    ({
      type = "error",
      title,
      message,
    }) => {
      setCustomAlert({
        show: true,
        type,
        title,
        message,
      });
    },
    []
  );

  const closeCustomAlert =
    useCallback(() => {
      setCustomAlert((current) => ({
        ...current,
        show: false,
      }));
    }, []);

  const handleClose = useCallback(() => {
    if (isSaving) {
      return;
    }

    setShowEmployeeDropdown(false);
    setShowViolationDropdown(false);
    closeCustomAlert();
    onClose();
  }, [
    closeCustomAlert,
    isSaving,
    onClose,
  ]);

useEffect(() => {
  if (!isOpen) {
    return undefined;
  }

  const resetTimerId = window.setTimeout(() => {
    setFormData(createInitialFormData());

    setEmployeeSearch("");
    setViolationSearch("");

    setShowEmployeeDropdown(false);
    setShowViolationDropdown(false);

    setIsReviewing(false);
    setDuplicateConfirmed(false);
    setIsSaving(false);

    closeCustomAlert();
  }, 0);

  return () => {
    window.clearTimeout(resetTimerId);
  };
}, [
  closeCustomAlert,
  createInitialFormData,
  isOpen,
]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(
          closeTimerRef.current
        );
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleClickOutside = (
      event
    ) => {
      if (
        employeeBoxRef.current &&
        !employeeBoxRef.current.contains(
          event.target
        )
      ) {
        setShowEmployeeDropdown(
          false
        );
      }

      if (
        violationBoxRef.current &&
        !violationBoxRef.current.contains(
          event.target
        )
      ) {
        setShowViolationDropdown(
          false
        );
      }
    };

    document.addEventListener(
      "mousedown",
      handleClickOutside
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside
      );
    };
  }, [isOpen]);

  const filteredEmployees =
    useMemo(() => {
      const keyword = employeeSearch
        .trim()
        .toLowerCase();

      if (!keyword) {
        return [];
      }

      return employeeOptions
        .filter((employee) => {
          return [
            employee.name,
            employee.id,
            employee.company,
          ]
            .join(" ")
            .toLowerCase()
            .includes(keyword);
        })
        .slice(0, 8);
    }, [
      employeeOptions,
      employeeSearch,
    ]);

  const filteredViolations =
    useMemo(() => {
      const keyword = violationSearch
        .trim()
        .toLowerCase();

      if (!keyword) {
        return violationOptions.slice(
          0,
          12
        );
      }

      return violationOptions
        .filter((item) => {
          const searchableText = [
            item.category,
            item.section,
            item.violation,
            item.description,
            item.penaltyLevel,
            item.severity,

            ...(item.penalties || []).map(
              (penalty) => {
                if (
                  typeof penalty ===
                  "string"
                ) {
                  return penalty;
                }

                return `${
                  penalty?.label || ""
                } ${
                  penalty?.action || ""
                }`;
              }
            ),
          ]
            .join(" ")
            .replace(/<[^>]*>/g, "")
            .toLowerCase();

          return searchableText.includes(
            keyword
          );
        })
        .slice(0, 12);
    }, [
      violationOptions,
      violationSearch,
    ]);

  const duplicateCandidates =
    useMemo(() => {
      if (!formData) {
        return [];
      }

      return getDuplicateIncidentCandidates(
        existingIncidents,
        formData
      );
    }, [
      existingIncidents,
      formData,
    ]);

  const needsDuplicateVerification =
    duplicateCandidates.length > 0;

  const computePenaltyData =
    useCallback(
      ({
        employeeId,
        violation,
        penalties,
        description,
      }) => {
        if (!violation) {
          return {
            offenseCount: 1,
            selectedPenalty: null,
            sanction: "",
            severity: "",
          };
        }

        const offenseCount =
          getNextOffenseCount(
            existingIncidents,
            employeeId,
            violation
          );

        const selectedPenalty =
          getPenaltyByOffense(
            penalties,
            offenseCount
          );

        const sanction =
          getPenaltyText(
            selectedPenalty
          );

        const selectedRule =
          violationOptions.find(
            (rule) =>
              rule.violation ===
              violation
          );

        const severity =
          computeAutoSeverity({
            baseSeverity:
              selectedRule?.severity ||
              "Minor",

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
      [
        existingIncidents,
        violationOptions,
      ]
    );

  const resetDuplicateVerification =
    useCallback(() => {
      setDuplicateConfirmed(false);
    }, []);

  const handleSelectEmployee =
    useCallback(
      (selectedEmployee) => {
        const activeDeployment =
          findActiveDeployment(
            deployments,
            selectedEmployee
          );

        setFormData((current) => ({
          ...current,

          employeeId:
            selectedEmployee.id,

          employee:
            selectedEmployee.name,

          company:
            activeDeployment?.company ||
            activeDeployment
              ?.clientCompany ||
            selectedEmployee.company ||
            "",

          offenseCount: 1,
          selectedPenalty: null,
          sanction: "",
          severity: "",

          duplicateVerified: false,
          duplicateVerificationNote:
            "",
        }));

        setEmployeeSearch(
          `${selectedEmployee.name} (${selectedEmployee.id})`
        );

        setShowEmployeeDropdown(false);
        setIsReviewing(false);

        resetDuplicateVerification();
      },
      [
        deployments,
        resetDuplicateVerification,
      ]
    );

  const handleEmployeeInputChange =
    useCallback(
      (event) => {
        const value =
          event.target.value;

        setEmployeeSearch(value);
        setShowEmployeeDropdown(true);
        setIsReviewing(false);

        resetDuplicateVerification();

        setFormData((current) => ({
          ...current,

          employeeId: "",
          employee: "",
          company: "",

          offenseCount: 1,
          selectedPenalty: null,
          sanction: "",
          severity: "",

          duplicateVerified: false,
          duplicateVerificationNote:
            "",
        }));
      },
      [resetDuplicateVerification]
    );

  const handleSelectViolation =
    useCallback(
      (selectedRule) => {
        setFormData((current) => {
          const penalties =
            selectedRule.penalties ||
            [];

          const penaltyData =
            computePenaltyData({
              employeeId:
                current.employeeId,

              violation:
                selectedRule.violation,

              penalties,

              description:
                current.description,
            });

          return {
            ...current,

            violation:
              selectedRule.violation,

            violationCategory:
              selectedRule.category,

            violationSection:
              selectedRule.section,

            violationDescription:
              selectedRule.description ||
              "",

            penaltyLevel:
              selectedRule.penaltyLevel ||
              "",

            penalties,

            duplicateVerified: false,
            duplicateVerificationNote:
              "",

            ...penaltyData,
          };
        });

        setViolationSearch(
          `${selectedRule.section} — ${selectedRule.violation}`
        );

        setShowViolationDropdown(false);
        setIsReviewing(false);

        resetDuplicateVerification();
      },
      [
        computePenaltyData,
        resetDuplicateVerification,
      ]
    );

  const handleViolationInputChange =
    useCallback(
      (event) => {
        const value =
          event.target.value;

        setViolationSearch(value);
        setShowViolationDropdown(true);
        setIsReviewing(false);

        resetDuplicateVerification();

        setFormData((current) => ({
          ...current,

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

          duplicateVerified: false,
          duplicateVerificationNote:
            "",
        }));
      },
      [resetDuplicateVerification]
    );

  const handleChange = useCallback(
    (event) => {
      const { name, value } =
        event.target;

      setIsReviewing(false);

      setFormData((current) => {
        const updated = {
          ...current,
          [name]: value,
        };

        if (
          name === "description" &&
          updated.violation
        ) {
          const penaltyData =
            computePenaltyData({
              employeeId:
                updated.employeeId,

              violation:
                updated.violation,

              penalties:
                updated.penalties,

              description: value,
            });

          return {
            ...updated,
            ...penaltyData,
          };
        }

        return updated;
      });
    },
    [computePenaltyData]
  );

  const validateForm =
    useCallback(() => {
      if (
        !formData?.employeeId ||
        !formData?.employee
      ) {
        showCustomAlert({
          type: "error",
          title: "Employee Required",
          message:
            "Please select an employee from the suggested list.",
        });

        return false;
      }

      if (!formData?.violation) {
        showCustomAlert({
          type: "error",
          title: "Violation Required",
          message:
            "Please select a violation type from the suggested list.",
        });

        return false;
      }

      if (
        !formData?.description?.trim()
      ) {
        showCustomAlert({
          type: "error",
          title:
            "Incident Description Required",

          message:
            "Please enter the incident description before reviewing.",
        });

        return false;
      }

      return true;
    }, [
      formData,
      showCustomAlert,
    ]);

  const handleReview = useCallback(
    (event) => {
      event.preventDefault();

      if (!validateForm()) {
        return;
      }

      const penaltyData =
        computePenaltyData({
          employeeId:
            formData.employeeId,

          violation:
            formData.violation,

          penalties:
            formData.penalties,

          description:
            formData.description,
        });

      setFormData((current) => ({
        ...current,
        ...penaltyData,
      }));

      setShowEmployeeDropdown(false);
      setShowViolationDropdown(false);
      setIsReviewing(true);

      showCustomAlert({
        type: "success",
        title:
          "Report Ready for Review",

        message:
          "Incident details have been validated. Please review the report before final saving.",
      });
    },
    [
      computePenaltyData,
      formData,
      showCustomAlert,
      validateForm,
    ]
  );

  const handleFinalSave =
    useCallback(async () => {
      if (
        isSaving ||
        !validateForm()
      ) {
        return;
      }

      const activeDeployment =
        findActiveDeployment(
          deployments,
          {
            employeeId:
              formData.employeeId,

            employee:
              formData.employee,
          }
        );

      if (!activeDeployment) {
        showCustomAlert({
          type: "error",
          title: "Invalid Employee",

          message:
            "Only employees with an active deployment record can be reported in incidents.",
        });

        return;
      }

      if (
        needsDuplicateVerification &&
        !duplicateConfirmed
      ) {
        showCustomAlert({
          type: "error",

          title:
            "Duplicate Verification Required",

          message:
            "A related active incident exists for the same employee and violation. Please verify the duplicate-check box before saving.",
        });

        return;
      }

      const penaltyData =
        computePenaltyData({
          employeeId:
            formData.employeeId,

          violation:
            formData.violation,

          penalties:
            formData.penalties,

          description:
            formData.description,
        });

      const finalIncident =
        buildFinalIncident({
          formData: {
            ...formData,

            duplicateVerified:
              needsDuplicateVerification
                ? duplicateConfirmed
                : false,

            duplicateVerificationNote:
              needsDuplicateVerification
                ? "Possible duplicate or related active incident was verified by HR before saving."
                : "",
          },

          penaltyData,
          existingIncidents,
        });

      try {
        setIsSaving(true);
        closeCustomAlert();

        const saved =
          await onSave(
            finalIncident
          );

        if (saved === false) {
          setIsSaving(false);
          return;
        }

        showCustomAlert({
          type: "success",

          title:
            "Incident Report Saved",

          message:
            "The incident report has been successfully saved to the database.",
        });

        closeTimerRef.current =
          window.setTimeout(() => {
            closeCustomAlert();
            setIsSaving(false);
            onClose();
          }, 900);
      } catch (error) {
        console.error(
          "Final save incident error:",
          error
        );

        setIsSaving(false);

        showCustomAlert({
          type: "error",
          title: "Save Failed",

          message:
            error?.message ||
            "The incident report could not be saved. Please try again.",
        });
      }
    }, [
      closeCustomAlert,
      computePenaltyData,
      deployments,
      duplicateConfirmed,
      existingIncidents,
      formData,
      isSaving,
      needsDuplicateVerification,
      onClose,
      onSave,
      showCustomAlert,
      validateForm,
    ]);

  if (
    !isOpen ||
    !formData
  ) {
    return null;
  }

  return (
    <>
      <BaseModal
        onClose={handleClose}
        title={
          isReviewing
            ? "Review Incident Report"
            : "Add Incident Report"
        }
        subtitle={
          isReviewing
            ? "Check all incident information before final saving."
            : "Complete and review the incident report before saving it."
        }
        color={
          isReviewing
            ? "green"
            : "red"
        }
        size="lg"
        preventClose={isSaving}
        initialFocusRef={
          employeeInputRef
        }
      >
        {!isReviewing ? (
          <form
            onSubmit={handleReview}
            className="space-y-6"
          >
            <section className="rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-white/10 dark:bg-slate-950/50">
              <SectionTitle
                icon={<FiFileText />}
                title="Incident Information"
              />

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Field
                  label="Incident ID"
                  icon={<FiHash />}
                >
                  <input
                    type="text"
                    value={formData.id}
                    disabled
                    className="input-field bg-gray-100 text-gray-500 dark:bg-slate-800"
                  />
                </Field>

                <Field
                  label="Reported Date and Time"
                  icon={<FiCalendar />}
                >
                  <input
                    type="text"
                    value={formatDateTime(
                      formData.reportedAt
                    )}
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
              <SectionTitle
                icon={<FiUser />}
                title="Employee Details"
              />

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div
                  ref={employeeBoxRef}
                  className="relative"
                >
                  <label
                    htmlFor="incident-employee-search"
                    className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                  >
                    Employee{" "}
                    <span className="text-red-500">
                      *
                    </span>
                  </label>

                  <div className="relative">
                    {!employeeSearch && (
                      <FiSearch
                        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                        aria-hidden="true"
                      />
                    )}

                    <input
                      ref={employeeInputRef}
                      id="incident-employee-search"
                      type="text"
                      value={employeeSearch}
                      onChange={
                        handleEmployeeInputChange
                      }
                      onFocus={() =>
                        setShowEmployeeDropdown(
                          true
                        )
                      }
                      autoComplete="off"
                      disabled={isSaving}
                      placeholder="Search deployed employee name, ID number, or company..."
                      className="input-field"
                      style={{
                        paddingLeft:
                          employeeSearch
                            ? "1rem"
                            : "2.55rem",
                      }}
                    />
                  </div>

                  {showEmployeeDropdown &&
                    filteredEmployees.length >
                      0 && (
                      <div
                        role="listbox"
                        aria-label="Deployed employees"
                        className="absolute z-30 mt-2 max-h-60 w-full overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
                      >
                        {filteredEmployees.map(
                          (employee) => (
                            <button
                              key={
                                employee.id
                              }
                              type="button"
                              role="option"
                              aria-selected={
                                String(
                                  formData.employeeId
                                ) ===
                                String(
                                  employee.id
                                )
                              }
                              onClick={() =>
                                handleSelectEmployee(
                                  employee
                                )
                              }
                              className="w-full border-b border-gray-100 px-4 py-3 text-left transition last:border-b-0 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none dark:border-slate-800 dark:hover:bg-slate-800 dark:focus:bg-slate-800"
                            >
                              <p className="text-sm font-bold text-gray-900 dark:text-white">
                                {
                                  employee.name
                                }
                              </p>

                              <p className="mt-0.5 text-xs text-gray-500">
                                ID:{" "}
                                {
                                  employee.id
                                }{" "}
                                {employee.company
                                  ? `• ${employee.company}`
                                  : ""}
                              </p>
                            </button>
                          )
                        )}
                      </div>
                    )}

                  {showEmployeeDropdown &&
                    employeeSearch &&
                    filteredEmployees.length ===
                      0 && (
                      <div className="absolute z-30 mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-500 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                        No deployed employee
                        found.
                      </div>
                    )}
                </div>

                <Field
                  label="Company / Client"
                  icon={<FiBriefcase />}
                >
                  <input
                    type="text"
                    value={
                      formData.company ||
                      ""
                    }
                    placeholder="Auto-filled from deployment"
                    disabled
                    className="input-field bg-gray-100 text-gray-500 dark:bg-slate-800"
                  />
                </Field>
              </div>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-white/10 dark:bg-slate-950/50">
              <SectionTitle
                icon={<FiShield />}
                title="Violation Classification"
              />

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div
                  ref={violationBoxRef}
                  className="relative"
                >
                  <label
                    htmlFor="incident-violation-search"
                    className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                  >
                    Violation Type{" "}
                    <span className="text-red-500">
                      *
                    </span>
                  </label>

                  <div className="relative">
                    {!violationSearch && (
                      <FiSearch
                        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                        aria-hidden="true"
                      />
                    )}

                    <input
                      id="incident-violation-search"
                      type="text"
                      value={
                        violationSearch
                      }
                      onChange={
                        handleViolationInputChange
                      }
                      onFocus={() =>
                        setShowViolationDropdown(
                          true
                        )
                      }
                      autoComplete="off"
                      disabled={isSaving}
                      placeholder="Search by section, number, category, or violation..."
                      className="input-field"
                      style={{
                        paddingLeft:
                          violationSearch
                            ? "1rem"
                            : "2.55rem",
                      }}
                    />
                  </div>

                  {showViolationDropdown &&
                    filteredViolations.length >
                      0 && (
                      <div
                        role="listbox"
                        aria-label="Violation types"
                        className="absolute z-30 mt-2 max-h-72 w-full overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
                      >
                        {filteredViolations.map(
                          (item) => (
                            <button
                              key={
                                item.key
                              }
                              type="button"
                              role="option"
                              aria-selected={
                                formData.violation ===
                                item.violation
                              }
                              onClick={() =>
                                handleSelectViolation(
                                  item
                                )
                              }
                              className="w-full border-b border-gray-100 px-4 py-3 text-left transition last:border-b-0 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none dark:border-slate-800 dark:hover:bg-slate-800 dark:focus:bg-slate-800"
                            >
                              <p className="text-sm font-bold text-gray-900 dark:text-white">
                                {
                                  item.section
                                }{" "}
                                —{" "}
                                {
                                  item.violation
                                }
                              </p>

                              <p className="mt-0.5 text-xs text-gray-500">
                                {
                                  item.category
                                }{" "}
                                •{" "}
                                {
                                  item.penaltyLevel
                                }{" "}
                                •{" "}
                                {
                                  item.severity
                                }
                              </p>
                            </button>
                          )
                        )}
                      </div>
                    )}

                  {showViolationDropdown &&
                    violationSearch &&
                    filteredViolations.length ===
                      0 && (
                      <div className="absolute z-30 mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-500 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                        No matching violation
                        found.
                      </div>
                    )}
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <ReadonlyBadge
                    label="Penalty Level"
                    value={
                      formData.violation
                        ? formData.penaltyLevel
                        : ""
                    }
                    styleMap={
                      penaltyLevelStyle
                    }
                    placeholder="Auto-generated"
                  />

                  <ReadonlyBadge
                    label="Severity"
                    value={
                      formData.violation
                        ? formData.severity
                        : ""
                    }
                    styleMap={
                      severityStyle
                    }
                    placeholder="Auto-generated"
                  />
                </div>
              </div>

              {formData.violation && (
                <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <PolicyCard
                    formData={formData}
                  />

                  <PenaltiesCard
                    penalties={
                      formData.penalties
                    }
                    offenseCount={
                      formData.offenseCount
                    }
                  />
                </div>
              )}

              {formData.violation && (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
                  <p className="font-bold">
                    Auto-selected Sanction
                  </p>

                  <p className="mt-1">
                    {
                      formData.offenseCount
                    }
                    {getOrdinalSuffix(
                      Number(
                        formData.offenseCount
                      )
                    )}{" "}
                    offense:{" "}
                    <span className="font-semibold">
                      {formData.sanction ||
                        "No sanction selected yet"}
                    </span>
                  </p>
                </div>
              )}
            </section>

            {formData.employeeId &&
              formData.violation && (
                <DuplicateIncidentVerificationPanel
                  candidates={
                    duplicateCandidates
                  }
                  checked={
                    duplicateConfirmed
                  }
                  onChange={
                    setDuplicateConfirmed
                  }
                />
              )}

            <section className="rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-white/10 dark:bg-slate-950/50">
              <Field
                label="Incident Description"
                required
              >
                <textarea
                  name="description"
                  rows={5}
                  value={
                    formData.description
                  }
                  onChange={handleChange}
                  disabled={isSaving}
                  placeholder="Write specific incident details, context, and supporting notes..."
                  className="input-field resize-none"
                />
              </Field>
            </section>

            <FooterButtons>
              <button
                type="button"
                onClick={handleClose}
                disabled={isSaving}
                className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:text-gray-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FiCheckCircle
                  aria-hidden="true"
                />
                Review Report
              </button>
            </FooterButtons>
          </form>
        ) : (
          <div className="space-y-6">
            <section className="rounded-2xl border border-green-200 bg-green-50 p-5 text-green-800 dark:border-green-900/40 dark:bg-green-950/30 dark:text-green-300">
              <div className="flex gap-3">
                <FiCheckCircle
                  className="mt-0.5 shrink-0"
                  aria-hidden="true"
                />

                <div>
                  <h3 className="font-bold">
                    Review Incident
                    Report
                  </h3>

                  <p className="mt-1 text-sm">
                    Please check all
                    details carefully
                    before final saving.
                  </p>
                </div>
              </div>
            </section>

            {formData.employeeId &&
              formData.violation && (
                <DuplicateIncidentVerificationPanel
                  candidates={
                    duplicateCandidates
                  }
                  checked={
                    duplicateConfirmed
                  }
                  onChange={
                    setDuplicateConfirmed
                  }
                />
              )}

            <section className="grid gap-4 md:grid-cols-2">
              <ReviewItem
                label="Incident ID"
                value={formData.id}
              />

              <ReviewItem
                label="Reported Date and Time"
                value={formatDateTime(
                  formData.reportedAt
                )}
              />

              <ReviewItem
                label="Status"
                value="Open"
              />

              <ReviewItem
                label="Employee"
                value={`${formData.employee} (${formData.employeeId})`}
              />

              <ReviewItem
                label="Company / Client"
                value={
                  formData.company
                }
              />

              <ReviewItem
                label="Violation"
                value={
                  formData.violation
                }
              />

              <ReviewItem
                label="Penalty Level"
                value={
                  formData.penaltyLevel
                }
              />

              <ReviewItem
                label="Severity"
                value={
                  formData.severity
                }
              />

              <ReviewItem
                label="Offense Count"
                value={`${formData.offenseCount} offense`}
              />

              <ReviewItem
                label="Auto Sanction"
                value={
                  formData.sanction
                }
              />
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <PolicyCard
                formData={formData}
              />

              <PenaltiesCard
                penalties={
                  formData.penalties
                }
                offenseCount={
                  formData.offenseCount
                }
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
                onClick={() =>
                  setIsReviewing(false)
                }
                disabled={isSaving}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:text-gray-300 dark:hover:bg-slate-800"
              >
                <FiChevronLeft
                  aria-hidden="true"
                />
                Back
              </button>

              <button
                type="button"
                onClick={
                  handleFinalSave
                }
                disabled={isSaving}
                className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FiCheckCircle
                  className={
                    isSaving
                      ? "animate-pulse"
                      : ""
                  }
                  aria-hidden="true"
                />

                {isSaving
                  ? "Saving Report..."
                  : "Final Save Report"}
              </button>
            </FooterButtons>
          </div>
        )}

        <ModalStyle />
      </BaseModal>

      {customAlert.show && (
        <NoticeModal
          type={customAlert.type}
          title={customAlert.title}
          message={customAlert.message}
          preventClose={isSaving}
          onClose={
            isSaving
              ? undefined
              : closeCustomAlert
          }
        />
      )}
    </>
  );
}