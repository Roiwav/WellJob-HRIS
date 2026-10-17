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
  FiCamera,
  FiCheckCircle,
  FiChevronLeft,
  FiFileText,
  FiHash,
  FiPaperclip,
  FiSearch,
  FiShield,
  FiSmartphone,
  FiTrash2,
  FiUser,
  FiX,
} from "react-icons/fi";

import {
  QRCodeSVG,
} from "qrcode.react";

import useViolationPolicyOptions from "../../../hooks/useViolationPolicyOptions";

import authenticatedFetch from "../../../utils/authenticatedFetch";
import { API_BASE } from "../../../config/api";

import {
  computeAutoSeverity,
  getNextOffenseCount,
  getPenaltyByOffense,
  getPenaltyText,
} from "../../../utils/incidentIntelligence";

import {
  buildFinalIncident,
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

import {
  formatFileSize,
} from "../../../utils/incidents/evidenceFiles";

import {
  MAX_INCIDENT_EVIDENCE_FILES,
  mergeIncidentDirectUploads,
  prepareIncidentCreateDirectUploads,
} from "../../../utils/incidents/incidentDirectUpload";

import {
  INCIDENT_PHONE_CAPTURE_PURPOSES,
  INCIDENT_PHONE_CAPTURE_STATUSES,
  cancelIncidentPhoneCaptureSession,
  cancelIncidentPhoneCaptureSessions,
  consumeIncidentPhoneCaptureSessions,
  createIncidentPhoneCaptureSession,
  getIncidentPhoneCaptureSession,
  refreshIncidentPhoneCaptureDirectUploads,
} from "../../../utils/incidents/incidentPhoneCapture";

const INCIDENT_FORM_META_URL =
  `${API_BASE}/incidents/form-meta`;

const INCIDENT_EMPLOYEE_HISTORY_URL =
  `${API_BASE}/incidents/employee`;

const EMPLOYEE_SEARCH_DEBOUNCE_MS =
  350;

const MAX_INCIDENT_EVIDENCE_SIZE =
  5 * 1024 * 1024;

const INCIDENT_EVIDENCE_EXTENSIONS =
  new Set([
    ".pdf",
    ".jpg",
    ".jpeg",
    ".png",
  ]);

const PHONE_CAPTURE_POLL_MS =
  1500;

const EMPTY_ALERT = {
  show: false,
  type: "error",
  title: "",
  message: "",
};

function createIncidentForm(
  existingIncidents
) {
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
}

function getClearedViolationFields() {
  return {
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
    duplicateVerificationNote: "",
  };
}

function getClearedEmployeeFields() {
  return {
    employeeId: "",
    employee: "",
    company: "",
    offenseCount: 1,
    selectedPenalty: null,
    sanction: "",
    severity: "",
    duplicateVerified: false,
    duplicateVerificationNote: "",
  };
}

function getPenaltySearchValue(
  penalty
) {
  if (
    typeof penalty === "string"
  ) {
    return penalty;
  }

  return `${penalty?.label || ""} ${
    penalty?.action || ""
  }`;
}

export default function AddIncidentModal({
  isOpen,
  onClose,
  onSave,
  existingIncidents = [],
}) {
  const violationBoxRef =
    useRef(null);

  const employeeBoxRef =
    useRef(null);

  const employeeInputRef =
    useRef(null);

  const closeTimerRef =
    useRef(null);

  const employeeSearchRequestRef =
    useRef(null);

  const employeeIncidentHistoryRequestRef =
    useRef(null);

  const incidentEvidenceInputRef =
    useRef(null);

  const evidenceFilesRef =
    useRef([]);

  const phoneCapturesRef =
    useRef([]);

  /*
   * Phone sessions listed here are already owned by a
   * successfully saved Incident.
   *
   * They must never be cancelled by modal close/unmount
   * cleanup, even when the follow-up consume bookkeeping
   * request fails.
   */
  const protectedPhoneSessionIdsRef =
    useRef(
      new Set()
    );

  const [
    formData,
    setFormData,
  ] = useState(null);

  const [
    employeeSearch,
    setEmployeeSearch,
  ] = useState("");

  const [
    employeeOptions,
    setEmployeeOptions,
  ] = useState([]);

  const [
    isSearchingEmployees,
    setIsSearchingEmployees,
  ] = useState(false);

  const [
    employeeSearchError,
    setEmployeeSearchError,
  ] = useState("");

  const [
    selectedEmployeeOption,
    setSelectedEmployeeOption,
  ] = useState(null);

  const [
    employeeIncidentHistory,
    setEmployeeIncidentHistory,
  ] = useState([]);

  const [
    isLoadingEmployeeIncidentHistory,
    setIsLoadingEmployeeIncidentHistory,
  ] = useState(false);

  const [
    employeeIncidentHistoryError,
    setEmployeeIncidentHistoryError,
  ] = useState("");

  const [
    violationSearch,
    setViolationSearch,
  ] = useState("");

  const [
    showEmployeeDropdown,
    setShowEmployeeDropdown,
  ] = useState(false);

  const [
    showViolationDropdown,
    setShowViolationDropdown,
  ] = useState(false);

  const [
    isReviewing,
    setIsReviewing,
  ] = useState(false);

  const [
    duplicateConfirmed,
    setDuplicateConfirmed,
  ] = useState(false);

  const [
    isSaving,
    setIsSaving,
  ] = useState(false);

  const [
    customAlert,
    setCustomAlert,
  ] = useState(EMPTY_ALERT);

  const [
    incidentEvidenceFiles,
    setIncidentEvidenceFiles,
  ] = useState([]);

  const [
    phoneCaptures,
    setPhoneCaptures,
  ] = useState([]);

  const [
    activePhoneCaptureSessionId,
    setActivePhoneCaptureSessionId,
  ] = useState("");

  const [
    isStartingPhoneCapture,
    setIsStartingPhoneCapture,
  ] = useState(false);

  const {
    violationOptions,
    violationPolicySource,
    violationPolicyError,
    isLoadingViolationPolicy,
    reloadViolationPolicy,
  } = useViolationPolicyOptions(
    isOpen
  );

  const isViolationPolicyReady =
    !isLoadingViolationPolicy &&
    !violationPolicyError &&
    violationOptions.length > 0;

  const createInitialFormData =
    useCallback(
      () =>
        createIncidentForm(
          existingIncidents
        ),
      [existingIncidents]
    );

  const showCustomAlert =
    useCallback(
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
      setCustomAlert(
        (current) => ({
          ...current,
          show: false,
        })
      );
    }, []);

  const resetDuplicateVerification =
    useCallback(() => {
      setDuplicateConfirmed(
        false
      );
    }, []);

  const handleClose =
    useCallback(() => {
      if (isSaving) {
        return;
      }

      setShowEmployeeDropdown(
        false
      );

      setShowViolationDropdown(
        false
      );

      if (
        employeeIncidentHistoryRequestRef.current
      ) {
        employeeIncidentHistoryRequestRef.current.abort();

        employeeIncidentHistoryRequestRef.current =
          null;
      }

      const protectedSessionIds =
        protectedPhoneSessionIdsRef.current;

      const sessionIds =
        phoneCapturesRef.current
          .map(
            (
              item
            ) =>
              item?.sessionId
          )
          .filter(
            Boolean
          )
          .filter(
            (
              sessionId
            ) =>
              !protectedSessionIds.has(
                sessionId
              )
          );

      if (
        sessionIds.length >
        0
      ) {
        void cancelIncidentPhoneCaptureSessions(
          sessionIds
        );
      }

      for (
        const item of
        evidenceFilesRef.current
      ) {
        if (item?.localUrl) {
          URL.revokeObjectURL(
            item.localUrl
          );
        }
      }

      evidenceFilesRef.current =
        [];

      phoneCapturesRef.current =
        [];

      setIncidentEvidenceFiles(
        []
      );

      setPhoneCaptures(
        []
      );

      setActivePhoneCaptureSessionId(
        ""
      );

      closeCustomAlert();

      onClose();
    }, [
      closeCustomAlert,
      isSaving,
      onClose,
    ]);

  useEffect(() => {
    evidenceFilesRef.current =
      incidentEvidenceFiles;
  }, [
    incidentEvidenceFiles,
  ]);

  useEffect(() => {
    phoneCapturesRef.current =
      phoneCaptures;
  }, [
    phoneCaptures,
  ]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const resetTimerId =
      window.setTimeout(
        () => {
          /*
           * Release any local preview URLs left from a
           * previous unsaved modal instance.
           */
          for (
            const item of
            evidenceFilesRef.current
          ) {
            if (item?.localUrl) {
              URL.revokeObjectURL(
                item.localUrl
              );
            }
          }

          /*
           * Best-effort cancel only temporary sessions
           * left from a previous unsaved modal instance.
           *
           * Sessions protected after a successful Incident
           * save are never cancelled here.
           */
          const protectedSessionIds =
            protectedPhoneSessionIdsRef.current;

          const previousSessionIds =
            phoneCapturesRef.current
              .map(
                (
                  item
                ) =>
                  item?.sessionId
              )
              .filter(
                Boolean
              )
              .filter(
                (
                  sessionId
                ) =>
                  !protectedSessionIds.has(
                    sessionId
                  )
              );

          if (
            previousSessionIds.length >
            0
          ) {
            void cancelIncidentPhoneCaptureSessions(
              previousSessionIds
            );
          }

          /*
           * A newly opened Add Incident form starts with a
           * fresh ownership set.
           */
          protectedPhoneSessionIdsRef.current.clear();

          evidenceFilesRef.current =
            [];

          phoneCapturesRef.current =
            [];

          setFormData(
            createInitialFormData()
          );

          setEmployeeSearch(
            ""
          );

          setEmployeeOptions(
            []
          );

          setIsSearchingEmployees(
            false
          );

          setEmployeeSearchError(
            ""
          );

          setSelectedEmployeeOption(
            null
          );

          setEmployeeIncidentHistory(
            []
          );

          setIsLoadingEmployeeIncidentHistory(
            false
          );

          setEmployeeIncidentHistoryError(
            ""
          );

          setViolationSearch(
            ""
          );

          setShowEmployeeDropdown(
            false
          );

          setShowViolationDropdown(
            false
          );

          setIsReviewing(
            false
          );

          setDuplicateConfirmed(
            false
          );

          setIsSaving(
            false
          );

          setIncidentEvidenceFiles(
            []
          );

          setPhoneCaptures(
            []
          );

          setActivePhoneCaptureSessionId(
            ""
          );

          setIsStartingPhoneCapture(
            false
          );

          if (
            incidentEvidenceInputRef.current
          ) {
            incidentEvidenceInputRef.current.value =
              "";
          }

          closeCustomAlert();
        },
        0
      );

    return () => {
      window.clearTimeout(
        resetTimerId
      );
    };
  }, [
    closeCustomAlert,
    createInitialFormData,
    isOpen,
  ]);

  useEffect(() => {
    /*
     * This ref always points to the same Set instance.
     * Successful phone-session IDs are added with .add()
     * after the Incident save succeeds.
     *
     * Capture the Set reference during effect setup so
     * cleanup uses the same live Set without reading
     * protectedPhoneSessionIdsRef.current inside the
     * cleanup function.
     *
     * This preserves ownership protection and satisfies
     * react-hooks/exhaustive-deps.
     */
    const protectedSessionIds =
      protectedPhoneSessionIdsRef.current;

    return () => {
      if (
        closeTimerRef.current
      ) {
        window.clearTimeout(
          closeTimerRef.current
        );
      }

      if (
        employeeSearchRequestRef.current
      ) {
        employeeSearchRequestRef.current.abort();
      }

      if (
        employeeIncidentHistoryRequestRef.current
      ) {
        employeeIncidentHistoryRequestRef.current.abort();
      }

      for (
        const item of
        evidenceFilesRef.current
      ) {
        if (item?.localUrl) {
          URL.revokeObjectURL(
            item.localUrl
          );
        }
      }

      const sessionIds =
        phoneCapturesRef.current
          .map(
            (
              item
            ) =>
              item?.sessionId
          )
          .filter(
            Boolean
          )
          .filter(
            (
              sessionId
            ) =>
              !protectedSessionIds.has(
                sessionId
              )
          );

      if (
        sessionIds.length >
        0
      ) {
        void cancelIncidentPhoneCaptureSessions(
          sessionIds
        );
      }
    };
  }, []);

  const totalEvidenceSlotsUsed =
    incidentEvidenceFiles.length +
    phoneCaptures.length;

  const completedPhoneCaptures =
    useMemo(
      () =>
        phoneCaptures.filter(
          (
            item
          ) =>
            item?.status ===
              INCIDENT_PHONE_CAPTURE_STATUSES
                .PHOTO_ADDED ||
            item?.status ===
              INCIDENT_PHONE_CAPTURE_STATUSES
                .DONE
        ),
      [
        phoneCaptures,
      ]
    );

  const activePhoneCapture =
    useMemo(
      () =>
        phoneCaptures.find(
          (
            item
          ) =>
            item?.sessionId ===
            activePhoneCaptureSessionId
        ) ||
        null,
      [
        activePhoneCaptureSessionId,
        phoneCaptures,
      ]
    );

  const hasPendingPhoneCapture =
    phoneCaptures.some(
      (
        item
      ) =>
        item?.status ===
          INCIDENT_PHONE_CAPTURE_STATUSES
            .WAITING ||
        item?.status ===
          INCIDENT_PHONE_CAPTURE_STATUSES
            .READY_FOR_UPLOAD
    );

  const removeIncidentEvidenceFile =
    useCallback(
      (
        evidenceId
      ) => {
        setIncidentEvidenceFiles(
          (
            current
          ) => {
            const target =
              current.find(
                (
                  item
                ) =>
                  item.id ===
                  evidenceId
              );

            if (target?.localUrl) {
              URL.revokeObjectURL(
                target.localUrl
              );
            }

            return current.filter(
              (
                item
              ) =>
                item.id !==
                evidenceId
            );
          }
        );

        if (
          incidentEvidenceInputRef.current
        ) {
          incidentEvidenceInputRef.current.value =
            "";
        }

        setIsReviewing(
          false
        );
      },
      []
    );

  const handleIncidentEvidenceChange =
    useCallback(
      (
        event
      ) => {
        const selectedFiles =
          Array.from(
            event.target.files ||
            []
          );

        event.target.value =
          "";

        if (
          selectedFiles.length ===
          0
        ) {
          return;
        }

        const availableSlots =
          MAX_INCIDENT_EVIDENCE_FILES -
          (
            incidentEvidenceFiles.length +
            phoneCaptures.length
          );

        if (
          availableSlots <=
          0
        ) {
          showCustomAlert({
            title:
              "Attachment Limit Reached",

            message:
              `You can add up to ${MAX_INCIDENT_EVIDENCE_FILES} files or phone photos.`,
          });

          return;
        }

        if (
          selectedFiles.length >
          availableSlots
        ) {
          showCustomAlert({
            title:
              "Too Many Attachments",

            message:
              `You can add ${availableSlots} more ${
                availableSlots ===
                  1
                  ? "attachment"
                  : "attachments"
              }. The maximum is ${MAX_INCIDENT_EVIDENCE_FILES}.`,
          });

          return;
        }

        const existingKeys =
          new Set(
            incidentEvidenceFiles.map(
              (
                item
              ) =>
                `${item.file.name}:${item.file.size}:${item.file.lastModified}`
            )
          );

        const nextItems =
          [];

        for (
          const file of
          selectedFiles
        ) {
          const extension =
            `.${String(
              file.name ||
              ""
            )
              .split(".")
              .pop()
              .toLowerCase()}`;

          if (
            !INCIDENT_EVIDENCE_EXTENSIONS.has(
              extension
            )
          ) {
            for (
              const item of
              nextItems
            ) {
              URL.revokeObjectURL(
                item.localUrl
              );
            }

            showCustomAlert({
              title:
                "Unsupported File",

              message:
                `${file.name || "Selected file"} must be a PDF, JPG, JPEG, or PNG file.`,
            });

            return;
          }

          if (
            file.size <= 0 ||
            file.size >
              MAX_INCIDENT_EVIDENCE_SIZE
          ) {
            for (
              const item of
              nextItems
            ) {
              URL.revokeObjectURL(
                item.localUrl
              );
            }

            showCustomAlert({
              title:
                "File Too Large",

              message:
                `${file.name || "Selected file"} must be no larger than 5 MB.`,
            });

            return;
          }

          const duplicateKey =
            `${file.name}:${file.size}:${file.lastModified}`;

          if (
            existingKeys.has(
              duplicateKey
            )
          ) {
            continue;
          }

          existingKeys.add(
            duplicateKey
          );

          nextItems.push({
            id:
              `${
                Date.now()
              }-${
                Math.random()
                  .toString(36)
                  .slice(2)
              }`,

            file,

            localUrl:
              URL.createObjectURL(
                file
              ),
          });
        }

        if (
          nextItems.length ===
          0
        ) {
          showCustomAlert({
            type:
              "error",

            title:
              "File Already Added",

            message:
              "The selected file is already attached.",
          });

          return;
        }

        setIncidentEvidenceFiles(
          (
            current
          ) => [
            ...current,
            ...nextItems,
          ]
        );

        setIsReviewing(
          false
        );
      },
      [
        incidentEvidenceFiles,
        phoneCaptures,
        showCustomAlert,
      ]
    );

  const handleStartPhoneCapture =
    useCallback(
      async () => {
        if (
          isSaving ||
          isStartingPhoneCapture
        ) {
          return;
        }

        const employeeId =
          formData?.employeeId;

        if (
          !employeeId ||
          !selectedEmployeeOption ||
          String(
            selectedEmployeeOption.id
          ) !==
            String(
              employeeId
            )
        ) {
          showCustomAlert({
            type:
              "error",

            title:
              "Select Employee First",

            message:
              "Select a currently deployed employee before adding a photo from your phone.",
          });

          return;
        }

        if (
          totalEvidenceSlotsUsed >=
          MAX_INCIDENT_EVIDENCE_FILES
        ) {
          showCustomAlert({
            type:
              "error",

            title:
              "Attachment Limit Reached",

            message:
              `You can add up to ${MAX_INCIDENT_EVIDENCE_FILES} files or phone photos.`,
          });

          return;
        }

        if (
          hasPendingPhoneCapture
        ) {
          showCustomAlert({
            type:
              "error",

            title:
              "Phone Photo Already Open",

            message:
              "Finish or cancel the current phone photo before starting another.",
          });

          return;
        }

        try {
          setIsStartingPhoneCapture(
            true
          );

          closeCustomAlert();

          const session =
            await createIncidentPhoneCaptureSession({
              capturePurpose:
                INCIDENT_PHONE_CAPTURE_PURPOSES
                  .CREATE,

              employeeId,
            });

          const capture = {
            ...session,

            status:
              INCIDENT_PHONE_CAPTURE_STATUSES
                .WAITING,

            photo:
              null,
          };

          setPhoneCaptures(
            (
              current
            ) => [
              ...current,
              capture,
            ]
          );

          setActivePhoneCaptureSessionId(
            session.sessionId
          );

          setIsReviewing(
            false
          );
        } catch (error) {
          console.error(
            "Start Incident phone capture error:",
            error
          );

          showCustomAlert({
            type:
              "error",

            title:
              "Unable to Start Phone Photo",

            message:
              "Unable to prepare the phone photo. Please try again.",
          });
        } finally {
          setIsStartingPhoneCapture(
            false
          );
        }
      },
      [
        closeCustomAlert,
        formData?.employeeId,
        hasPendingPhoneCapture,
        isSaving,
        isStartingPhoneCapture,
        selectedEmployeeOption,
        showCustomAlert,
        totalEvidenceSlotsUsed,
      ]
    );

  const handleRemovePhoneCapture =
    useCallback(
      async (
        sessionId
      ) => {
        if (
          !sessionId ||
          isSaving
        ) {
          return;
        }

        try {
          await cancelIncidentPhoneCaptureSession(
            sessionId
          );
        } catch (error) {
          console.warn(
            "Cancel Incident phone capture warning:",
            error
          );
        }

        setPhoneCaptures(
          (
            current
          ) =>
            current.filter(
              (
                item
              ) =>
                item.sessionId !==
                sessionId
            )
        );

        if (
          activePhoneCaptureSessionId ===
          sessionId
        ) {
          setActivePhoneCaptureSessionId(
            ""
          );
        }

        setIsReviewing(
          false
        );
      },
      [
        activePhoneCaptureSessionId,
        isSaving,
      ]
    );

  useEffect(() => {
    if (
      !isOpen ||
      !activePhoneCaptureSessionId
    ) {
      return undefined;
    }

    let stopped =
      false;

    let timerId =
      null;

    const poll =
      async () => {
        try {
          const session =
            await getIncidentPhoneCaptureSession(
              activePhoneCaptureSessionId
            );

          if (stopped) {
            return;
          }

          setPhoneCaptures(
            (
              current
            ) =>
              current.map(
                (
                  item
                ) =>
                  item.sessionId ===
                  activePhoneCaptureSessionId
                    ? {
                        ...item,
                        ...session,
                      }
                    : item
              )
          );

          const status =
            String(
              session?.status ||
              ""
            ).trim();

          if (
            status ===
              INCIDENT_PHONE_CAPTURE_STATUSES
                .PHOTO_ADDED ||
            status ===
              INCIDENT_PHONE_CAPTURE_STATUSES
                .DONE
          ) {
            setActivePhoneCaptureSessionId(
              ""
            );

            showCustomAlert({
              type:
                "success",

              title:
                "Photo Added",

              message:
                "The phone photo was added to this Incident report.",
            });

            return;
          }

          if (
            status ===
              INCIDENT_PHONE_CAPTURE_STATUSES
                .CANCELLED ||
            status ===
              INCIDENT_PHONE_CAPTURE_STATUSES
                .EXPIRED
          ) {
            setPhoneCaptures(
              (
                current
              ) =>
                current.filter(
                  (
                    item
                  ) =>
                    item.sessionId !==
                    activePhoneCaptureSessionId
                )
            );

            setActivePhoneCaptureSessionId(
              ""
            );

            showCustomAlert({
              type:
                "error",

              title:
                "Phone Photo Ended",

              message:
                status ===
                  INCIDENT_PHONE_CAPTURE_STATUSES
                    .EXPIRED
                  ? "The QR code expired. Start a new phone photo to continue."
                  : "The phone photo was cancelled.",
            });

            return;
          }

          timerId =
            window.setTimeout(
              poll,
              PHONE_CAPTURE_POLL_MS
            );
        } catch (error) {
          if (stopped) {
            return;
          }

          console.error(
            "Incident phone capture polling error:",
            error
          );

          timerId =
            window.setTimeout(
              poll,
              PHONE_CAPTURE_POLL_MS
            );
        }
      };

    void poll();

    return () => {
      stopped =
        true;

      if (timerId) {
        window.clearTimeout(
          timerId
        );
      }
    };
  }, [
    activePhoneCaptureSessionId,
    isOpen,
    showCustomAlert,
  ]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleClickOutside =
      (event) => {
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
  }, [
    isOpen,
  ]);

  useEffect(() => {
    if (
      !isOpen ||
      selectedEmployeeOption
    ) {
      return undefined;
    }

    const keyword =
      employeeSearch.trim();

    if (!keyword) {
      return undefined;
    }

    let requestController =
      null;

    const searchTimerId =
      window.setTimeout(
        async () => {
          requestController =
            new AbortController();

          if (
            employeeSearchRequestRef.current
          ) {
            employeeSearchRequestRef.current.abort();
          }

          employeeSearchRequestRef.current =
            requestController;

          setIsSearchingEmployees(
            true
          );

          setEmployeeSearchError(
            ""
          );

          try {
            const response =
              await authenticatedFetch(
                `${INCIDENT_FORM_META_URL}?employeeSearch=${encodeURIComponent(
                  keyword
                )}`,
                {
                  signal:
                    requestController.signal,

                  headers: {
                    Accept:
                      "application/json",
                  },
                }
              );

            const data =
              await response
                .json()
                .catch(
                  () => null
                );

            if (!response.ok) {
              throw new Error(
                data?.error ||
                  data?.message ||
                  `Employee search failed with status ${response.status}`
              );
            }

            if (
              requestController
                .signal
                .aborted
            ) {
              return;
            }

            const results =
              Array.isArray(
                data?.employees
              )
                ? data.employees
                    .map(
                      (
                        employee
                      ) => ({
                        ...employee,

                        id:
                          employee?.id ||
                          employee
                            ?.employeeId ||
                          employee
                            ?.employee_id,

                        name:
                          employee?.name ||
                          employee
                            ?.full_name ||
                          employee
                            ?.fullName ||
                          "",

                        company:
                          employee
                            ?.company ||
                          employee
                            ?.activeDeployment
                            ?.company ||
                          "",
                      })
                    )
                    .filter(
                      (
                        employee
                      ) =>
                        employee.id &&
                        employee.name &&
                        employee
                          .activeDeployment
                    )
                : [];

            setEmployeeOptions(
              results
            );
          } catch (error) {
            if (
              error?.name ===
              "AbortError"
            ) {
              return;
            }

            console.error(
              "Incident employee search error:",
              error
            );

            setEmployeeOptions(
              []
            );

            setEmployeeSearchError(
              "Unable to search deployed employees. Please try again."
            );
          } finally {
            if (
              employeeSearchRequestRef.current ===
              requestController
            ) {
              employeeSearchRequestRef.current =
                null;

              if (
                !requestController
                  .signal
                  .aborted
              ) {
                setIsSearchingEmployees(
                  false
                );
              }
            }
          }
        },
        EMPLOYEE_SEARCH_DEBOUNCE_MS
      );

    return () => {
      window.clearTimeout(
        searchTimerId
      );

      if (
        requestController
      ) {
        requestController.abort();
      }
    };
  }, [
    employeeSearch,
    isOpen,
    selectedEmployeeOption,
  ]);

  const loadEmployeeIncidentHistory =
    useCallback(
      async (
        employeeId
      ) => {
        const normalizedEmployeeId =
          String(
            employeeId ||
              ""
          ).trim();

        if (
          !normalizedEmployeeId
        ) {
          setEmployeeIncidentHistory(
            []
          );

          setEmployeeIncidentHistoryError(
            ""
          );

          setIsLoadingEmployeeIncidentHistory(
            false
          );

          return [];
        }

        if (
          employeeIncidentHistoryRequestRef.current
        ) {
          employeeIncidentHistoryRequestRef.current.abort();
        }

        const requestController =
          new AbortController();

        employeeIncidentHistoryRequestRef.current =
          requestController;

        setEmployeeIncidentHistory(
          []
        );

        setEmployeeIncidentHistoryError(
          ""
        );

        setIsLoadingEmployeeIncidentHistory(
          true
        );

        try {
          const response =
            await authenticatedFetch(
              `${INCIDENT_EMPLOYEE_HISTORY_URL}/${encodeURIComponent(
                normalizedEmployeeId
              )}`,
              {
                signal:
                  requestController.signal,

                headers: {
                  Accept:
                    "application/json",
                },
              }
            );

          const data =
            await response
              .json()
              .catch(
                () => null
              );

          if (!response.ok) {
            throw new Error(
              data?.error ||
                data?.message ||
                `Incident history request failed with status ${response.status}`
            );
          }

          if (
            requestController
              .signal
              .aborted
          ) {
            return [];
          }

          const history =
            Array.isArray(
              data
            )
              ? data
              : [];

          setEmployeeIncidentHistory(
            history
          );

          return history;
        } catch (error) {
          if (
            error?.name ===
            "AbortError"
          ) {
            return [];
          }

          console.error(
            "Incident employee history error:",
            error
          );

          setEmployeeIncidentHistory(
            []
          );

          setEmployeeIncidentHistoryError(
            "Unable to load the selected employee's incident history. Please try again."
          );

          return [];
        } finally {
          if (
            employeeIncidentHistoryRequestRef.current ===
            requestController
          ) {
            employeeIncidentHistoryRequestRef.current =
              null;

            if (
              !requestController
                .signal
                .aborted
            ) {
              setIsLoadingEmployeeIncidentHistory(
                false
              );
            }
          }
        }
      },
      []
    );

  const filteredEmployees =
    employeeOptions;

  const filteredViolations =
    useMemo(() => {
      if (
        !isViolationPolicyReady
      ) {
        return [];
      }

      const keyword =
        violationSearch
          .trim()
          .toLowerCase();

      if (!keyword) {
        return violationOptions.slice(
          0,
          12
        );
      }

      return violationOptions
        .filter(
          (
            item
          ) => {
            const searchableText =
              [
                item.category,
                item.section,
                item.violation,
                item.description,
                item.penaltyLevel,
                item.severity,

                ...(
                  item.penalties ||
                  []
                ).map(
                  getPenaltySearchValue
                ),
              ]
                .join(
                  " "
                )
                .replace(
                  /<[^>]*>/g,
                  ""
                )
                .toLowerCase();

            return searchableText.includes(
              keyword
            );
          }
        )
        .slice(
          0,
          12
        );
    }, [
      isViolationPolicyReady,
      violationOptions,
      violationSearch,
    ]);

  const duplicateCandidates =
    useMemo(() => {
      if (!formData) {
        return [];
      }

      return getDuplicateIncidentCandidates(
        employeeIncidentHistory,
        formData
      );
    }, [
      employeeIncidentHistory,
      formData,
    ]);

  const needsDuplicateVerification =
    duplicateCandidates.length >
    0;

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
            employeeIncidentHistory,
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
            (
              rule
            ) =>
              rule.violation ===
              violation
          );

        const severity =
          computeAutoSeverity({
            baseSeverity:
              selectedRule
                ?.severity ||
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
        employeeIncidentHistory,
        violationOptions,
      ]
    );

  useEffect(() => {
    if (
      isLoadingEmployeeIncidentHistory ||
      employeeIncidentHistoryError
    ) {
      return;
    }

    setFormData(
      (
        current
      ) => {
        if (
          !current?.employeeId ||
          !current?.violation
        ) {
          return current;
        }

        const penaltyData =
          computePenaltyData({
            employeeId:
              current.employeeId,

            violation:
              current.violation,

            penalties:
              current.penalties,

            description:
              current.description,
          });

        return {
          ...current,
          ...penaltyData,

          duplicateVerified:
            false,

          duplicateVerificationNote:
            "",
        };
      }
    );

    resetDuplicateVerification();
  }, [
    computePenaltyData,
    employeeIncidentHistoryError,
    isLoadingEmployeeIncidentHistory,
    resetDuplicateVerification,
  ]);

  const handleSelectEmployee =
    useCallback(
      (
        selectedEmployee
      ) => {
        const activeDeployment =
          selectedEmployee
            ?.activeDeployment ||
          null;

        if (
          !activeDeployment
        ) {
          showCustomAlert({
            type:
              "error",

            title:
              "Deployment Not Available",

            message:
              "The selected employee no longer has a valid active deployment. Please search again.",
          });

          return;
        }

        const previousEmployeeId =
          String(
            formData?.employeeId ||
            ""
          );

        if (
          previousEmployeeId &&
          previousEmployeeId !==
            String(
              selectedEmployee.id
            )
        ) {
          const sessionIds =
            phoneCapturesRef.current
              .map(
                (
                  item
                ) =>
                  item?.sessionId
              )
              .filter(
                Boolean
              );

          if (
            sessionIds.length >
            0
          ) {
            void cancelIncidentPhoneCaptureSessions(
              sessionIds
            );
          }

          phoneCapturesRef.current =
            [];

          setPhoneCaptures(
            []
          );

          setActivePhoneCaptureSessionId(
            ""
          );
        }

        setSelectedEmployeeOption(
          selectedEmployee
        );

        setFormData(
          (
            current
          ) => ({
            ...current,

            employeeId:
              selectedEmployee.id,

            employee:
              selectedEmployee.name,

            company:
              activeDeployment
                ?.company ||
              selectedEmployee
                .company ||
              "",

            offenseCount:
              1,

            selectedPenalty:
              null,

            sanction:
              "",

            severity:
              "",

            duplicateVerified:
              false,

            duplicateVerificationNote:
              "",
          })
        );

        setEmployeeSearch(
          `${selectedEmployee.name} (${selectedEmployee.id})`
        );

        setEmployeeOptions(
          []
        );

        setEmployeeSearchError(
          ""
        );

        setShowEmployeeDropdown(
          false
        );

        setIsReviewing(
          false
        );

        resetDuplicateVerification();

        void loadEmployeeIncidentHistory(
          selectedEmployee.id
        );
      },
      [
        formData?.employeeId,
        loadEmployeeIncidentHistory,
        resetDuplicateVerification,
        showCustomAlert,
      ]
    );

  const handleEmployeeInputChange =
    useCallback(
      (
        event
      ) => {
        const sessionIds =
          phoneCapturesRef.current
            .map(
              (
                item
              ) =>
                item?.sessionId
            )
            .filter(
              Boolean
            );

        if (
          sessionIds.length >
          0
        ) {
          void cancelIncidentPhoneCaptureSessions(
            sessionIds
          );

          phoneCapturesRef.current =
            [];

          setPhoneCaptures(
            []
          );

          setActivePhoneCaptureSessionId(
            ""
          );
        }

        setEmployeeSearch(
          event.target.value
        );

        setEmployeeOptions(
          []
        );

        setEmployeeSearchError(
          ""
        );

        setSelectedEmployeeOption(
          null
        );

        setShowEmployeeDropdown(
          true
        );

        setIsReviewing(
          false
        );

        resetDuplicateVerification();

        if (
          employeeIncidentHistoryRequestRef.current
        ) {
          employeeIncidentHistoryRequestRef.current.abort();

          employeeIncidentHistoryRequestRef.current =
            null;
        }

        setEmployeeIncidentHistory(
          []
        );

        setIsLoadingEmployeeIncidentHistory(
          false
        );

        setEmployeeIncidentHistoryError(
          ""
        );

        setFormData(
          (
            current
          ) => ({
            ...current,
            ...getClearedEmployeeFields(),
          })
        );
      },
      [
        resetDuplicateVerification,
      ]
    );

  const handleSelectViolation =
    useCallback(
      (
        selectedRule
      ) => {
        if (
          !isViolationPolicyReady
        ) {
          return;
        }

        setFormData(
          (
            current
          ) => {
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

              duplicateVerified:
                false,

              duplicateVerificationNote:
                "",

              ...penaltyData,
            };
          }
        );

        setViolationSearch(
          `${selectedRule.section} — ${selectedRule.violation}`
        );

        setShowViolationDropdown(
          false
        );

        setIsReviewing(
          false
        );

        resetDuplicateVerification();
      },
      [
        computePenaltyData,
        isViolationPolicyReady,
        resetDuplicateVerification,
      ]
    );

  const handleViolationInputChange =
    useCallback(
      (
        event
      ) => {
        setViolationSearch(
          event.target.value
        );

        setShowViolationDropdown(
          true
        );

        setIsReviewing(
          false
        );

        resetDuplicateVerification();

        setFormData(
          (
            current
          ) => ({
            ...current,
            ...getClearedViolationFields(),
          })
        );
      },
      [
        resetDuplicateVerification,
      ]
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

        setIsReviewing(
          false
        );

        setFormData(
          (
            current
          ) => {
            const updated = {
              ...current,
              [name]:
                value,
            };

            if (
              name ===
                "description" &&
              updated.violation
            ) {
              return {
                ...updated,

                ...computePenaltyData({
                  employeeId:
                    updated.employeeId,

                  violation:
                    updated.violation,

                  penalties:
                    updated.penalties,

                  description:
                    value,
                }),
              };
            }

            return updated;
          }
        );
      },
      [
        computePenaltyData,
      ]
    );

  const validateForm =
    useCallback(() => {
      if (
        !formData?.employeeId ||
        !formData?.employee
      ) {
        showCustomAlert({
          type:
            "error",

          title:
            "Employee Required",

          message:
            "Please select an employee from the suggested list.",
        });

        return false;
      }

      if (
        isLoadingEmployeeIncidentHistory
      ) {
        showCustomAlert({
          type:
            "error",

          title:
            "Incident History Loading",

          message:
            "Please wait until the selected employee's incident history finishes loading.",
        });

        return false;
      }

      if (
        employeeIncidentHistoryError
      ) {
        showCustomAlert({
          type:
            "error",

          title:
            "Incident History Unavailable",

          message:
            employeeIncidentHistoryError,
        });

        return false;
      }

      if (
        isLoadingViolationPolicy
      ) {
        showCustomAlert({
          type:
            "error",

          title:
            "Violation Policy Loading",

          message:
            "Please wait until the current violation policy finishes loading.",
        });

        return false;
      }

      if (
        violationPolicyError ||
        violationOptions.length ===
          0
      ) {
        showCustomAlert({
          type:
            "error",

          title:
            "Violation Policy Unavailable",

          message:
            "The current violation policy could not be loaded. Please try again before creating the incident report.",
        });

        return false;
      }

      if (
        !formData?.violation
      ) {
        showCustomAlert({
          type:
            "error",

          title:
            "Violation Required",

          message:
            "Please select a violation type from the suggested list.",
        });

        return false;
      }

      const selectedRuleExists =
        violationOptions.some(
          (
            rule
          ) =>
            rule.violation ===
            formData.violation
        );

      if (
        !selectedRuleExists
      ) {
        showCustomAlert({
          type:
            "error",

          title:
            "Violation Policy Changed",

          message:
            "The selected violation is no longer available in the current policy. Please select a violation again.",
        });

        return false;
      }

      if (
        !formData
          ?.description
          ?.trim()
      ) {
        showCustomAlert({
          type:
            "error",

          title:
            "Case Description Required",

          message:
            "Please enter the incident description before reviewing.",
        });

        return false;
      }

      if (
        hasPendingPhoneCapture
      ) {
        showCustomAlert({
          type:
            "error",

          title:
            "Phone Photo In Progress",

          message:
            "Finish or cancel the current phone photo before reviewing the report.",
        });

        return false;
      }

      if (
        totalEvidenceSlotsUsed >
        MAX_INCIDENT_EVIDENCE_FILES
      ) {
        showCustomAlert({
          type:
            "error",

          title:
            "Attachment Limit Exceeded",

          message:
            `You can add up to ${MAX_INCIDENT_EVIDENCE_FILES} files or phone photos.`,
        });

        return false;
      }

      return true;
    }, [
      employeeIncidentHistoryError,
      formData,
      hasPendingPhoneCapture,
      isLoadingEmployeeIncidentHistory,
      isLoadingViolationPolicy,
      showCustomAlert,
      totalEvidenceSlotsUsed,
      violationOptions,
      violationPolicyError,
    ]);

  const handleReview =
    useCallback(
      (
        event
      ) => {
        event.preventDefault();

        if (
          !validateForm()
        ) {
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

        setFormData(
          (
            current
          ) => ({
            ...current,
            ...penaltyData,
          })
        );

        setShowEmployeeDropdown(
          false
        );

        setShowViolationDropdown(
          false
        );

        setIsReviewing(
          true
        );

        showCustomAlert({
          type:
            "success",

          title:
            "Ready for Review",

          message:
            "The incident details are ready. Please review the report before saving.",
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
    useCallback(
      async () => {
        if (
          isSaving ||
          !validateForm()
        ) {
          return;
        }

        const selectedEmployeeId =
          String(
            selectedEmployeeOption
              ?.id ||
              ""
          );

        const formEmployeeId =
          String(
            formData.employeeId ||
              ""
          );

        const activeDeployment =
          selectedEmployeeOption
            ?.activeDeployment ||
          null;

        if (
          !activeDeployment ||
          !selectedEmployeeId ||
          selectedEmployeeId !==
            formEmployeeId
        ) {
          showCustomAlert({
            type:
              "error",

            title:
              "Employee Selection Required",

            message:
              "Please select a currently deployed employee from the search results before saving.",
          });

          return;
        }

        if (
          needsDuplicateVerification &&
          !duplicateConfirmed
        ) {
          showCustomAlert({
            type:
              "error",

            title:
              "Related Case Review Required",

            message:
              "A related active case exists for the same employee and violation. Review it and confirm that this is a separate incident before saving.",
          });

          return;
        }

        const phoneSessionIds =
          completedPhoneCaptures
            .map(
              (
                item
              ) =>
                item?.sessionId
            )
            .filter(
              Boolean
            );

        const combinedEvidenceCount =
          incidentEvidenceFiles.length +
          phoneSessionIds.length;

        if (
          combinedEvidenceCount >
          MAX_INCIDENT_EVIDENCE_FILES
        ) {
          showCustomAlert({
            type:
              "error",

            title:
              "Attachment Limit Exceeded",

            message:
              `You can submit up to ${MAX_INCIDENT_EVIDENCE_FILES} files or phone photos.`,
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

            existingIncidents:
              employeeIncidentHistory,
          });

        try {
          setIsSaving(
            true
          );

          closeCustomAlert();

          /*
           * Refresh phone descriptors immediately before
           * Save so a user cannot accidentally submit an
           * expired descriptor after leaving this form
           * open for several minutes.
           */
          const phoneUploadResult =
            await refreshIncidentPhoneCaptureDirectUploads(
              phoneSessionIds
            );

          const desktopDirectUploads =
            await prepareIncidentCreateDirectUploads({
              employeeId:
                formData.employeeId,

              files:
                incidentEvidenceFiles.map(
                  (
                    item
                  ) =>
                    item.file
                ),
            });

          const directUploads =
            mergeIncidentDirectUploads(
              desktopDirectUploads,
              phoneUploadResult
                .directUploads
            );

          const saved =
            await onSave(
              {
                ...finalIncident,
                directUploads,
              }
            );

          if (
            saved ===
            false
          ) {
            if (
              phoneSessionIds.length >
              0
            ) {
              await cancelIncidentPhoneCaptureSessions(
                phoneSessionIds
              );

              phoneCapturesRef.current =
                [];

              setPhoneCaptures(
                []
              );

              setActivePhoneCaptureSessionId(
                ""
              );

              showCustomAlert({
                type:
                  "error",

                title:
                  "Report Not Saved",

                message:
                  "The incident report was not saved. Please add the phone photos again before retrying.",
              });
            }

            setIsSaving(
              false
            );

            return;
          }

          /*
           * The Incident transaction succeeded. From
           * this point forward the saved Incident owns
           * every phone object submitted in this save.
           *
           * CRITICAL:
           * Protect those session IDs from all modal
           * close/unmount cleanup BEFORE attempting the
           * follow-up consume request.
           *
           * Consume is bookkeeping only. If it fails,
           * the successfully attached evidence must
           * remain owned by the saved Incident.
           */
          phoneSessionIds.forEach(
            (
              sessionId
            ) => {
              protectedPhoneSessionIdsRef.current.add(
                sessionId
              );
            }
          );

          if (
            phoneSessionIds.length >
            0
          ) {
            try {
              await consumeIncidentPhoneCaptureSessions(
                phoneSessionIds
              );

              setPhoneCaptures(
                (
                  current
                ) =>
                  current.map(
                    (
                      item
                    ) =>
                      phoneSessionIds.includes(
                        item.sessionId
                      )
                        ? {
                            ...item,

                            status:
                              INCIDENT_PHONE_CAPTURE_STATUSES
                                .DONE,
                          }
                        : item
                  )
              );
            } catch (consumeError) {
              /*
               * Do not remove the session IDs from the
               * protected Set and do not convert the
               * successful Incident save into a failure.
               *
               * The Storage objects are already owned by
               * the saved Incident.
               */
              console.warn(
                "Incident phone capture consume bookkeeping warning after successful save:",
                consumeError
              );
            }
          }

          showCustomAlert({
            type:
              "success",

            title:
              "Incident Report Saved",

            message:
              "The incident report has been saved successfully.",
          });

          closeTimerRef.current =
            window.setTimeout(
              () => {
                closeCustomAlert();

                setIsSaving(
                  false
                );

                onClose();
              },
              900
            );
        } catch (error) {
          console.error(
            "Final save incident error:",
            error
          );

          /*
           * If a final save attempt reached backend
           * direct-upload verification and later failed,
           * the backend cleanup boundary may already
           * have deleted the staged objects.
           *
           * Release the phone sessions so a retry never
           * reuses a stale object path. The rest of the
           * unsaved Incident form remains intact.
           */
          if (
            phoneSessionIds.length >
            0
          ) {
            await cancelIncidentPhoneCaptureSessions(
              phoneSessionIds
            );

            phoneCapturesRef.current =
              [];

            setPhoneCaptures(
              []
            );

            setActivePhoneCaptureSessionId(
              ""
            );
          }

          setIsSaving(
            false
          );

          showCustomAlert({
            type:
              "error",

            title:
              "Unable to Save Report",

            message:
              `The incident report could not be saved. Please try again.${
                phoneSessionIds.length >
                0
                  ? " Add the phone photos again before retrying."
                  : ""
              }`,
          });
        }
      },
      [
        closeCustomAlert,
        completedPhoneCaptures,
        computePenaltyData,
        duplicateConfirmed,
        employeeIncidentHistory,
        formData,
        incidentEvidenceFiles,
        isSaving,
        needsDuplicateVerification,
        onClose,
        onSave,
        selectedEmployeeOption,
        showCustomAlert,
        validateForm,
      ]
    );

  if (
    !isOpen ||
    !formData
  ) {
    return null;
  }

  return (
    <>
      <BaseModal
        onClose={
          handleClose
        }
        title={
          isReviewing
            ? "Review Incident Report"
            : "Add Incident Report"
        }
        subtitle={
          isReviewing
            ? "Review the incident details and policy results before saving."
            : "Complete the incident details, verify the applicable policy, and review the report before saving."
        }
        color={
          isReviewing
            ? "green"
            : "indigo"
        }
        size="lg"
        preventClose={
          isSaving
        }
        initialFocusRef={
          employeeInputRef
        }
      >
        {!isReviewing ? (
          <form
            onSubmit={
              handleReview
            }
            className="space-y-6"
          >
            <section className="rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-white/10 dark:bg-slate-950/50">
              <SectionTitle
                icon={
                  <FiFileText />
                }
                title="Case Information"
              />

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Field
                  label="Incident ID"
                  icon={
                    <FiHash />
                  }
                >
                  <input
                    type="text"
                    value={
                      formData.id
                    }
                    disabled
                    className="input-field bg-gray-100 text-gray-500 dark:bg-slate-800"
                  />
                </Field>

                <Field
                  label="Reported On"
                  icon={
                    <FiCalendar />
                  }
                >
                  <input
                    type="text"
                    value={
                      formatDateTime(
                        formData.reportedAt
                      )
                    }
                    disabled
                    className="input-field bg-gray-100 text-gray-600 dark:bg-slate-800"
                  />
                </Field>

                <Field
                  label="Status"
                >
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
                icon={
                  <FiUser />
                }
                title="Employee Details"
              />

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div
                  ref={
                    employeeBoxRef
                  }
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
                      ref={
                        employeeInputRef
                      }
                      id="incident-employee-search"
                      type="text"
                      value={
                        employeeSearch
                      }
                      onChange={
                        handleEmployeeInputChange
                      }
                      onFocus={() =>
                        setShowEmployeeDropdown(
                          true
                        )
                      }
                      autoComplete="off"
                      disabled={
                        isSaving
                      }
                      placeholder="Search employee name, ID number, or client company..."
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
                    employeeSearch &&
                    isSearchingEmployees && (
                      <div
                        role="status"
                        className="absolute z-30 mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-500 shadow-xl dark:border-slate-700 dark:bg-slate-900"
                      >
                        Searching deployed employees...
                      </div>
                    )}

                  {showEmployeeDropdown &&
                    !isSearchingEmployees &&
                    !employeeSearchError &&
                    filteredEmployees.length >
                      0 && (
                      <div
                        role="listbox"
                        aria-label="Deployed employees"
                        className="absolute z-30 mt-2 max-h-60 w-full overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
                      >
                        {filteredEmployees.map(
                          (
                            employee
                          ) => (
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
                    !isSearchingEmployees &&
                    employeeSearchError && (
                      <div
                        role="alert"
                        className="absolute z-30 mt-2 w-full rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm text-red-600 shadow-xl dark:border-red-500/30 dark:bg-slate-900 dark:text-red-300"
                      >
                        {
                          employeeSearchError
                        }
                      </div>
                    )}

                  {showEmployeeDropdown &&
                    employeeSearch &&
                    !isSearchingEmployees &&
                    !employeeSearchError &&
                    filteredEmployees.length ===
                      0 &&
                    !selectedEmployeeOption && (
                      <div className="absolute z-30 mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-500 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                        No deployed
                        employee found.
                      </div>
                    )}

                  {selectedEmployeeOption &&
                    isLoadingEmployeeIncidentHistory && (
                      <p className="mt-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                        Loading complete incident history...
                      </p>
                    )}

                  {selectedEmployeeOption &&
                    !isLoadingEmployeeIncidentHistory &&
                    employeeIncidentHistoryError && (
                      <p
                        role="alert"
                        className="mt-2 text-xs font-medium text-red-600 dark:text-red-300"
                      >
                        {
                          employeeIncidentHistoryError
                        }
                      </p>
                    )}
                </div>

                <Field
                  label="Client Company"
                  icon={
                    <FiBriefcase />
                  }
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
                icon={
                  <FiShield />
                }
                title="Violation and Policy"
              />

              {isLoadingViolationPolicy && (
                <div
                  role="status"
                  className="mb-4 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm font-semibold text-indigo-800 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300"
                >
                  Loading the current violation policy...
                </div>
              )}

              {violationPolicyError && (
                <div
                  role="alert"
                  className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
                >
                  <p className="font-bold">
                    Violation policy unavailable
                  </p>

                  <p className="mt-1 leading-6">
                    The current violation policy could not be loaded. Please try again.
                  </p>

                  <button
                    type="button"
                    onClick={
                      reloadViolationPolicy
                    }
                    className="mt-3 rounded-xl border border-red-300 bg-white px-4 py-2 text-xs font-bold text-red-700 transition hover:bg-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:border-red-500/40 dark:bg-slate-900 dark:text-red-300 dark:hover:bg-red-500/10"
                  >
                    Retry Policy
                  </button>
                </div>
              )}

              {isViolationPolicyReady &&
                violationPolicySource && (
                  <div className="mb-4 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 text-sm text-indigo-800 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300">
                    <p className="font-bold">
                      Policy Details:{" "}
                      {
                        violationPolicySource
                      }
                    </p>

                    <p className="mt-1 text-xs leading-5">
                      Classification uses the current violation policy configured in the system.
                    </p>
                  </div>
                )}

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div
                  ref={
                    violationBoxRef
                  }
                  className="relative"
                >
                  <label
                    htmlFor="incident-violation-search"
                    className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                  >
                    Violation{" "}
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
                      onFocus={() => {
                        if (
                          isViolationPolicyReady
                        ) {
                          setShowViolationDropdown(
                            true
                          );
                        }
                      }}
                      autoComplete="off"
                      disabled={
                        isSaving ||
                        !isViolationPolicyReady
                      }
                      placeholder={
                        isLoadingViolationPolicy
                          ? "Loading violation policy..."
                          : violationPolicyError
                            ? "Violation policy unavailable"
                            : "Search policy section, category, or violation..."
                      }
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
                          (
                            item
                          ) => (
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
                      0 &&
                    isViolationPolicyReady && (
                      <div className="absolute z-30 mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-500 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                        No matching
                        violation found.
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
                    placeholder="Based on policy"
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
                    placeholder="Based on policy"
                  />
                </div>
              </div>

              {formData.violation && (
                <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <PolicyCard
                    formData={
                      formData
                    }
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
                    Policy Sanction Reference
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
                        "Not specified"}
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
                label="Case Description"
                required
              >
                <textarea
                  name="description"
                  rows={
                    5
                  }
                  value={
                    formData.description
                  }
                  onChange={
                    handleChange
                  }
                  disabled={
                    isSaving
                  }
                  placeholder="Describe what happened, including relevant details and supporting notes..."
                  className="input-field resize-none"
                />
              </Field>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">
                    Files and Photos
                  </p>

                  <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">
                    Optional. Add up to{" "}
                    {MAX_INCIDENT_EVIDENCE_FILES} total
                    PDF, JPG, JPEG, or PNG files and photos.
                    Each file must be 5 MB or smaller.
                  </p>

                  <p className="mt-1 text-xs font-semibold text-gray-600 dark:text-gray-300">
                    {totalEvidenceSlotsUsed}/
                    {MAX_INCIDENT_EVIDENCE_FILES} attachments added
                  </p>
                </div>

                <input
                  ref={
                    incidentEvidenceInputRef
                  }
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                  className="hidden"
                  onChange={
                    handleIncidentEvidenceChange
                  }
                  disabled={
                    isSaving ||
                    totalEvidenceSlotsUsed >=
                      MAX_INCIDENT_EVIDENCE_FILES
                  }
                />

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      incidentEvidenceInputRef.current?.click()
                    }
                    disabled={
                      isSaving ||
                      totalEvidenceSlotsUsed >=
                        MAX_INCIDENT_EVIDENCE_FILES
                    }
                    className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-indigo-500/30 dark:text-indigo-300 dark:hover:bg-indigo-950/30"
                  >
                    <FiPaperclip
                      aria-hidden="true"
                    />
                    Select Files
                  </button>

                  <button
                    type="button"
                    onClick={
                      handleStartPhoneCapture
                    }
                    disabled={
                      isSaving ||
                      isStartingPhoneCapture ||
                      hasPendingPhoneCapture ||
                      totalEvidenceSlotsUsed >=
                        MAX_INCIDENT_EVIDENCE_FILES
                    }
                    className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-500/30 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
                  >
                    <FiSmartphone
                      aria-hidden="true"
                    />

                    {isStartingPhoneCapture
                      ? "Getting QR code..."
                      : "Add photo from phone"}
                  </button>
                </div>
              </div>

              {activePhoneCapture && (
                <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-500/30 dark:bg-emerald-950/20">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <div className="mx-auto shrink-0 rounded-2xl bg-white p-3 shadow-sm sm:mx-0">
                      {activePhoneCapture.captureUrl ? (
                        <QRCodeSVG
                          value={
                            activePhoneCapture.captureUrl
                          }
                          size={
                            168
                          }
                          level="M"
                          includeMargin
                        />
                      ) : (
                        <div className="flex h-[168px] w-[168px] items-center justify-center text-sm text-gray-500">
                          Preparing QR code...
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <FiCamera
                          className="shrink-0 text-emerald-700 dark:text-emerald-300"
                          aria-hidden="true"
                        />

                        <p className="font-bold text-emerald-900 dark:text-emerald-200">
                          Scan this QR code with your phone
                        </p>
                      </div>

                      <p className="mt-2 text-sm leading-6 text-emerald-800 dark:text-emerald-300">
                        Open the camera on your phone,
                        scan the code, take a photo of the
                        physical evidence, then tap
                        <span className="font-bold">
                          {" "}Use photo
                        </span>
                        . Keep this desktop form open.
                      </p>

                      <p className="mt-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                        {activePhoneCapture.status ===
                        INCIDENT_PHONE_CAPTURE_STATUSES
                          .READY_FOR_UPLOAD
                          ? "Waiting for photo..."
                          : "Waiting for photo..."}
                      </p>

                      <button
                        type="button"
                        onClick={() =>
                          handleRemovePhoneCapture(
                            activePhoneCapture.sessionId
                          )
                        }
                        disabled={
                          isSaving
                        }
                        className="mt-3 inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-bold text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-60 dark:border-emerald-500/40 dark:bg-slate-900 dark:text-emerald-300"
                      >
                        <FiX
                          aria-hidden="true"
                        />
                        Cancel phone photo
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {incidentEvidenceFiles.length >
                0 && (
                <div className="mt-4 space-y-3">
                  {incidentEvidenceFiles.map(
                    (
                      evidence,
                      index
                    ) => (
                      <div
                        key={
                          evidence.id
                        }
                        className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 dark:border-indigo-500/20 dark:bg-indigo-950/20"
                      >
                        <div className="flex items-start gap-3">
                          <FiFileText className="mt-0.5 shrink-0 text-indigo-600 dark:text-indigo-300" />

                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold uppercase tracking-wide text-indigo-600 dark:text-indigo-300">
                              File {index + 1}
                            </p>

                            <p className="mt-1 break-all text-sm font-bold text-gray-900 dark:text-white">
                              {
                                evidence.file.name
                              }
                            </p>

                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              {formatFileSize(
                                evidence.file.size
                              )}
                            </p>

                            <div className="mt-3 flex flex-wrap gap-2">
                              <a
                                href={
                                  evidence.localUrl
                                }
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-lg border border-indigo-200 px-3 py-1.5 text-xs font-bold text-indigo-700 hover:bg-white dark:border-indigo-500/30 dark:text-indigo-300"
                              >
                                Preview
                              </a>

                              <button
                                type="button"
                                onClick={() =>
                                  removeIncidentEvidenceFile(
                                    evidence.id
                                  )
                                }
                                disabled={
                                  isSaving
                                }
                                className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-500/30 dark:text-red-300"
                              >
                                <FiTrash2
                                  aria-hidden="true"
                                />
                                Remove
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}

              {completedPhoneCaptures.length >
                0 && (
                <div className="mt-4 space-y-3">
                  {completedPhoneCaptures.map(
                    (
                      capture,
                      index
                    ) => (
                      <div
                        key={
                          capture.sessionId
                        }
                        className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 dark:border-emerald-500/20 dark:bg-emerald-950/20"
                      >
                        <div className="flex items-start gap-3">
                          <FiSmartphone className="mt-0.5 shrink-0 text-emerald-700 dark:text-emerald-300" />

                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                              Phone photo {index + 1}
                            </p>

                            <p className="mt-1 break-all text-sm font-bold text-gray-900 dark:text-white">
                              {capture.photo?.name ||
                                "Phone photo"}
                            </p>

                            {capture.photo?.size ? (
                              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                {formatFileSize(
                                  capture.photo.size
                                )}
                              </p>
                            ) : null}

                            <div className="mt-3 flex flex-wrap gap-2">
                              {capture.photo
                                ?.previewUrl && (
                                <a
                                  href={
                                    capture.photo.previewUrl
                                  }
                                  target="_blank"
                                  rel="noreferrer"
                                  className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-white dark:border-emerald-500/30 dark:text-emerald-300"
                                >
                                  Preview
                                </a>
                              )}

                              <button
                                type="button"
                                onClick={() =>
                                  handleRemovePhoneCapture(
                                    capture.sessionId
                                  )
                                }
                                disabled={
                                  isSaving
                                }
                                className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-500/30 dark:text-red-300"
                              >
                                <FiTrash2
                                  aria-hidden="true"
                                />
                                Remove
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}

              {totalEvidenceSlotsUsed ===
                0 && (
                <div className="mt-4 rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-500 dark:border-slate-700 dark:text-gray-400">
                  No files or photos added yet. You may choose files from this computer or add a photo using your phone.
                </div>
              )}
            </section>

            <FooterButtons>
              <button
                type="button"
                onClick={
                  handleClose
                }
                disabled={
                  isSaving
                }
                className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:text-gray-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={
                  isSaving ||
                  isLoadingEmployeeIncidentHistory ||
                  !isViolationPolicyReady
                }
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/25 disabled:cursor-not-allowed disabled:opacity-60"
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
                    Review Incident Report
                  </h3>

                  <p className="mt-1 text-sm">
                    Please check all details carefully before final saving.
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
                value={
                  formData.id
                }
              />

              <ReviewItem
                label="Reported On"
                value={
                  formatDateTime(
                    formData.reportedAt
                  )
                }
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
                label="Client Company"
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
                label="Offense Number"
                value={`${formData.offenseCount} offense`}
              />

              <ReviewItem
                label="Prescribed Sanction"
                value={
                  formData.sanction
                }
              />
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
              <PolicyCard
                formData={
                  formData
                }
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
                {
                  formData.description
                }
              </p>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-white/10 dark:bg-slate-900">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
                    Files and Photos
                  </p>

                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {incidentEvidenceFiles.length +
                      completedPhoneCaptures.length}
                    /{MAX_INCIDENT_EVIDENCE_FILES} attachments added
                  </p>
                </div>
              </div>

              {incidentEvidenceFiles.length ===
                0 &&
              completedPhoneCaptures.length ===
                0 ? (
                <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                  No files or photos added.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {incidentEvidenceFiles.map(
                    (
                      evidence,
                      index
                    ) => (
                      <div
                        key={
                          evidence.id
                        }
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gray-50 p-4 dark:bg-slate-950/50"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold uppercase tracking-wide text-indigo-600 dark:text-indigo-300">
                            File {index + 1}
                          </p>

                          <p className="mt-1 break-all text-sm font-semibold text-gray-900 dark:text-white">
                            {
                              evidence.file.name
                            }
                          </p>

                          <p className="mt-1 text-xs text-gray-500">
                            {formatFileSize(
                              evidence.file.size
                            )}
                          </p>
                        </div>

                        <a
                          href={
                            evidence.localUrl
                          }
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border border-indigo-200 px-3 py-1.5 text-xs font-bold text-indigo-700 dark:border-indigo-500/30 dark:text-indigo-300"
                        >
                          Preview
                        </a>
                      </div>
                    )
                  )}

                  {completedPhoneCaptures.map(
                    (
                      capture,
                      index
                    ) => (
                      <div
                        key={
                          capture.sessionId
                        }
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-emerald-50/70 p-4 dark:bg-emerald-950/20"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                            Phone photo {index + 1}
                          </p>

                          <p className="mt-1 break-all text-sm font-semibold text-gray-900 dark:text-white">
                            {capture.photo?.name ||
                              "Phone photo"}
                          </p>

                          {capture.photo?.size ? (
                            <p className="mt-1 text-xs text-gray-500">
                              {formatFileSize(
                                capture.photo.size
                              )}
                            </p>
                          ) : null}
                        </div>

                        {capture.photo
                          ?.previewUrl && (
                          <a
                            href={
                              capture.photo.previewUrl
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:border-emerald-500/30 dark:text-emerald-300"
                          >
                            Preview
                          </a>
                        )}
                      </div>
                    )
                  )}
                </div>
              )}
            </section>

            <FooterButtons>
              <button
                type="button"
                onClick={() =>
                  setIsReviewing(
                    false
                  )
                }
                disabled={
                  isSaving
                }
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
                disabled={
                  isSaving ||
                  isLoadingEmployeeIncidentHistory ||
                  !isViolationPolicyReady
                }
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
                  ? "Saving..."
                  : "Save Incident Report"}
              </button>
            </FooterButtons>
          </div>
        )}

        <ModalStyle />
      </BaseModal>

      {customAlert.show && (
        <NoticeModal
          type={
            customAlert.type
          }
          title={
            customAlert.title
          }
          message={
            customAlert.message
          }
          preventClose={
            isSaving
          }
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