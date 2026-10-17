import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  FiAlertTriangle,
  FiCamera,
  FiCheckCircle,
  FiFileText,
  FiMessageSquare,
  FiRefreshCw,
  FiShield,
  FiSmartphone,
  FiTrash2,
  FiUpload,
} from "react-icons/fi";

import {
  QRCodeSVG,
} from "qrcode.react";

import Button from "../../ui/Button";

import {
  AlertBox,
  BaseModal,
  Field,
  InfoCard,
  ModalFooter,
  ProofList,
} from "../shared/ModalUI";

import {
  createEvidenceItem,
  formatFileSize,
  revokeEvidenceUrl,
} from "../../../utils/incidents/evidenceFiles";

import {
  MAX_INCIDENT_EVIDENCE_FILES,
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


const PHONE_CAPTURE_POLL_MS =
  1500;


function RequirementChip({
  complete,
  label,
}) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold",
        complete
          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
          : "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400",
      ].join(" ")}
    >
      <FiCheckCircle
        size={12}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}


function normalizePositiveInteger(
  value
) {
  const raw =
    String(
      value ?? ""
    ).trim();

  if (
    !/^\d+$/.test(
      raw
    )
  ) {
    return null;
  }

  const numericValue =
    Number(
      raw
    );

  if (
    !Number.isSafeInteger(
      numericValue
    ) ||
    numericValue <= 0
  ) {
    return null;
  }

  return numericValue;
}


function getIncidentNumericId(
  incident
) {
  return normalizePositiveInteger(
    incident?.databaseId ??
    incident?.incidentId ??
    incident?.incident_id ??
    incident?.id
  );
}


function getValidLocalProofCount(
  proofFiles
) {
  if (
    !Array.isArray(
      proofFiles
    )
  ) {
    return 0;
  }

  return proofFiles.filter(
    (
      item
    ) =>
      typeof File !==
        "undefined" &&
      item?.file instanceof
        File &&
      !item?.error
  ).length;
}


function getUsablePhoneCaptureCount(
  phoneCaptures
) {
  if (
    !Array.isArray(
      phoneCaptures
    )
  ) {
    return 0;
  }

  return phoneCaptures.filter(
    (
      item
    ) =>
      item?.sessionId &&
      (
        item?.status ===
          INCIDENT_PHONE_CAPTURE_STATUSES
            .PHOTO_ADDED ||
        item?.status ===
          INCIDENT_PHONE_CAPTURE_STATUSES
            .DONE
      )
  ).length;
}


