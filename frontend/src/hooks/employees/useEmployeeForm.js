import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import axios from "axios";

import {
  COMPANY_OPTIONS,
  DOCUMENT_OPTIONS,
  toProperName,
} from "../../components/employees/employeeConstants";

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

function createInitialErrors() {
  return {
    ...INITIAL_EMPLOYEE_FORM_ERRORS,
    documents: {},
  };
}

function filterCompanies(value = "") {
  const normalizedValue = String(value)
    .trim()
    .toLowerCase();

  if (!normalizedValue) {
    return COMPANY_OPTIONS;
  }

  return COMPANY_OPTIONS.filter((company) =>
    company.toLowerCase().includes(normalizedValue)
  );
}

export default function useEmployeeForm({
  initialEmployee = null,
  employeeId = "",
  employees = [],
} = {}) {
  const [formData, setFormData] = useState(() =>
    createInitialEmployeeFormData(initialEmployee)
  );

  const [errors, setErrors] = useState(createInitialErrors);
  const [showReview, setShowReview] = useState(false);
  const [showDocuments, setShowDocuments] = useState(false);
  const [duplicateConfirmed, setDuplicateConfirmed] = useState(false);
  const [duplicateEmployee, setDuplicateEmployee] = useState(null);
  const [filteredCompanies, setFilteredCompanies] =
    useState(COMPANY_OPTIONS);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [dragTargetDocument, setDragTargetDocument] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const companyBlurTimerRef = useRef(null);
  const duplicateLookupTimerRef = useRef(null);
  const duplicateLookupAbortRef = useRef(null);

  const resetForm = useCallback((employee = null) => {
    setFormData(createInitialEmployeeFormData(employee));
    setErrors(createInitialErrors());
    setShowReview(false);
    setShowDocuments(false);
    setDuplicateConfirmed(false);
    setDuplicateEmployee(null);
    setFilteredCompanies(COMPANY_OPTIONS);
    setShowSuggestions(false);
    setDragTargetDocument("");
    setIsSaving(false);
    setSaveError("");
  }, []);


  useEffect(() => {
    return () => {
      if (companyBlurTimerRef.current) {
        window.clearTimeout(companyBlurTimerRef.current);
      }

      if (duplicateLookupTimerRef.current) {
        window.clearTimeout(duplicateLookupTimerRef.current);
      }

      duplicateLookupAbortRef.current?.abort();
    };
  }, []);

  const lookupDuplicateEmployee = useCallback(
    async (employeeName, signal) => {
      const normalizedName = String(employeeName || "")
        .trim()
        .replace(/\s+/g, " ");

      if (!normalizedName) {
        return null;
      }

      const params = {
        name: normalizedName,
      };

      if (initialEmployee && employeeId) {
        params.excludeId = employeeId;
      }

      const { data } = await axios.get(
        `${EMPLOYEE_API_URL}/form-meta`,
        {
          params,
          signal,
        }
      );

      return data?.duplicateEmployee || null;
    },
    [employeeId, initialEmployee]
  );

  useEffect(() => {
    if (duplicateLookupTimerRef.current) {
      window.clearTimeout(duplicateLookupTimerRef.current);
      duplicateLookupTimerRef.current = null;
    }

    duplicateLookupAbortRef.current?.abort();
    duplicateLookupAbortRef.current = null;

    const employeeName = String(formData.name || "")
      .trim()
      .replace(/\s+/g, " ");

    if (!employeeName) {
      return undefined;
    }

    duplicateLookupTimerRef.current = window.setTimeout(() => {
      const controller = new AbortController();

      duplicateLookupAbortRef.current = controller;

      void lookupDuplicateEmployee(
        employeeName,
        controller.signal
      )
        .then((matchedEmployee) => {
          if (!controller.signal.aborted) {
            setDuplicateEmployee(matchedEmployee);
          }
        })
        .catch((error) => {
          if (
            error?.code !== "ERR_CANCELED" &&
            error?.name !== "CanceledError" &&
            error?.name !== "AbortError"
          ) {
            console.error(
              "EMPLOYEE DUPLICATE LOOKUP ERROR:",
              error
            );
          }
        })
        .finally(() => {
          if (duplicateLookupAbortRef.current === controller) {
            duplicateLookupAbortRef.current = null;
          }
        });
    }, DUPLICATE_LOOKUP_DEBOUNCE_MS);

    return () => {
      if (duplicateLookupTimerRef.current) {
        window.clearTimeout(duplicateLookupTimerRef.current);
        duplicateLookupTimerRef.current = null;
      }

      duplicateLookupAbortRef.current?.abort();
      duplicateLookupAbortRef.current = null;
    };
  }, [formData.name, lookupDuplicateEmployee]);

  const completedDocuments = useMemo(
    () => getCompletedDocuments(formData.documents),
    [formData.documents]
  );

  const completion = useMemo(
    () => calculateEmployeeFormCompletion(formData),
    [formData]
  );

  const complianceWarning = useMemo(
    () => getComplianceReviewWarning(formData),
    [formData]
  );

  const remainingDocuments = Math.max(
    DOCUMENT_OPTIONS.length - completedDocuments.length,
    0
  );

  const clearFieldError = useCallback((fieldName) => {
    setErrors((currentErrors) => ({
      ...currentErrors,
      [fieldName]: "",
    }));
  }, []);

  const clearDocumentError = useCallback((documentName) => {
    setErrors((currentErrors) => ({
      ...currentErrors,
      documents: {
        ...currentErrors.documents,
        [documentName]: "",
        [`${documentName}_file`]: "",
        general: "",
      },
    }));
  }, []);

  const handleChange = useCallback(
    (event) => {
      const { name, value } = event.target;

      setSaveError("");

      if (name === "status") {
        const isDeployed = value === "Deployed";

        setFormData((currentData) => ({
          ...currentData,
          status: value,
          company: isDeployed ? currentData.company : "",
          contractStart: isDeployed
            ? currentData.contractStart
            : "",
        }));

        setErrors((currentErrors) => ({
          ...currentErrors,
          company: "",
          contractStart: "",
        }));

        setFilteredCompanies(COMPANY_OPTIONS);
        setShowSuggestions(false);
        return;
      }

      setFormData((currentData) => ({
        ...currentData,
        [name]: value,
      }));

      if (name === "name") {
        setDuplicateConfirmed(false);
        setDuplicateEmployee(null);

        setErrors((currentErrors) => ({
          ...currentErrors,
          name: "",
          duplicateConfirm: "",
        }));

        return;
      }

      if (name === "company") {
        setFilteredCompanies(filterCompanies(value));
        setShowSuggestions(true);
      }

      clearFieldError(name);
    },
    [clearFieldError]
  );

  const handleNameBlur = useCallback(() => {
    setFormData((currentData) => ({
      ...currentData,
      name: toProperName(currentData.name),
    }));
  }, []);

  const handleCompanyFocus = useCallback(() => {
    if (companyBlurTimerRef.current) {
      window.clearTimeout(companyBlurTimerRef.current);
      companyBlurTimerRef.current = null;
    }

    setFilteredCompanies(filterCompanies(formData.company));
    setShowSuggestions(true);
  }, [formData.company]);

  const handleCompanyBlur = useCallback(() => {
    if (companyBlurTimerRef.current) {
      window.clearTimeout(companyBlurTimerRef.current);
    }

    companyBlurTimerRef.current = window.setTimeout(() => {
      setShowSuggestions(false);
      companyBlurTimerRef.current = null;
    }, 150);
  }, []);

  const handleCompanySelect = useCallback((company) => {
    if (companyBlurTimerRef.current) {
      window.clearTimeout(companyBlurTimerRef.current);
      companyBlurTimerRef.current = null;
    }

    setFormData((currentData) => ({
      ...currentData,
      company,
    }));

    setErrors((currentErrors) => ({
      ...currentErrors,
      company: "",
    }));

    setFilteredCompanies(filterCompanies(company));
    setShowSuggestions(false);
    setSaveError("");
  }, []);

  const handleDuplicateConfirmChange = useCallback((checked) => {
    setDuplicateConfirmed(checked);

    setErrors((currentErrors) => ({
      ...currentErrors,
      duplicateConfirm: "",
    }));
  }, []);

  const handleDocumentCheck = useCallback(
    (documentName) => {
      setFormData((currentData) => ({
        ...currentData,
        documents: currentData.documents.map((document) => {
          if (document.name !== documentName) {
            return document;
          }

          const checked = !document.checked;

          return {
            ...document,
            checked,
            expirationDate: checked
              ? document.expirationDate
              : "",
            file: checked ? document.file : null,
            filePath: checked ? document.filePath : "",
          };
        }),
      }));

      clearDocumentError(documentName);
      setSaveError("");
    },
    [clearDocumentError]
  );

  const handleExpirationChange = useCallback(
    (documentName, expirationDate) => {
      setFormData((currentData) => ({
        ...currentData,
        documents: currentData.documents.map((document) =>
          document.name === documentName
            ? {
                ...document,
                expirationDate,
              }
            : document
        ),
      }));

      clearDocumentError(documentName);
      setSaveError("");
    },
    [clearDocumentError]
  );

  const handleFileSelect = useCallback(
    (documentName, file) => {
      if (!file) {
        return;
      }

      const validationError =
        validateEmployeeDocumentFile(file);

      if (validationError) {
        setErrors((currentErrors) => ({
          ...currentErrors,
          documents: {
            ...currentErrors.documents,
            [`${documentName}_file`]: validationError,
          },
        }));

        return;
      }

      setFormData((currentData) => ({
        ...currentData,
        documents: currentData.documents.map((document) =>
          document.name === documentName
            ? {
                ...document,
                checked: true,
                file,
                filePath: "",
              }
            : document
        ),
      }));

      clearDocumentError(documentName);
      setSaveError("");
    },
    [clearDocumentError]
  );

  const handleDragEnter = useCallback((event, documentName) => {
    event.preventDefault();
    event.stopPropagation();
    setDragTargetDocument(documentName);
  }, []);

  const handleDragOver = useCallback((event, documentName) => {
    event.preventDefault();
    event.stopPropagation();
    setDragTargetDocument(documentName);
  }, []);

  const handleDragLeave = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();

    const relatedTarget = event.relatedTarget;

    if (
      !relatedTarget ||
      !event.currentTarget.contains(relatedTarget)
    ) {
      setDragTargetDocument("");
    }
  }, []);

  const handleFileDrop = useCallback(
    (event, documentName) => {
      event.preventDefault();
      event.stopPropagation();
      setDragTargetDocument("");

      const file = event.dataTransfer?.files?.[0];

      if (file) {
        handleFileSelect(documentName, file);
      }
    },
    [handleFileSelect]
  );

  const handleToggleDocuments = useCallback(() => {
    setShowDocuments((currentValue) => !currentValue);
  }, []);

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      setSaveError("");

      if (duplicateLookupTimerRef.current) {
        window.clearTimeout(duplicateLookupTimerRef.current);
        duplicateLookupTimerRef.current = null;
      }

      duplicateLookupAbortRef.current?.abort();
      duplicateLookupAbortRef.current = null;

      let verifiedDuplicateEmployee = null;

      try {
        verifiedDuplicateEmployee =
          await lookupDuplicateEmployee(formData.name);

        setDuplicateEmployee(
          verifiedDuplicateEmployee
        );
      } catch (error) {
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

      const validationResult = validateEmployeeForm({
        formData,
        employees,
        employeeId,
        excludedEmployeeId: initialEmployee
          ? employeeId
          : "",
        duplicateEmployee:
          verifiedDuplicateEmployee,
        duplicateConfirmed,
      });

      setErrors(validationResult.errors);

      if (!validationResult.isValid) {
        if (
          Object.keys(
            validationResult.errors.documents || {}
          ).length > 0
        ) {
          setShowDocuments(true);
        }

        return false;
      }

      setShowReview(true);
      return true;
    },
    [
      duplicateConfirmed,
      employeeId,
      employees,
      formData,
      initialEmployee,
      lookupDuplicateEmployee,
    ]
  );

  const handleCloseReview = useCallback(() => {
    if (!isSaving) {
      setShowReview(false);
    }
  }, [isSaving]);

  return {
    formData,
    errors,
    showReview,
    showDocuments,
    duplicateConfirmed,
    duplicateEmployee,
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
    handleExpirationChange,
    handleFileSelect,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleFileDrop,
    handleToggleDocuments,
    handleSubmit,
    handleCloseReview,
  };
}