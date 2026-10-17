import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import axios from "axios";

import {
  DOCUMENT_OPTIONS,
  toProperName,
} from "../../components/employees/employeeConstants";

import { API_BASE } from "../../config/api";

import {
  INITIAL_EMPLOYEE_FORM_ERRORS,
  calculateEmployeeFormCompletion,
  createInitialEmployeeFormData,
  EMPLOYEE_API_URL,
  getCompletedDocuments,
  getComplianceReviewWarning,
  getEmployeeApiError,
  validateEmployeeDocumentFile,
  validateEmployeeForm,
} from "../../utils/employees/employeeFormHelpers";

const DUPLICATE_LOOKUP_DEBOUNCE_MS =
  350;

const REQUEST_TIMEOUT_MS =
  45 * 1000;

const DEPLOYMENT_COMPANY_OPTIONS_URL =
  `${API_BASE}/deployments/options/companies`;

const DEPLOYMENT_POSITION_OPTIONS_URL =
  `${API_BASE}/deployments/options/positions`;

function createInitialErrors() {
  return {
    ...INITIAL_EMPLOYEE_FORM_ERRORS,
    documents: {},
  };
}

function normalizeComparableValue(
  value
) {
  return String(
    value ?? ""
  )
    .trim()
    .replace(
      /\s+/g,
      " "
    )
    .toLowerCase();
}

function valuesMatch(
  left,
  right
) {
  return (
    normalizeComparableValue(
      left
    ) ===
    normalizeComparableValue(
      right
    )
  );
}

function getEmployeeWorkforceStatus(
  employee
) {
  return String(
    employee?.workforceStatus ||
      employee?.workforce_status ||
      employee?.status ||
      ""
  ).trim();
}

function getInitialEmployeeCompany(
  employee
) {
  if (!employee) {
    return "";
  }

  return String(
    employee?.company ||
      ""
  ).trim();
}

function getInitialEmployeePosition(
  employee
) {
  if (!employee) {
    return "";
  }

  return String(
    employee?.position ||
      employee?.deploymentPosition ||
      employee?.deployment_position ||
      ""
  ).trim();
}

function normalizeCompanyOption(
  option
) {
  if (
    typeof option ===
    "string"
  ) {
    const name =
      option.trim();

    if (!name) {
      return null;
    }

    return {
      id: null,
      name,
      isActive: true,
      isHistorical: false,
    };
  }

  if (
    !option ||
    typeof option !==
      "object"
  ) {
    return null;
  }

  const name =
    String(
      option.companyName ??
        option.company_name ??
        option.company ??
        option.name ??
        ""
    ).trim();

  if (!name) {
    return null;
  }

  const rawId =
    option.id ??
    option.companyId ??
    option.company_id ??
    null;

  const parsedId =
    Number.parseInt(
      String(
        rawId ?? ""
      ),
      10
    );

  return {
    id:
      Number.isInteger(
        parsedId
      )
        ? parsedId
        : null,

    name,

    isActive:
      option.isActive !==
        false &&
      option.is_active !==
        0 &&
      option.is_active !==
        false,

    isHistorical: false,
  };
}

function normalizePositionOption(
  option
) {
  if (
    typeof option ===
    "string"
  ) {
    const name =
      option.trim();

    if (!name) {
      return null;
    }

    return {
      id: null,
      name,
      isActive: true,
      isHistorical: false,
    };
  }

  if (
    !option ||
    typeof option !==
      "object"
  ) {
    return null;
  }

  const name =
    String(
      option.positionName ??
        option.position_name ??
        option.position ??
        option.name ??
        ""
    ).trim();

  if (!name) {
    return null;
  }

  const rawId =
    option.id ??
    option.positionId ??
    option.position_id ??
    null;

  const parsedId =
    Number.parseInt(
      String(
        rawId ?? ""
      ),
      10
    );

  return {
    id:
      Number.isInteger(
        parsedId
      )
        ? parsedId
        : null,

    name,

    isActive:
      option.isActive !==
        false &&
      option.is_active !==
        0 &&
      option.is_active !==
        false,

    isHistorical: false,
  };
}

function deduplicateOptions(
  options
) {
  const seen =
    new Set();

  return options.filter(
    (option) => {
      const key =
        normalizeComparableValue(
          option?.name
        );

      if (
        !key ||
        seen.has(
          key
        )
      ) {
        return false;
      }

      seen.add(
        key
      );

      return true;
    }
  );
}