export default function ResolutionModal({
  incident,
  onClose,
  onSubmit,
  showNotice,

  /*
   * ResolutionModal currently submits resolution proof,
   * so SUBMIT_RESOLUTION remains the default.
   *
   * The prop makes the same component compatible with
   * an investigation-proof caller when needed.
   */
  workflowAction =
    "SUBMIT_RESOLUTION",
}) {
  const fileInputRef =
    useRef(null);

  const proofFilesRef =
    useRef([]);

  const phoneCapturesRef =
    useRef([]);

  const activePhoneCaptureRef =
    useRef(null);

  const consumedPhoneSessionIdsRef =
    useRef(
      new Set()
    );

  const [
    actionTaken,
    setActionTaken,
  ] = useState("");

  const [
    remarks,
    setRemarks,
  ] = useState("");

  const [
    proofFiles,
    setProofFiles,
  ] = useState([]);

  const [
    phoneCaptures,
    setPhoneCaptures,
  ] = useState([]);

  const [
    activePhoneCapture,
    setActivePhoneCapture,
  ] = useState(null);

  const [
    isStartingPhoneCapture,
    setIsStartingPhoneCapture,
  ] = useState(false);

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);


  useEffect(() => {
    proofFilesRef.current =
      proofFiles;
  }, [
    proofFiles,
  ]);


  useEffect(() => {
    phoneCapturesRef.current =
      phoneCaptures;
  }, [
    phoneCaptures,
  ]);


  useEffect(() => {
    activePhoneCaptureRef.current =
      activePhoneCapture;
  }, [
    activePhoneCapture,
  ]);


  /*
   * Cleanup when the modal unmounts:
   *
   * - local preview URLs are revoked
   * - unconsumed phone-capture sessions are cancelled
   * - consumed sessions are never cancelled because a
   *   successful workflow submission now owns them
   */
  useEffect(() => {
    /*
     * This ref always points to the same Set instance;
     * entries are added with .add() after successful
     * workflow submission.
     *
     * Capture the Set reference during effect setup so
     * the cleanup does not read
     * consumedPhoneSessionIdsRef.current directly.
     * This satisfies react-hooks/exhaustive-deps while
     * preserving the latest Set contents.
     */
    const consumedSessionIds =
      consumedPhoneSessionIdsRef.current;

    return () => {
      proofFilesRef.current.forEach(
        revokeEvidenceUrl
      );

      const sessionIds = [
        ...phoneCapturesRef.current.map(
          (
            item
          ) =>
            item?.sessionId
        ),

        activePhoneCaptureRef.current
          ?.sessionId,
      ]
        .filter(
          Boolean
        )
        .filter(
          (
            sessionId
          ) =>
            !consumedSessionIds.has(
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


  /*
   * Desktop polling.
   *
   * Only one QR capture is active at a time. After the
   * phone confirms the photo, that session is moved into
   * phoneCaptures and the user may start another capture.
   */
  useEffect(() => {
    const sessionId =
      activePhoneCapture
        ?.sessionId;

    if (
      !sessionId ||
      isSubmitting
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
              sessionId
            );

          if (stopped) {
            return;
          }

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
            const photo =
              session?.photo ||
              {};

            setPhoneCaptures(
              (
                current
              ) => {
                if (
                  current.some(
                    (
                      item
                    ) =>
                      item.sessionId ===
                      sessionId
                  )
                ) {
                  return current;
                }

                return [
                  ...current,

                  {
                    sessionId,

                    status,

                    name:
                      photo?.name ||
                      "Phone photo",

                    type:
                      photo?.type ||
                      "image/jpeg",

                    size:
                      Number(
                        photo?.size
                      ) ||
                      0,

                    previewUrl:
                      photo?.previewUrl ||
                      "",

                    uploadedAt:
                      session?.uploadedAt ||
                      null,
                  },
                ];
              }
            );

            setActivePhoneCapture(
              null
            );

            showNotice?.(
              "success",
              "Photo added",
              "Your photo is ready to use."
            );

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
            setActivePhoneCapture(
              null
            );

            showNotice?.(
              "error",
              status ===
                INCIDENT_PHONE_CAPTURE_STATUSES
                  .EXPIRED
                ? "QR Code Expired"
                : "Phone Photo Cancelled",
              status ===
                INCIDENT_PHONE_CAPTURE_STATUSES
                  .EXPIRED
                ? "This QR code has expired. Please create a new one to add a photo."
                : "This phone photo request is no longer available."
            );

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
            "Resolution phone capture polling error:",
            error
          );

          setActivePhoneCapture(
            null
          );

          showNotice?.(
            "error",
            "Can’t Check Phone Photo",
            "We couldn’t check the phone photo. Please try again."
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
    activePhoneCapture,
    isSubmitting,
    showNotice,
  ]);


  const handleClose =
    useCallback(() => {
      if (isSubmitting) {
        return;
      }

      const consumedIds =
        consumedPhoneSessionIdsRef.current;

      const sessionIds = [
        ...phoneCapturesRef.current.map(
          (
            item
          ) =>
            item?.sessionId
        ),

        activePhoneCaptureRef.current
          ?.sessionId,
      ]
        .filter(
          Boolean
        )
        .filter(
          (
            sessionId
          ) =>
            !consumedIds.has(
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

      onClose?.();
    }, [
      isSubmitting,
      onClose,
    ]);


  const handleActionTakenChange =
    useCallback(
      (
        event
      ) => {
        setActionTaken(
          event.target.value
        );
      },
      []
    );


  const handleRemarksChange =
    useCallback(
      (
        event
      ) => {
        setRemarks(
          event.target.value
        );
      },
      []
    );


  const handleFileChange =
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

        const phoneCount =
          phoneCapturesRef.current
            .length;

        setProofFiles(
          (
            currentFiles
          ) => {
            const availableSlots =
              Math.max(
                0,
                MAX_INCIDENT_EVIDENCE_FILES -
                  phoneCount -
                  currentFiles.length
              );

            if (
              availableSlots ===
              0
            ) {
              showNotice?.(
                "error",
                "Attachment Limit Reached",
                `You can add up to ${MAX_INCIDENT_EVIDENCE_FILES} files or photos.`
              );

              return currentFiles;
            }

            const acceptedFiles =
              selectedFiles.slice(
                0,
                availableSlots
              );

            if (
              acceptedFiles.length <
              selectedFiles.length
            ) {
              showNotice?.(
                "error",
                "Attachment Limit Reached",
                `You can add only ${availableSlots} more item${availableSlots === 1 ? "" : "s"}. The limit is ${MAX_INCIDENT_EVIDENCE_FILES}.`
              );
            }

            const existingIds =
              new Set(
                currentFiles.map(
                  (
                    item
                  ) =>
                    item.id
                )
              );

            const additions =
              acceptedFiles
                .map(
                  createEvidenceItem
                )
                .filter(
                  (
                    item
                  ) => {
                    if (
                      !existingIds.has(
                        item.id
                      )
                    ) {
                      existingIds.add(
                        item.id
                      );

                      return true;
                    }

                    revokeEvidenceUrl(
                      item
                    );

                    return false;
                  }
                );

            return [
              ...currentFiles,
              ...additions,
            ];
          }
        );
      },
      [
        showNotice,
      ]
    );


  const handleRemoveFile =
    useCallback(
      (
        id
      ) => {
        if (
          isSubmitting
        ) {
          return;
        }

        setProofFiles(
          (
            currentFiles
          ) => {
            const target =
              currentFiles.find(
                (
                  item
                ) =>
                  item.id ===
                  id
              );

            if (target) {
              revokeEvidenceUrl(
                target
              );
            }

            return currentFiles.filter(
              (
                item
              ) =>
                item.id !==
                id
            );
          }
        );
      },
      [
        isSubmitting,
      ]
    );


  const handleStartPhoneCapture =
    useCallback(
      async () => {
        if (
          isSubmitting ||
          isStartingPhoneCapture
        ) {
          return;
        }

        if (
          activePhoneCaptureRef.current
        ) {
          showNotice?.(
            "error",
            "Phone Photo Already Open",
            "Finish or cancel the current phone photo before adding another."
          );

          return;
        }

        const incidentId =
          getIncidentNumericId(
            incident
          );

        if (!incidentId) {
          showNotice?.(
            "error",
            "Case Unavailable",
            "Open a valid case before adding a photo from your phone."
          );

          return;
        }

        const currentTotal =
          proofFilesRef.current
            .length +
          phoneCapturesRef.current
            .length;

        if (
          currentTotal >=
          MAX_INCIDENT_EVIDENCE_FILES
        ) {
          showNotice?.(
            "error",
            "Attachment Limit Reached",
            `You can add up to ${MAX_INCIDENT_EVIDENCE_FILES} files or photos.`
          );

          return;
        }

        try {
          setIsStartingPhoneCapture(
            true
          );

          const session =
            await createIncidentPhoneCaptureSession({
              capturePurpose:
                INCIDENT_PHONE_CAPTURE_PURPOSES
                  .WORKFLOW,

              incidentId,

              workflowAction,
            });

          setActivePhoneCapture({
            sessionId:
              session.sessionId,

            captureUrl:
              session.captureUrl,

            expiresAt:
              session.expiresAt,

            status:
              session.status,
          });
        } catch (error) {
          console.error(
            "Start resolution phone capture error:",
            error
          );

          showNotice?.(
            "error",
            "Can’t Add Phone Photo",
            "We couldn’t open the phone photo option. Please try again."
          );
        } finally {
          setIsStartingPhoneCapture(
            false
          );
        }
      },
      [
        incident,
        isStartingPhoneCapture,
        isSubmitting,
        showNotice,
        workflowAction,
      ]
    );


  const handleCancelActivePhoneCapture =
    useCallback(
      async () => {
        const sessionId =
          activePhoneCaptureRef.current
            ?.sessionId;

        if (
          !sessionId ||
          isSubmitting
        ) {
          return;
        }

        try {
          await cancelIncidentPhoneCaptureSession(
            sessionId
          );

          setActivePhoneCapture(
            null
          );
        } catch (error) {
          console.error(
            "Cancel active resolution phone capture error:",
            error
          );

          showNotice?.(
            "error",
            "Can’t Cancel Phone Photo",
            "We couldn’t cancel the phone photo. Please try again."
          );
        }
      },
      [
        isSubmitting,
        showNotice,
      ]
    );


  const handleRemovePhoneCapture =
    useCallback(
      async (
        sessionId
      ) => {
        if (
          isSubmitting
        ) {
          return;
        }

        try {
          await cancelIncidentPhoneCaptureSession(
            sessionId
          );

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
        } catch (error) {
          console.error(
            "Remove resolution phone photo error:",
            error
          );

          showNotice?.(
            "error",
            "Can’t Remove Phone Photo",
            "We couldn’t remove the phone photo. Please try again."
          );
        }
      },
      [
        isSubmitting,
        showNotice,
      ]
    );


  const validateResolution =
    useCallback(() => {
      if (
        !actionTaken.trim()
      ) {
        showNotice?.(
          "error",
          "Action Taken Needed",
          "Please enter the action taken before submitting this case for review."
        );

        return false;
      }

      if (
        !remarks.trim()
      ) {
        showNotice?.(
          "error",
          "Remarks Needed",
          "Please add remarks about how the case was handled."
        );

        return false;
      }

      if (
        activePhoneCaptureRef.current
      ) {
        showNotice?.(
          "error",
          "Phone Photo Still Pending",
          "Finish or cancel the current phone photo before submitting."
        );

        return false;
      }

      const validLocalCount =
        getValidLocalProofCount(
          proofFiles
        );

      const validPhoneCount =
        getUsablePhoneCaptureCount(
          phoneCaptures
        );

      const totalValidEvidence =
        validLocalCount +
        validPhoneCount;

      if (
        totalValidEvidence ===
        0
      ) {
        showNotice?.(
          "error",
          "Add a File or Photo",
          "Please add at least one file or phone photo before submitting for review."
        );

        return false;
      }

      if (
        totalValidEvidence >
        MAX_INCIDENT_EVIDENCE_FILES
      ) {
        showNotice?.(
          "error",
          "Too Many Attachments",
          `You can submit up to ${MAX_INCIDENT_EVIDENCE_FILES} files or photos.`
        );

        return false;
      }

      if (
        proofFiles.some(
          (
            item
          ) =>
            Boolean(
              item?.error
            )
        )
      ) {
        showNotice?.(
          "error",
          "Check Attached File",
          "Remove or replace the file with an error before submitting."
        );

        return false;
      }

      return true;
    }, [
      actionTaken,
      phoneCaptures,
      proofFiles,
      remarks,
      showNotice,
    ]);


  const handleSubmit =
    useCallback(
      async (
        event
      ) => {
        event.preventDefault();

        if (
          isSubmitting ||
          !incident ||
          !validateResolution()
        ) {
          return;
        }

        const submissionFiles =
          proofFiles.map(
            (
              item
            ) => {
              if (
                item.error
              ) {
                return item;
              }

              return {
                ...item,

                status:
                  "Uploading",
              };
            }
          );

        const phoneSessionIds =
          phoneCaptures
            .map(
              (
                item
              ) =>
                item?.sessionId
            )
            .filter(
              Boolean
            );

        let submissionSucceeded =
          false;

        try {
          setIsSubmitting(
            true
          );

          setProofFiles(
            submissionFiles
          );

          /*
           * Refresh phone descriptors immediately before
           * final PATCH so their short-lived WELLJOB
           * signatures cannot become stale while the user
           * has been completing the resolution form.
           */
          const {
            directUploads:
              phoneDirectUploads,
          } =
            await refreshIncidentPhoneCaptureDirectUploads(
              phoneSessionIds
            );

          const success =
            await onSubmit?.(
              incident,
              {
                actionTaken:
                  actionTaken.trim(),

                remarks:
                  remarks.trim(),

                proofFiles:
                  submissionFiles,

                /*
                 * Parent workflow handler must merge these
                 * with descriptors produced from local
                 * proofFiles before PATCHing the Incident.
                 */
                phoneDirectUploads,

                phoneCaptureSessionIds:
                  phoneSessionIds,

                workflowAction,
              }
            );

          if (
            success ===
            false
          ) {
            /*
             * The backend direct-upload finalizer may have
             * already removed staged objects after a failed
             * workflow request. Cancel these sessions so a
             * retry can never reuse a stale Storage path.
             *
             * Action Taken, Remarks, and local files remain
             * in the still-open desktop modal.
             */
            await cancelIncidentPhoneCaptureSessions(
              phoneSessionIds
            );

            setPhoneCaptures(
              []
            );

            setProofFiles(
              (
                currentFiles
              ) =>
                currentFiles.map(
                  (
                    item
                  ) => {
                    if (
                      item.error
                    ) {
                      return item;
                    }

                    return {
                      ...item,

                      status:
                        "Failed",

                      error:
                        "We couldn’t add this file. Please try again.",
                    };
                  }
                )
            );

            return;
          }

          /*
           * The workflow PATCH has succeeded at this point.
           *
           * Ownership of every successfully submitted phone
           * object has therefore transferred from the
           * temporary capture session to the saved Incident.
           *
           * CRITICAL:
           * Mark every submitted phone session as protected
           * from modal cleanup BEFORE calling the follow-up
           * consume endpoint.
           *
           * The consume request is bookkeeping only. If that
           * request fails after the Incident save succeeded,
           * cleanup must never cancel/delete evidence that
           * the saved Incident already owns.
           */
          phoneSessionIds.forEach(
            (
              sessionId
            ) => {
              consumedPhoneSessionIdsRef.current.add(
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
                    ) => ({
                      ...item,

                      status:
                        INCIDENT_PHONE_CAPTURE_STATUSES
                          .DONE,
                    })
                  )
              );
            } catch (consumeError) {
              /*
               * Do not roll back the successful workflow
               * submission and do not remove these session
               * IDs from the protected Set.
               *
               * Their Storage objects are already owned by
               * the saved Incident.
               */
              console.error(
                "Resolution phone capture consume bookkeeping error after successful submit:",
                consumeError
              );
            }
          }

          setProofFiles(
            (
              currentFiles
            ) =>
              currentFiles.map(
                (
                  item
                ) => {
                  if (
                    item.error
                  ) {
                    return item;
                  }

                  return {
                    ...item,

                    status:
                      "Uploaded",
                  };
                }
              )
          );

          /*
           * Incidents.jsx intentionally no longer closes
           * this modal after onSubmit() returns true.
           *
           * Close only after the ownership handoff above is
           * secured. The unmount cleanup will then skip all
           * successfully attached phone sessions even when
           * consume bookkeeping was unavailable.
           */
          submissionSucceeded =
            true;

          setIsSubmitting(
            false
          );

          onClose?.();

          return;
        } catch (error) {
          console.error(
            "Submit resolution proof error:",
            error
          );

          if (
            phoneSessionIds.length >
            0
          ) {
            await cancelIncidentPhoneCaptureSessions(
              phoneSessionIds
            );

            setPhoneCaptures(
              []
            );
          }

          setProofFiles(
            (
              currentFiles
            ) =>
              currentFiles.map(
                (
                  item
                ) => {
                  if (
                    item.error
                  ) {
                    return item;
                  }

                  return {
                    ...item,

                    status:
                      "Failed",

                    error:
                      "We couldn’t upload this file. Please try again.",
                  };
                }
              )
          );

          showNotice?.(
            "error",
            "Submission Failed",
            "We couldn’t submit this case. Please try again."
          );
        } finally {
          /*
           * Successful submission clears the flag before
           * closing the modal. Failed/aborted paths remain
           * mounted and are re-enabled here.
           */
          if (
            !submissionSucceeded
          ) {
            setIsSubmitting(
              false
            );
          }
        }
      },
      [
        actionTaken,
        incident,
        isSubmitting,
        onClose,
        onSubmit,
        phoneCaptures,
        proofFiles,
        remarks,
        showNotice,
        validateResolution,
        workflowAction,
      ]
    );


  if (!incident) {
    return null;
  }

  const incidentCode =
    incident.displayId ||
    incident.id ||
    "-";

  const employeeName =
    incident.employee ||
    incident.employeeName ||
    "Unknown Employee";

  const violation =
    incident.violation ||
    incident.violationType ||
    "-";

  const severity =
    incident.severity ||
    "-";

  const status =
    incident.status ||
    "-";

  const wasReturned =
    String(
      incident?.review
        ?.decision ||
        incident?.reviewDecision ||
        ""
    )
      .trim()
      .toLowerCase() ===
    "rejected";

  const reviewComments =
    incident?.review
      ?.comments ||
    incident?.reviewComments ||
    "The case was returned for correction.";

  const validLocalProofCount =
    getValidLocalProofCount(
      proofFiles
    );

  const validPhoneProofCount =
    getUsablePhoneCaptureCount(
      phoneCaptures
    );

  const validProofCount =
    validLocalProofCount +
    validPhoneProofCount;

  const selectedEvidenceCount =
    proofFiles.length +
    phoneCaptures.length;

  const remainingEvidenceSlots =
    Math.max(
      0,
      MAX_INCIDENT_EVIDENCE_FILES -
        selectedEvidenceCount
    );

  const hasAction =
    Boolean(
      actionTaken.trim()
    );

  const hasRemarks =
    Boolean(
      remarks.trim()
    );

  const hasEvidence =
    validProofCount >
    0;

  const hasInvalidLocalEvidence =
    proofFiles.some(
      (
        item
      ) =>
        Boolean(
          item?.error
        )
    );

  return (
    <BaseModal
      onClose={
        handleClose
      }
      title="Submit Case for Review"
      subtitle={`${incidentCode} • ${employeeName}`}
      color="green"
      size="lg"
      preventClose={
        isSubmitting
      }
    >
      <form
        onSubmit={
          handleSubmit
        }
        className="space-y-4"
      >
        {wasReturned && (
          <AlertBox
            type="error"
            title="Returned for Correction"
            message={
              reviewComments
            }
          />
        )}

        <section className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                aria-hidden="true"
              >
                <FiShield
                  size={18}
                />
              </div>

              <div className="min-w-0">
                <p className="text-sm font-extrabold text-emerald-900 dark:text-emerald-200">
                  Ready for Review
                </p>

                <p className="mt-1 max-w-2xl text-xs leading-5 text-emerald-700 dark:text-emerald-300">
                  Record what was done, add remarks, and attach any supporting files or photos before sending this case for review.
                </p>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2">
              <RequirementChip
                complete={
                  hasAction
                }
                label="Action"
              />

              <RequirementChip
                complete={
                  hasRemarks
                }
                label="Remarks"
              />

              <RequirementChip
                complete={
                  hasEvidence
                }
                label="Attachments"
              />
            </div>
          </div>
        </section>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-950/30">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              Case
            </p>

            <p className="mt-1 truncate text-sm font-bold text-slate-900 dark:text-white">
              {incidentCode}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-950/30">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              Status
            </p>

            <p className="mt-1 truncate text-sm font-bold text-slate-900 dark:text-white">
              {status}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-950/30">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              Severity
            </p>

            <p className="mt-1 truncate text-sm font-bold text-slate-900 dark:text-white">
              {severity}
            </p>
          </div>
        </div>

        <InfoCard title="Case Context">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                Employee
              </p>

              <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                {employeeName}
              </p>
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                Violation
              </p>

              <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                {violation}
              </p>
            </div>
          </div>
        </InfoCard>

        <InfoCard title="System Recommendation">
          <div className="flex items-start gap-3 rounded-xl border border-indigo-200 bg-indigo-50 p-3.5 dark:border-indigo-500/30 dark:bg-indigo-500/10">
            <FiAlertTriangle
              className="mt-0.5 shrink-0 text-indigo-600 dark:text-indigo-300"
              aria-hidden="true"
            />

            <p className="text-sm font-medium leading-6 text-indigo-700 dark:text-indigo-300">
              {incident.recommendation ||
                "No recommendation available."}
            </p>
          </div>
        </InfoCard>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center gap-3">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300"
              aria-hidden="true"
            >
              <FiMessageSquare />
            </div>

            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                Case Resolution
              </h3>

              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Record what was done and how the case was handled.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <Field
              label="Action Taken"
              required
            >
              <textarea
                rows={3}
                value={
                  actionTaken
                }
                onChange={
                  handleActionTakenChange
                }
                disabled={
                  isSubmitting
                }
                placeholder="Example: Written notice issued, suspension completed, or another corrective action taken."
                className="input-field resize-none disabled:cursor-not-allowed disabled:opacity-60"
              />

              <p className="mt-1.5 text-xs leading-5 text-slate-500 dark:text-slate-400">
                Describe the action that was completed for this case.
              </p>
            </Field>

            <Field
              label="Remarks"
              required
            >
              <textarea
                rows={4}
                value={
                  remarks
                }
                onChange={
                  handleRemarksChange
                }
                disabled={
                  isSubmitting
                }
                placeholder="Summarize the outcome and any follow-up completed."
                className="input-field resize-none disabled:cursor-not-allowed disabled:opacity-60"
              />

              <p className="mt-1.5 text-xs leading-5 text-slate-500 dark:text-slate-400">
                Add the key details the reviewer needs to understand the outcome.
              </p>
            </Field>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-3">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300"
                aria-hidden="true"
              >
                <FiFileText />
              </div>

              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                  Files and Photos
                </h3>

                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Add files from this computer or take photos with your phone. You can add up to {MAX_INCIDENT_EVIDENCE_FILES} items.
                </p>
              </div>
            </div>

            <span className="w-fit rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {selectedEvidenceCount} / {MAX_INCIDENT_EVIDENCE_FILES}
            </span>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <label
              htmlFor="resolution-proof-files"
              className={[
                "group flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-5 py-7 text-center transition",
                isSubmitting ||
                remainingEvidenceSlots ===
                  0
                  ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-60 dark:border-slate-800 dark:bg-slate-950/40"
                  : "cursor-pointer border-slate-300 bg-slate-50 hover:border-indigo-400 hover:bg-indigo-50/40 dark:border-slate-700 dark:bg-slate-950/40 dark:hover:border-indigo-500 dark:hover:bg-indigo-500/5",
              ].join(" ")}
            >
              <div
                className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200 transition group-hover:scale-105 dark:bg-slate-900 dark:text-indigo-300 dark:ring-slate-700"
                aria-hidden="true"
              >
                <FiUpload
                  size={20}
                />
              </div>

              <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Choose files
              </span>

              <span className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                Photos or PDF • You can select more than one file
              </span>

              <input
                ref={
                  fileInputRef
                }
                id="resolution-proof-files"
                type="file"
                multiple
                accept=".png,.jpg,.jpeg,.jfif,.jpe,.pdf,image/png,image/jpeg,application/pdf"
                onChange={
                  handleFileChange
                }
                disabled={
                  isSubmitting ||
                  remainingEvidenceSlots ===
                    0
                }
                className="hidden"
              />
            </label>

            <button
              type="button"
              onClick={
                handleStartPhoneCapture
              }
              disabled={
                isSubmitting ||
                isStartingPhoneCapture ||
                Boolean(
                  activePhoneCapture
                ) ||
                remainingEvidenceSlots ===
                  0
              }
              className="group flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50/50 px-5 py-7 text-center transition hover:border-emerald-500 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-500/40 dark:bg-emerald-500/5 dark:hover:bg-emerald-500/10"
            >
              <div
                className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-white text-emerald-600 shadow-sm ring-1 ring-emerald-200 transition group-hover:scale-105 dark:bg-slate-900 dark:text-emerald-300 dark:ring-emerald-500/30"
                aria-hidden="true"
              >
                {isStartingPhoneCapture ? (
                  <FiRefreshCw
                    className="animate-spin"
                    size={20}
                  />
                ) : (
                  <FiSmartphone
                    size={20}
                  />
                )}
              </div>

              <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                {isStartingPhoneCapture
                  ? "Getting QR code ready..."
                  : "Add photo from phone"}
              </span>

              <span className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                Scan the QR code with your phone, take a photo, then continue here.
              </span>
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
              Add at least one file or photo
            </span>

            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {remainingEvidenceSlots} more can be added
            </span>
          </div>

          {activePhoneCapture && (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10">
              <div className="grid gap-4 md:grid-cols-[auto_1fr] md:items-center">
                <div className="mx-auto rounded-2xl bg-white p-3 shadow-sm ring-1 ring-emerald-200 md:mx-0 dark:ring-emerald-500/30">
                  <QRCodeSVG
                    value={
                      activePhoneCapture.captureUrl
                    }
                    size={176}
                    level="M"
                    includeMargin
                  />
                </div>

                <div>
                  <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200">
                    <FiCamera
                      aria-hidden="true"
                    />

                    <p className="text-sm font-extrabold">
                      Scan this QR code with your phone
                    </p>
                  </div>

                  <p className="mt-2 text-sm leading-6 text-emerald-700 dark:text-emerald-300">
                    Use your phone camera to scan the code, take a photo, then tap <span className="font-bold">Use photo</span>. Keep this form open while you do it.
                  </p>

                  <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-emerald-700 shadow-sm ring-1 ring-emerald-200 dark:bg-slate-900 dark:text-emerald-300 dark:ring-emerald-500/30">
                    <FiRefreshCw
                      className="animate-spin"
                      aria-hidden="true"
                    />
                    Waiting for photo...
                  </div>

                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={
                        handleCancelActivePhoneCapture
                      }
                      disabled={
                        isSubmitting
                      }
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-white disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {proofFiles.length >
            0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Files from Computer
              </p>

              <ProofList
                files={
                  proofFiles
                }
                onRemove={
                  isSubmitting
                    ? undefined
                    : handleRemoveFile
                }
              />
            </div>
          )}

          {phoneCaptures.length >
            0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Phone Photos
              </p>

              <div className="space-y-2">
                {phoneCaptures.map(
                  (
                    item,
                    index
                  ) => (
                    <div
                      key={
                        item.sessionId
                      }
                      className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 sm:flex-row sm:items-center sm:justify-between dark:border-emerald-500/30 dark:bg-emerald-500/5"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-600 shadow-sm ring-1 ring-emerald-200 dark:bg-slate-900 dark:text-emerald-300 dark:ring-emerald-500/30"
                          aria-hidden="true"
                        >
                          <FiCamera />
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                            {item.name ||
                              `Phone photo ${index + 1}`}
                          </p>

                          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                            {item.size
                              ? formatFileSize(
                                  item.size
                                )
                              : "Phone-captured image"}
                            {" • "}
                            Photo added
                          </p>
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-2">
                        {item.previewUrl && (
                          <a
                            href={
                              item.previewUrl
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-bold text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-500/30 dark:bg-slate-900 dark:text-emerald-300"
                          >
                            Preview
                          </a>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            handleRemovePhoneCapture(
                              item.sessionId
                            )
                          }
                          disabled={
                            isSubmitting ||
                            item.status ===
                              INCIDENT_PHONE_CAPTURE_STATUSES
                                .DONE
                          }
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-bold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-500/30 dark:bg-slate-900 dark:text-red-300"
                        >
                          <FiTrash2
                            aria-hidden="true"
                          />
                          Remove
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </section>

        <ModalFooter>
          <Button
            type="button"
            variant="secondary"
            disabled={
              isSubmitting
            }
            onClick={
              handleClose
            }
          >
            Cancel
          </Button>

          <Button
            type="submit"
            variant="success"
            leftIcon={
              <FiCheckCircle
                aria-hidden="true"
              />
            }
            loading={
              isSubmitting
            }
            disabled={
              isSubmitting ||
              hasInvalidLocalEvidence ||
              Boolean(
                activePhoneCapture
              )
            }
          >
            {isSubmitting
              ? "Submitting..."
              : "Submit for Review"}
          </Button>
        </ModalFooter>
      </form>
    </BaseModal>
  );
}