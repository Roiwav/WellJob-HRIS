// frontend/src/hooks/employees/useEmployeeForm.js

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  COMPANY_OPTIONS,
  DOCUMENT_OPTIONS,
  toProperName,
} from "../../components/employees/employeeConstants";

import {
  INITIAL_EMPLOYEE_FORM_ERRORS,
  calculateEmployeeFormCompletion,
  createInitialEmployeeFormData,
  findDuplicateEmployee,
  getCompletedDocuments,
  getComplianceReviewWarning,
  validateEmployeeDocumentFile,
  validateEmployeeForm,
} from "../../utils/employees/employeeFormHelpers";

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
  const [filteredCompanies, setFilteredCompanies] =
    useState(COMPANY_OPTIONS);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [dragTargetDocument, setDragTargetDocument] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const companyBlurTimerRef = useRef(null);

  const resetForm = useCallback((employee = null) => {
    setFormData(createInitialEmployeeFormData(employee));
    setErrors(createInitialErrors());
    setShowReview(false);
    setShowDocuments(false);
    setDuplicateConfirmed(false);
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
    };
  }, []);

  const duplicateEmployee = useMemo(
    () =>
      findDuplicateEmployee({
        employees,
        employeeName: formData.name,
        excludedEmployeeId: employeeId,
      }),
    [employeeId, employees, formData.name]
  );

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
    (event) => {
      event.preventDefault();
      setSaveError("");

      const validationResult = validateEmployeeForm({
        formData,
        employees,
        employeeId,
        excludedEmployeeId: initialEmployee
          ? employeeId
          : "",
        duplicateEmployee,
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
      duplicateEmployee,
      employeeId,
      employees,
      formData,
      initialEmployee,
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