function isCanceledRequest(
  error
) {
  return (
    error?.code ===
      "ERR_CANCELED" ||
    error?.name ===
      "CanceledError" ||
    error?.name ===
      "AbortError"
  );
}

export default function useEmployeeForm({
  initialEmployee = null,
  employeeId = "",
  employees = [],
  initialShowDocuments = false,
} = {}) {
  const [
    formData,
    setFormData,
  ] =
    useState(
      () =>
        createInitialEmployeeFormData(
          initialEmployee
        )
    );

  const [
    errors,
    setErrors,
  ] =
    useState(
      createInitialErrors
    );

  const [
    showReview,
    setShowReview,
  ] =
    useState(false);

  const [
    showDocuments,
    setShowDocuments,
  ] =
    useState(
      () =>
        Boolean(
          initialShowDocuments
        )
    );

  /*
   * Deep-linked Compliance notifications should render
   * the document section open from the beginning.
   *
   * If the intent arrives after the first render
   * (for example route state resolving into an already
   * mounted modal), force it open directly instead of
   * toggling. This avoids open -> closed races.
   */
  useEffect(
    () => {
      if (
        initialShowDocuments
      ) {
        setShowDocuments(
          true
        );
      }
    },
    [
      initialShowDocuments,
    ]
  );

  const [
    duplicateConfirmed,
    setDuplicateConfirmed,
  ] =
    useState(false);

  const [
    duplicateEmployee,
    setDuplicateEmployee,
  ] =
    useState(null);

  const [
    companyOptions,
    setCompanyOptions,
  ] =
    useState([]);

  const [
    positionOptions,
    setPositionOptions,
  ] =
    useState([]);

  /*
   * Legacy compatibility state retained for callers
   * that still consume the older autocomplete props.
   * EmployeeFormFields now uses managed select fields.
   */
  const [
    showSuggestions,
    setShowSuggestions,
  ] =
    useState(false);

  const [
    isLoadingCompanies,
    setIsLoadingCompanies,
  ] =
    useState(false);

  const [
    isLoadingPositions,
    setIsLoadingPositions,
  ] =
    useState(false);

  const [
    deploymentOptionsError,
    setDeploymentOptionsError,
  ] =
    useState("");

  const [
    dragTargetDocument,
    setDragTargetDocument,
  ] =
    useState("");

  const [
    isSaving,
    setIsSaving,
  ] =
    useState(false);

  const [
    saveError,
    setSaveError,
  ] =
    useState("");

  const companyBlurTimerRef =
    useRef(null);

  const duplicateLookupTimerRef =
    useRef(null);

  const duplicateLookupAbortRef =
    useRef(null);

  const companyOptionsAbortRef =
    useRef(null);

  const positionOptionsAbortRef =
    useRef(null);

  const initialCompany =
    useMemo(
      () =>
        getInitialEmployeeCompany(
          initialEmployee
        ),
      [
        initialEmployee,
      ]
    );

  const initialPosition =
    useMemo(
      () =>
        getInitialEmployeePosition(
          initialEmployee
        ),
      [
        initialEmployee,
      ]
    );

  const initialWorkforceStatus =
    useMemo(
      () =>
        getEmployeeWorkforceStatus(
          initialEmployee
        ),
      [
        initialEmployee,
      ]
    );

  const isEditPlacementLocked =
    Boolean(
      initialEmployee
    ) &&
    [
      "For Deployment",
      "Deployed",
    ].includes(
      initialWorkforceStatus
    );

  /*
   * Active companies come from the backend master
   * table.
   *
   * During Edit mode, the employee's current/designated
   * company is appended as a historical option when it
   * has since been deactivated.
   */
  const visibleCompanyOptions =
    useMemo(
      () => {
        const options =
          companyOptions.map(
            (option) => ({
              ...option,
            })
          );

        if (
          initialCompany &&
          !options.some(
            (option) =>
              valuesMatch(
                option.name,
                initialCompany
              )
          )
        ) {
          options.push({
            id: null,
            name:
              initialCompany,
            isActive: false,
            isHistorical: true,
          });
        }

        return deduplicateOptions(
          options
        );
      },
      [
        companyOptions,
        initialCompany,
      ]
    );

  /*
   * Historical position preservation is only valid
   * while the employee remains on their original
   * current/designated company.
   *
   * If HR selects another company, only positions
   * returned from that active company are available.
   */
  const visiblePositionOptions =
    useMemo(
      () => {
        const options =
          positionOptions.map(
            (option) => ({
              ...option,
            })
          );

        const selectedCompany =
          String(
            formData?.company ||
              ""
          ).trim();

        const shouldIncludeHistoricalPosition =
          initialPosition &&
          initialCompany &&
          valuesMatch(
            selectedCompany,
            initialCompany
          ) &&
          !options.some(
            (option) =>
              valuesMatch(
                option.name,
                initialPosition
              )
          );

        if (
          shouldIncludeHistoricalPosition
        ) {
          options.push({
            id: null,
            name:
              initialPosition,
            isActive: false,
            isHistorical: true,
          });
        }

        return deduplicateOptions(
          options
        );
      },
      [
        formData?.company,
        initialCompany,
        initialPosition,
        positionOptions,
      ]
    );

  /*
   * Compatibility alias retained for older consumers.
   * Managed EmployeeFormFields uses companyOptions.
   */
  const filteredCompanies =
    useMemo(
      () => {
        const searchValue =
          normalizeComparableValue(
            formData?.company
          );

        const names =
          visibleCompanyOptions.map(
            (option) =>
              option.name
          );

        if (!searchValue) {
          return names;
        }

        return names.filter(
          (companyName) =>
            normalizeComparableValue(
              companyName
            ).includes(
              searchValue
            )
        );
      },
      [
        formData?.company,
        visibleCompanyOptions,
      ]
    );

  const resetForm =
    useCallback(
      (
        employee = null
      ) => {
        setFormData(
          createInitialEmployeeFormData(
            employee
          )
        );

        setErrors(
          createInitialErrors()
        );

        setShowReview(
          false
        );

        setShowDocuments(
          Boolean(
            initialShowDocuments
          )
        );

        setDuplicateConfirmed(
          false
        );

        setDuplicateEmployee(
          null
        );

        setPositionOptions(
          []
        );

        setShowSuggestions(
          false
        );

        setDeploymentOptionsError(
          ""
        );

        setDragTargetDocument(
          ""
        );

        setIsSaving(
          false
        );

        setSaveError(
          ""
        );
      },
      [
        initialShowDocuments,
      ]
    );

  /*
   * ==================================================
   * LOAD ACTIVE COMPANY MASTER OPTIONS
   * ==================================================
   */
  useEffect(
    () => {
      companyOptionsAbortRef
        .current
        ?.abort();

      const controller =
        new AbortController();

      companyOptionsAbortRef.current =
        controller;

      const loadCompanies =
        async () => {
          try {
            setIsLoadingCompanies(
              true
            );

            setDeploymentOptionsError(
              ""
            );

            const {
              data,
            } =
              await axios.get(
                DEPLOYMENT_COMPANY_OPTIONS_URL,
                {
                  timeout:
                    REQUEST_TIMEOUT_MS,

                  signal:
                    controller.signal,
                }
              );

            if (
              controller.signal
                .aborted
            ) {
              return;
            }

            const rawCompanies =
              Array.isArray(
                data?.companies
              )
                ? data.companies
                : [];

            const normalizedCompanies =
              deduplicateOptions(
                rawCompanies
                  .map(
                    normalizeCompanyOption
                  )
                  .filter(
                    Boolean
                  )
              );

            setCompanyOptions(
              normalizedCompanies
            );
          } catch (
            error
          ) {
            if (
              isCanceledRequest(
                error
              )
            ) {
              return;
            }

            console.error(
              "EMPLOYEE COMPANY OPTIONS ERROR:",
              error
            );

            setCompanyOptions(
              []
            );

            setDeploymentOptionsError(
              getEmployeeApiError(
                error,
                "Unable to load active client companies."
              )
            );
          } finally {
            if (
              companyOptionsAbortRef
                .current ===
              controller
            ) {
              companyOptionsAbortRef.current =
                null;

              setIsLoadingCompanies(
                false
              );
            }
          }
        };

      void loadCompanies();

      return () => {
        controller.abort();

        if (
          companyOptionsAbortRef
            .current ===
          controller
        ) {
          companyOptionsAbortRef.current =
            null;
        }
      };
    },
    []
  );

  /*
   * ==================================================
   * LOAD COMPANY-SPECIFIC ACTIVE POSITIONS
   * ==================================================
   */
  useEffect(
    () => {
      positionOptionsAbortRef
        .current
        ?.abort();

      positionOptionsAbortRef.current =
        null;

      const selectedCompany =
        String(
          formData?.company ||
            ""
        ).trim();

      if (
        !selectedCompany
      ) {
        setPositionOptions(
          []
        );

        setIsLoadingPositions(
          false
        );

        return undefined;
      }

      /*
       * If the current edit assignment uses a company
       * that is no longer active, the operational API
       * intentionally returns 404.
       *
       * In that case we preserve the historical
       * company + position locally instead of treating
       * the old assignment as invalid.
       */
      const selectedCompanyOption =
        visibleCompanyOptions.find(
          (option) =>
            valuesMatch(
              option.name,
              selectedCompany
            )
        );

      if (
        selectedCompanyOption
          ?.isHistorical
      ) {
        setPositionOptions(
          []
        );

        setIsLoadingPositions(
          false
        );

        setDeploymentOptionsError(
          ""
        );

        return undefined;
      }

      const controller =
        new AbortController();

      positionOptionsAbortRef.current =
        controller;

      const loadPositions =
        async () => {
          try {
            setIsLoadingPositions(
              true
            );

            setDeploymentOptionsError(
              ""
            );

            const {
              data,
            } =
              await axios.get(
                DEPLOYMENT_POSITION_OPTIONS_URL,
                {
                  timeout:
                    REQUEST_TIMEOUT_MS,

                  signal:
                    controller.signal,

                  params: {
                    company:
                      selectedCompany,
                  },
                }
              );

            if (
              controller.signal
                .aborted
            ) {
              return;
            }

            const rawPositions =
              Array.isArray(
                data?.positions
              )
                ? data.positions
                : [];

            const normalizedPositions =
              deduplicateOptions(
                rawPositions
                  .map(
                    normalizePositionOption
                  )
                  .filter(
                    Boolean
                  )
              );

            setPositionOptions(
              normalizedPositions
            );
          } catch (
            error
          ) {
            if (
              isCanceledRequest(
                error
              )
            ) {
              return;
            }

            console.error(
              "EMPLOYEE POSITION OPTIONS ERROR:",
              error
            );

            setPositionOptions(
              []
            );

            setDeploymentOptionsError(
              getEmployeeApiError(
                error,
                "Unable to load positions for the selected company."
              )
            );
          } finally {
            if (
              positionOptionsAbortRef
                .current ===
              controller
            ) {
              positionOptionsAbortRef.current =
                null;

              setIsLoadingPositions(
                false
              );
            }
          }
        };

      void loadPositions();

      return () => {
        controller.abort();

        if (
          positionOptionsAbortRef
            .current ===
          controller
        ) {
          positionOptionsAbortRef.current =
            null;
        }
      };
    },
    [
      formData?.company,
      formData?.status,
      visibleCompanyOptions,
    ]
  );

  useEffect(
    () => {
      return () => {
        if (
          companyBlurTimerRef.current
        ) {
          window.clearTimeout(
            companyBlurTimerRef.current
          );
        }

        if (
          duplicateLookupTimerRef.current
        ) {
          window.clearTimeout(
            duplicateLookupTimerRef.current
          );
        }

        duplicateLookupAbortRef
          .current
          ?.abort();

        companyOptionsAbortRef
          .current
          ?.abort();

        positionOptionsAbortRef
          .current
          ?.abort();
      };
    },
    []
  );

  const lookupDuplicateEmployee =
    useCallback(
      async (
        employeeName,
        signal
      ) => {
        const normalizedName =
          String(
            employeeName ||
              ""
          )
            .trim()
            .replace(
              /\s+/g,
              " "
            );

        if (!normalizedName) {
          return null;
        }

        const params = {
          name:
            normalizedName,
        };

        if (
          initialEmployee &&
          employeeId
        ) {
          params.excludeId =
            employeeId;
        }

        const {
          data,
        } =
          await axios.get(
            `${EMPLOYEE_API_URL}/form-meta`,
            {
              params,
              signal,
            }
          );

        return (
          data?.duplicateEmployee ||
          null
        );
      },
      [
        employeeId,
        initialEmployee,
      ]
    );

  useEffect(
    () => {
      if (
        duplicateLookupTimerRef.current
      ) {
        window.clearTimeout(
          duplicateLookupTimerRef.current
        );

        duplicateLookupTimerRef.current =
          null;
      }

      duplicateLookupAbortRef
        .current
        ?.abort();

      duplicateLookupAbortRef.current =
        null;

      const employeeName =
        String(
          formData.name ||
            ""
        )
          .trim()
          .replace(
            /\s+/g,
            " "
          );

      if (!employeeName) {
        return undefined;
      }

      duplicateLookupTimerRef.current =
        window.setTimeout(
          () => {
            const controller =
              new AbortController();

            duplicateLookupAbortRef.current =
              controller;

            void lookupDuplicateEmployee(
              employeeName,
              controller.signal
            )
              .then(
                (
                  matchedEmployee
                ) => {
                  if (
                    !controller.signal
                      .aborted
                  ) {
                    setDuplicateEmployee(
                      matchedEmployee
                    );
                  }
                }
              )
              .catch(
                (
                  error
                ) => {
                  if (
                    !isCanceledRequest(
                      error
                    )
                  ) {
                    console.error(
                      "EMPLOYEE DUPLICATE LOOKUP ERROR:",
                      error
                    );
                  }
                }
              )
              .finally(
                () => {
                  if (
                    duplicateLookupAbortRef
                      .current ===
                    controller
                  ) {
                    duplicateLookupAbortRef.current =
                      null;
                  }
                }
              );
          },
          DUPLICATE_LOOKUP_DEBOUNCE_MS
        );

      return () => {
        if (
          duplicateLookupTimerRef.current
        ) {
          window.clearTimeout(
            duplicateLookupTimerRef.current
          );

          duplicateLookupTimerRef.current =
            null;
        }

        duplicateLookupAbortRef
          .current
          ?.abort();

        duplicateLookupAbortRef.current =
          null;
      };
    },
    [
      formData.name,
      lookupDuplicateEmployee,
    ]
  );

  const completedDocuments =
    useMemo(
      () =>
        getCompletedDocuments(
          formData.documents
        ),
      [
        formData.documents,
      ]
    );

  const completion =
    useMemo(
      () =>
        calculateEmployeeFormCompletion(
          formData
        ),
      [
        formData,
      ]
    );

  const complianceWarning =
    useMemo(
      () =>
        getComplianceReviewWarning(
          formData
        ),
      [
        formData,
      ]
    );

  const remainingDocuments =
    Math.max(
      DOCUMENT_OPTIONS.length -
        completedDocuments.length,
      0
    );

  const clearFieldError =
    useCallback(
      (
        fieldName
      ) => {
        setErrors(
          (
            currentErrors
          ) => ({
            ...currentErrors,

            [fieldName]:
              "",
          })
        );
      },
      []
    );

  const clearDocumentError =
    useCallback(
      (
        documentName
      ) => {
        setErrors(
          (
            currentErrors
          ) => ({
            ...currentErrors,

            documents: {
              ...currentErrors.documents,

              [documentName]:
                "",

              [`${documentName}_file`]:
                "",

              [`${documentName}_number`]:
                "",

              general:
                "",
            },
          })
        );
      },
      []
    );

  const handleChange =
    useCallback(
      (
        event
      ) => {
        const {
          name,
          value,
        } =
          event.target;

        setSaveError(
          ""
        );

        if (
          name ===
          "status"
        ) {
          /*
           * Edit Employee is not a workforce-transition
           * endpoint. Existing records keep their current
           * canonical workflow state here.
           */
          if (
            initialEmployee
          ) {
            return;
          }

          /*
           * New employee onboarding supports only:
           * - Floating / Standby (Pooling)
           * - Already Deployed
           *
           * For Deployment is created only by the
           * deployment scheduling workflow.
           */
          if (
            ![
              "Floating / Standby",
              "Deployed",
            ].includes(
              value
            )
          ) {
            return;
          }

          const isDeployed =
            value ===
            "Deployed";

          setFormData(
            (
              currentData
            ) => ({
              ...currentData,

              status:
                value,

              /*
               * Company + position are employee-level
               * designation fields, so Pooling keeps them.
               */
              company:
                currentData.company,

              position:
                currentData.position,

              /*
               * Actual deployment start applies only to
               * an already/currently Deployed employee.
               */
              contractStart:
                isDeployed
                  ? currentData.contractStart
                  : "",
            })
          );

          setErrors(
            (
              currentErrors
            ) => ({
              ...currentErrors,

              status:
                "",

              company:
                "",

              position:
                "",

              contractStart:
                "",
            })
          );

          setShowSuggestions(
            false
          );

          setDeploymentOptionsError(
            ""
          );

          return;
        }

        if (
          name ===
          "company"
        ) {
          /*
           * For Deployment and Deployed placement is
           * controlled by the dedicated deployment
           * workflow. Keep this hook fail-closed even
           * if a programmatic event bypasses the UI.
           */
          if (
            isEditPlacementLocked
          ) {
            return;
          }

          setFormData(
            (
              currentData
            ) => {
              const companyChanged =
                !valuesMatch(
                  currentData.company,
                  value
                );

              return {
                ...currentData,

                company:
                  value,

                position:
                  companyChanged
                    ? ""
                    : currentData.position,
              };
            }
          );

          setErrors(
            (
              currentErrors
            ) => ({
              ...currentErrors,

              company:
                "",

              position:
                "",
            })
          );

          setPositionOptions(
            []
          );

          setDeploymentOptionsError(
            ""
          );

          setShowSuggestions(
            true
          );

          return;
        }

        if (
          name ===
          "position"
        ) {
          if (
            isEditPlacementLocked
          ) {
            return;
          }

          setFormData(
            (
              currentData
            ) => ({
              ...currentData,

              position:
                value,
            })
          );

          setErrors(
            (
              currentErrors
            ) => ({
              ...currentErrors,

              position:
                "",
            })
          );

          setDeploymentOptionsError(
            ""
          );

          return;
        }

        setFormData(
          (
            currentData
          ) => ({
            ...currentData,

            [name]:
              value,
          })
        );

        if (
          name ===
          "name"
        ) {
          setDuplicateConfirmed(
            false
          );

          setDuplicateEmployee(
            null
          );

          setErrors(
            (
              currentErrors
            ) => ({
              ...currentErrors,

              name:
                "",

              duplicateConfirm:
                "",
            })
          );

          return;
        }

        clearFieldError(
          name
        );
      },
      [
        clearFieldError,
        initialEmployee,
        isEditPlacementLocked,
      ]
    );

  const handleNameBlur =
    useCallback(
      () => {
        setFormData(
          (
            currentData
          ) => ({
            ...currentData,

            name:
              toProperName(
                currentData.name
              ),
          })
        );
      },
      []
    );

  /*
   * Compatibility handlers retained for older
   * company-autocomplete consumers.
   */
  const handleCompanyFocus =
    useCallback(
      () => {
        if (
          companyBlurTimerRef.current
        ) {
          window.clearTimeout(
            companyBlurTimerRef.current
          );

          companyBlurTimerRef.current =
            null;
        }

        setShowSuggestions(
          true
        );
      },
      []
    );

  const handleCompanyBlur =
    useCallback(
      () => {
        if (
          companyBlurTimerRef.current
        ) {
          window.clearTimeout(
            companyBlurTimerRef.current
          );
        }

        companyBlurTimerRef.current =
          window.setTimeout(
            () => {
              setShowSuggestions(
                false
              );

              companyBlurTimerRef.current =
                null;
            },
            150
          );
      },
      []
    );

  const handleCompanySelect =
    useCallback(
      (
        company
      ) => {
        if (
          isEditPlacementLocked
        ) {
          return;
        }

        if (
          companyBlurTimerRef.current
        ) {
          window.clearTimeout(
            companyBlurTimerRef.current
          );

          companyBlurTimerRef.current =
            null;
        }

        setFormData(
          (
            currentData
          ) => {
            const companyChanged =
              !valuesMatch(
                currentData.company,
                company
              );

            return {
              ...currentData,

              company,

              position:
                companyChanged
                  ? ""
                  : currentData.position,
            };
          }
        );

        setErrors(
          (
            currentErrors
          ) => ({
            ...currentErrors,

            company:
              "",

            position:
              "",
          })
        );

        setPositionOptions(
          []
        );

        setShowSuggestions(
          false
        );

        setDeploymentOptionsError(
          ""
        );

        setSaveError(
          ""
        );
      },
      [
        isEditPlacementLocked,
      ]
    );

  const handleDuplicateConfirmChange =
    useCallback(
      (
        checked
      ) => {
        setDuplicateConfirmed(
          checked
        );

        setErrors(
          (
            currentErrors
          ) => ({
            ...currentErrors,

            duplicateConfirm:
              "",
          })
        );
      },
      []
    );

  const handleDocumentCheck =
    useCallback(
      (
        documentName
      ) => {
        setFormData(
          (
            currentData
          ) => ({
            ...currentData,

            documents:
              currentData.documents.map(
                (
                  document
                ) => {
                  if (
                    document.name !==
                    documentName
                  ) {
                    return document;
                  }

                  const checked =
                    !document.checked;

                  return {
                    ...document,

                    checked,

                    expirationDate:
                      checked
                        ? document.expirationDate
                        : "",

                    documentNumber:
                      checked
                        ? document.documentNumber
                        : "",

                    file:
                      checked
                        ? document.file
                        : null,

                    filePath:
                      checked
                        ? document.filePath
                        : "",
                  };
                }
              ),
          })
        );

        clearDocumentError(
          documentName
        );

        setSaveError(
          ""
        );
      },
      [
        clearDocumentError,
      ]
    );

  const handleDocumentNumberChange =
    useCallback(
      (
        documentName,
        documentNumber
      ) => {
        setFormData(
          (
            currentData
          ) => ({
            ...currentData,

            documents:
              currentData.documents.map(
                (
                  document
                ) =>
                  document.name ===
                  documentName
                    ? {
                        ...document,

                        documentNumber,
                      }
                    : document
              ),
          })
        );

        clearDocumentError(
          documentName
        );

        setSaveError(
          ""
        );
      },
      [
        clearDocumentError,
      ]
    );

  const handleExpirationChange =
    useCallback(
      (
        documentName,
        expirationDate
      ) => {
        setFormData(
          (
            currentData
          ) => ({
            ...currentData,

            documents:
              currentData.documents.map(
                (
                  document
                ) =>
                  document.name ===
                  documentName
                    ? {
                        ...document,

                        expirationDate,
                      }
                    : document
              ),
          })
        );

        clearDocumentError(
          documentName
        );

        setSaveError(
          ""
        );
      },
      [
        clearDocumentError,
      ]
    );

  const handleFileSelect =
    useCallback(
      (
        documentName,
        file
      ) => {
        if (!file) {
          return;
        }

        const validationError =
          validateEmployeeDocumentFile(
            file
          );

        if (
          validationError
        ) {
          setErrors(
            (
              currentErrors
            ) => ({
              ...currentErrors,

              documents: {
                ...currentErrors.documents,

                [`${documentName}_file`]:
                  validationError,
              },
            })
          );

          return;
        }

        setFormData(
          (
            currentData
          ) => ({
            ...currentData,

            documents:
              currentData.documents.map(
                (
                  document
                ) =>
                  document.name ===
                  documentName
                    ? {
                        ...document,

                        checked:
                          true,

                        file,

                        filePath:
                          "",
                      }
                    : document
              ),
          })
        );

        clearDocumentError(
          documentName
        );

        setSaveError(
          ""
        );
      },
      [
        clearDocumentError,
      ]
    );

  const handleDragEnter =
    useCallback(
      (
        event,
        documentName
      ) => {
        event.preventDefault();
        event.stopPropagation();

        setDragTargetDocument(
          documentName
        );
      },
      []
    );

  const handleDragOver =
    useCallback(
      (
        event,
        documentName
      ) => {
        event.preventDefault();
        event.stopPropagation();

        setDragTargetDocument(
          documentName
        );
      },
      []
    );

  const handleDragLeave =
    useCallback(
      (
        event
      ) => {
        event.preventDefault();
        event.stopPropagation();

        const relatedTarget =
          event.relatedTarget;

        if (
          !relatedTarget ||
          !event.currentTarget.contains(
            relatedTarget
          )
        ) {
          setDragTargetDocument(
            ""
          );
        }
      },
      []
    );

  const handleFileDrop =
    useCallback(
      (
        event,
        documentName
      ) => {
        event.preventDefault();
        event.stopPropagation();

        setDragTargetDocument(
          ""
        );

        const file =
          event.dataTransfer
            ?.files?.[0];

        if (file) {
          handleFileSelect(
            documentName,
            file
          );
        }
      },
      [
        handleFileSelect,
      ]
    );

  const openDocuments =
    useCallback(
      () => {
        setShowDocuments(
          true
        );
      },
      []
    );

  const handleToggleDocuments =
    useCallback(
      () => {
        setShowDocuments(
          (
            currentValue
          ) =>
            !currentValue
        );
      },
      []
    );

  const handleSubmit =
    useCallback(
      async (
        event
      ) => {
        event.preventDefault();

        setSaveError(
          ""
        );

        if (
          duplicateLookupTimerRef.current
        ) {
          window.clearTimeout(
            duplicateLookupTimerRef.current
          );

          duplicateLookupTimerRef.current =
            null;
        }

        duplicateLookupAbortRef
          .current
          ?.abort();

        duplicateLookupAbortRef.current =
          null;

        let verifiedDuplicateEmployee =
          null;

        try {
          verifiedDuplicateEmployee =
            await lookupDuplicateEmployee(
              formData.name
            );

          setDuplicateEmployee(
            verifiedDuplicateEmployee
          );
        } catch (
          error
        ) {
          console.error(
            "EMPLOYEE DUPLICATE VERIFICATION ERROR:",
            error
          );

          setSaveError(
            getEmployeeApiError(
              error,
              "Unable to verify possible duplicate employee records."
            )
          );

          return false;
        }

        const validationResult =
          validateEmployeeForm({
            formData,
            employees,
            employeeId,

            excludedEmployeeId:
              initialEmployee
                ? employeeId
                : "",

            duplicateEmployee:
              verifiedDuplicateEmployee,

            duplicateConfirmed,
          });

        setErrors(
          validationResult.errors
        );

        if (
          !validationResult.isValid
        ) {
          if (
            Object.keys(
              validationResult
                .errors
                .documents ||
                {}
            ).length >
            0
          ) {
            setShowDocuments(
              true
            );
          }

          return false;
        }

        /*
         * Option-loading failures should not silently
         * permit a new deployment selection.
         *
         * Historical edit values remain allowed by
         * the backend when they are unchanged.
         */
        if (
          deploymentOptionsError
        ) {
          const placementIsUnchangedHistorical =
            Boolean(
              initialEmployee
            ) &&
            initialCompany &&
            initialPosition &&
            valuesMatch(
              formData.company,
              initialCompany
            ) &&
            valuesMatch(
              formData.position,
              initialPosition
            );

          if (
            !placementIsUnchangedHistorical
          ) {
            setSaveError(
              deploymentOptionsError
            );

            return false;
          }
        }

        setShowReview(
          true
        );

        return true;
      },
      [
        deploymentOptionsError,
        duplicateConfirmed,
        employeeId,
        employees,
        formData,
        initialCompany,
        initialEmployee,
        initialPosition,
        lookupDuplicateEmployee,
      ]
    );

  const handleCloseReview =
    useCallback(
      () => {
        if (!isSaving) {
          setShowReview(
            false
          );
        }
      },
      [
        isSaving,
      ]
    );

  return {
    formData,
    errors,
    showReview,
    showDocuments,
    duplicateConfirmed,
    duplicateEmployee,

    /*
     * New managed master-data props.
     */
    companyOptions:
      visibleCompanyOptions,

    positionOptions:
      visiblePositionOptions,

    isLoadingCompanies,
    isLoadingPositions,
    deploymentOptionsError,

    /*
     * Legacy compatibility props for older consumers.
     */
    filteredCompanies,
    showSuggestions,

    dragTargetDocument,
    completedDocuments,
    completion,
    complianceWarning,
    remainingDocuments,
    isSaving,
    saveError,

    setIsSaving,
    setSaveError,
    setShowReview,
    resetForm,

    handleChange,
    handleNameBlur,
    handleCompanyFocus,
    handleCompanyBlur,
    handleCompanySelect,
    handleDuplicateConfirmChange,
    handleDocumentCheck,
    handleDocumentNumberChange,
    handleExpirationChange,
    handleFileSelect,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleFileDrop,
    openDocuments,
    handleToggleDocuments,
    handleSubmit,
    handleCloseReview,
  };
}