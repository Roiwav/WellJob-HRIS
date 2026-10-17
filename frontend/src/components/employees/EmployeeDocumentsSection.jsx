import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  FiCamera,
  FiCheck,
  FiChevronDown,
  FiFileText,
  FiUploadCloud,
} from "react-icons/fi";

import {
  getDocumentFileName,
  hasDocumentFile,
  isDocumentComplete,
  prepareEmployeeDocumentCameraFile,
} from "../../utils/employees/employeeFormHelpers";

import {
  DOCUMENT_NUMBER_MAX_LENGTH,
  DOCUMENT_OPTIONS,
  getDocumentStatus,
} from "./employeeConstants";

import {
  ErrorText,
  StatusPill,
} from "./EmployeeComponents";

const DATE_INPUT_CLASS_NAME =
  "min-h-10 w-full rounded-xl border bg-white px-3 py-2 " +
  "text-sm font-semibold text-gray-900 outline-none transition " +
  "focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 " +
  "disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 " +
  "dark:border-slate-700 dark:bg-slate-800 dark:text-white " +
  "dark:focus:border-indigo-400 dark:focus:ring-indigo-400/20";

const DATE_ERROR_CLASS_NAME =
  "border-red-500 focus:border-red-500 focus:ring-red-500/20";

function normalizeDocumentTargetValue(
  value
) {
  return String(
    value ?? ""
  )
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactDocumentTargetValue(
  value
) {
  return normalizeDocumentTargetValue(
    value
  ).replace(/\s+/g, "");
}

function getDocumentTargetTokens(
  value
) {
  return normalizeDocumentTargetValue(
    value
  )
    .split(" ")
    .filter(Boolean);
}

function getDocumentRecordId(
  document
) {
  return String(
    document?.id ??
      document?.documentId ??
      document?.document_id ??
      ""
  ).trim();
}

function getDocumentRefKey(
  document,
  index
) {
  const recordId =
    getDocumentRecordId(
      document
    );

  if (recordId) {
    return `id:${recordId}`;
  }

  const normalizedName =
    normalizeDocumentTargetValue(
      document?.name
    );

  if (normalizedName) {
    return `name:${normalizedName}`;
  }

  return `index:${index}`;
}

function documentNamesMatch(
  documentName,
  focusDocumentName
) {
  const documentNormalized =
    normalizeDocumentTargetValue(
      documentName
    );

  const targetNormalized =
    normalizeDocumentTargetValue(
      focusDocumentName
    );

  if (
    !documentNormalized ||
    !targetNormalized
  ) {
    return false;
  }

  if (
    documentNormalized ===
    targetNormalized
  ) {
    return true;
  }

  const documentCompact =
    compactDocumentTargetValue(
      documentName
    );

  const targetCompact =
    compactDocumentTargetValue(
      focusDocumentName
    );

  if (
    documentCompact &&
    targetCompact &&
    (
      documentCompact ===
        targetCompact ||
      (
        Math.min(
          documentCompact.length,
          targetCompact.length
        ) >= 6 &&
        (
          documentCompact.includes(
            targetCompact
          ) ||
          targetCompact.includes(
            documentCompact
          )
        )
      )
    )
  ) {
    return true;
  }

  /*
   * Employee edit documents come from predefined
   * document options while backend alert labels may
   * contain punctuation or slightly expanded names.
   *
   * Example:
   *   "NBI/Police Clearance"
   *   "NBI Clearance"
   *
   * Require at least one meaningful token match and
   * a strong overlap ratio so generic words such as
   * "Clearance" cannot match the wrong document.
   */
  const genericTokens =
    new Set([
      "clearance",
      "certificate",
      "certification",
      "document",
      "record",
      "copy",
      "card",
      "id",
    ]);

  const documentTokens =
    getDocumentTargetTokens(
      documentName
    );

  const targetTokens =
    getDocumentTargetTokens(
      focusDocumentName
    );

  const documentTokenSet =
    new Set(
      documentTokens
    );

  const commonTokens =
    targetTokens.filter(
      (token) =>
        documentTokenSet.has(
          token
        )
    );

  const meaningfulCommonTokens =
    commonTokens.filter(
      (token) =>
        !genericTokens.has(
          token
        )
    );

  const shorterTokenCount =
    Math.max(
      1,
      Math.min(
        documentTokens.length,
        targetTokens.length
      )
    );

  const overlapRatio =
    commonTokens.length /
    shorterTokenCount;

  return (
    meaningfulCommonTokens.length >
      0 &&
    overlapRatio >=
      0.6
  );
}

function isTargetComplianceDocument({
  document,
  focusDocumentId,
  focusDocumentName,
}) {
  const targetId =
    String(
      focusDocumentId ??
        ""
    ).trim();

  const documentId =
    getDocumentRecordId(
      document
    );

  if (
    targetId &&
    documentId &&
    targetId ===
      documentId
  ) {
    return true;
  }

  return documentNamesMatch(
    document?.name,
    focusDocumentName
  );
}

function getScrollableAncestor(
  element
) {
  let current =
    element?.parentElement ||
    null;

  while (
    current &&
    current !==
      document.body
  ) {
    const styles =
      window.getComputedStyle(
        current
      );

    const overflowY =
      styles.overflowY;

    const canScroll =
      (
        overflowY ===
          "auto" ||
        overflowY ===
          "scroll" ||
        overflowY ===
          "overlay"
      ) &&
      current.scrollHeight >
        current.clientHeight;

    if (canScroll) {
      return current;
    }

    current =
      current.parentElement;
  }

  return null;
}

function scrollTargetIntoContainer(
  targetElement
) {
  if (!targetElement) {
    return;
  }

  const scrollContainer =
    getScrollableAncestor(
      targetElement
    );

  if (!scrollContainer) {
    targetElement.scrollIntoView({
      behavior:
        "auto",
      block:
        "center",
      inline:
        "nearest",
    });

    return;
  }

  const containerRect =
    scrollContainer.getBoundingClientRect();

  const targetRect =
    targetElement.getBoundingClientRect();

  const targetCenter =
    targetRect.top +
    targetRect.height / 2;

  const containerCenter =
    containerRect.top +
    containerRect.height / 2;

  const nextScrollTop =
    Math.max(
      0,
      scrollContainer.scrollTop +
        (
          targetCenter -
          containerCenter
        )
    );

  scrollContainer.scrollTo({
    top:
      nextScrollTop,
    behavior:
      "auto",
  });
}

export default function EmployeeDocumentsSection({
  documents = [],
  errors = {},
  expanded = false,
  disabled = false,
  dragTargetDocument = "",
  focusDocumentId = "",
  focusDocumentName = "",
  onToggle,
  onDocumentCheck,
  onDocumentNumberChange,
  onExpirationChange,
  onFileSelect,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onFileDrop,
}) {
  const safeDocuments =
    useMemo(
      () =>
        Array.isArray(
          documents
        )
          ? documents
          : [],
      [
        documents,
      ]
    );

  const completedCount =
    safeDocuments.filter(
      isDocumentComplete
    ).length;
  const totalDocuments = DOCUMENT_OPTIONS.length;

  const sectionRef = useRef(null);
  const contentRef = useRef(null);
  const wasExpandedRef = useRef(false);
  const documentCardRefs = useRef(new Map());
  const focusScrollTimerRef = useRef(null);
  const focusHighlightTimerRef = useRef(null);

  const [
    highlightedDocumentKey,
    setHighlightedDocumentKey,
  ] = useState("");

  const [cameraPreparing, setCameraPreparing] = useState({});
  const [cameraErrors, setCameraErrors] = useState({});

  const handleCameraPhoto = async (
    documentName,
    file
  ) => {
    if (!file || disabled) {
      return;
    }

    setCameraErrors((current) => ({
      ...current,
      [documentName]: "",
    }));

    setCameraPreparing((current) => ({
      ...current,
      [documentName]: true,
    }));

    try {
      const preparedFile =
        await prepareEmployeeDocumentCameraFile(file);

      onFileSelect?.(
        documentName,
        preparedFile
      );
    } catch (error) {
      console.error(
        "Employee document camera photo error:",
        error
      );

      setCameraErrors((current) => ({
        ...current,
        [documentName]:
          "We couldn't prepare this photo. Please try again.",
      }));
    } finally {
      setCameraPreparing((current) => ({
        ...current,
        [documentName]: false,
      }));
    }
  };

  const hasExactFocusTarget =
    Boolean(
      String(
        focusDocumentId ??
          ""
      ).trim() ||
      String(
        focusDocumentName ??
          ""
      ).trim()
    );

  useEffect(() => {
    if (!expanded) {
      wasExpandedRef.current = false;
      return undefined;
    }

    /*
     * When a notification points to one exact document,
     * the dedicated target effect below owns scrolling.
     * This prevents the general section scroll from
     * competing with the exact-card scroll.
     */
    if (hasExactFocusTarget) {
      wasExpandedRef.current = true;
      return undefined;
    }

    if (wasExpandedRef.current) {
      return undefined;
    }

    wasExpandedRef.current = true;

    const timer = window.setTimeout(() => {
      const target =
        contentRef.current ||
        sectionRef.current;

      target?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 120);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    expanded,
    hasExactFocusTarget,
  ]);

  useEffect(() => {
    if (
      !expanded ||
      !hasExactFocusTarget
    ) {
      setHighlightedDocumentKey(
        ""
      );

      return undefined;
    }

    let cancelled =
      false;

    let retryCount =
      0;

    const maxRetries =
      16;

    const locateAndFocusTarget =
      () => {
        if (cancelled) {
          return;
        }

        const targetIndex =
          safeDocuments.findIndex(
            (document) =>
              isTargetComplianceDocument({
                document,
                focusDocumentId,
                focusDocumentName,
              })
          );

        if (targetIndex < 0) {
          if (
            retryCount <
            maxRetries
          ) {
            retryCount +=
              1;

            focusScrollTimerRef.current =
              window.setTimeout(
                locateAndFocusTarget,
                140
              );
          }

          return;
        }

        const targetDocument =
          safeDocuments[
            targetIndex
          ];

        const targetKey =
          getDocumentRefKey(
            targetDocument,
            targetIndex
          );

        setHighlightedDocumentKey(
          targetKey
        );

        focusScrollTimerRef.current =
          window.setTimeout(
            () => {
              if (cancelled) {
                return;
              }

              const targetElement =
                documentCardRefs.current.get(
                  targetKey
                );

              if (!targetElement) {
                if (
                  retryCount <
                  maxRetries
                ) {
                  retryCount +=
                    1;

                  locateAndFocusTarget();
                }

                return;
              }

              /*
               * The Edit Employee form uses its own nested
               * overflow-y-auto modal body. Scrolling the
               * card with scrollIntoView() alone is not
               * reliable enough because the browser may
               * choose the page or another ancestor.
               *
               * Scroll the nearest actual scroll container
               * so the exact compliance card is centered
               * inside the Edit Employee modal.
               */
              scrollTargetIntoContainer(
                targetElement
              );

              try {
                targetElement.focus({
                  preventScroll:
                    true,
                });
              } catch {
                targetElement.focus?.();
              }

              /*
               * One additional frame lets the expanded
               * accordion finish layout before we confirm
               * the target position. This is important
               * when the modal opens directly from a
               * notification deep-link.
               */
              window.requestAnimationFrame(
                () => {
                  if (
                    !cancelled
                  ) {
                    scrollTargetIntoContainer(
                      targetElement
                    );
                  }
                }
              );

              focusScrollTimerRef.current =
                null;
            },
            100
          );

        if (
          focusHighlightTimerRef.current
        ) {
          window.clearTimeout(
            focusHighlightTimerRef.current
          );
        }

        focusHighlightTimerRef.current =
          window.setTimeout(
            () => {
              if (!cancelled) {
                setHighlightedDocumentKey(
                  ""
                );
              }

              focusHighlightTimerRef.current =
                null;
            },
            5000
          );
      };

    locateAndFocusTarget();

    return () => {
      cancelled =
        true;

      if (
        focusScrollTimerRef.current
      ) {
        window.clearTimeout(
          focusScrollTimerRef.current
        );

        focusScrollTimerRef.current =
          null;
      }

      if (
        focusHighlightTimerRef.current
      ) {
        window.clearTimeout(
          focusHighlightTimerRef.current
        );

        focusHighlightTimerRef.current =
          null;
      }
    };
  }, [
    expanded,
    focusDocumentId,
    focusDocumentName,
    hasExactFocusTarget,
    safeDocuments,
  ]);

  useEffect(
    () => () => {
      if (
        focusScrollTimerRef.current
      ) {
        window.clearTimeout(
          focusScrollTimerRef.current
        );
      }

      if (
        focusHighlightTimerRef.current
      ) {
        window.clearTimeout(
          focusHighlightTimerRef.current
        );
      }

      documentCardRefs.current.clear();
    },
    []
  );

  return (
    <section
      ref={sectionRef}
      className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-slate-900/60"
    >
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        aria-expanded={expanded}
        aria-controls="employee-compliance-documents"
        className={[
          "flex w-full items-center justify-between gap-3 p-4 text-left sm:p-5",
          "transition hover:bg-gray-50",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-inset",
          "focus-visible:ring-indigo-500",
          "disabled:cursor-not-allowed disabled:opacity-60",
          "dark:hover:bg-white/5",
        ].join(" ")}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
            <FiFileText aria-hidden="true" />
          </div>

          <div className="min-w-0">
            <h3 className="font-extrabold text-gray-900 dark:text-white">
              Compliance Documents
            </h3>

            <p className="mt-0.5 text-xs leading-5 text-gray-500 dark:text-gray-400">
              Add available compliance documents now. Remaining requirements can be completed later.
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <StatusPill
            tone={completedCount === totalDocuments ? "green" : "slate"}
          >
            {completedCount} of {totalDocuments} completed
          </StatusPill>

          <FiChevronDown
            aria-hidden="true"
            className={[
              "text-gray-400 transition-transform duration-200",
              expanded ? "rotate-180" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          />
        </div>
      </button>

      {errors.general && (
        <div
          role="alert"
          className="border-t border-red-200 bg-red-50 px-5 py-3 text-xs font-semibold text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"
        >
          {errors.general}
        </div>
      )}

      {expanded && (
        <div
          ref={contentRef}
          id="employee-compliance-documents"
          className="scroll-mt-4 border-t border-gray-200 bg-gray-50/70 p-4 dark:border-white/10 dark:bg-slate-950/30 sm:p-5"
        >
          <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5 text-xs font-medium leading-5 text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300">
            Select a document to add its details.
          </div>

          <div className="grid min-w-0 gap-3 xl:grid-cols-2">
            {safeDocuments.map((document, index) => {
              const documentRefKey =
                getDocumentRefKey(
                  document,
                  index
                );

              const isNotificationTarget =
                highlightedDocumentKey ===
                documentRefKey;

              const documentStatus = document.expirable
                ? getDocumentStatus(document.expirationDate)
                : "Permanent";

              const hasFile = hasDocumentFile(document);
              const fileName = getDocumentFileName(document);
              const expirationError = errors[document.name];
              const fileError = errors[`${document.name}_file`];
              const documentNumberError =
                errors[`${document.name}_number`];

              const cameraError =
                cameraErrors[document.name] || "";

              const isPreparingCamera =
                Boolean(cameraPreparing[document.name]);

              const isRisky =
                document.checked &&
                ["Expired", "Expiring Soon"].includes(documentStatus);

              const isDragging =
                dragTargetDocument === document.name;

              const documentInputId =
                `employee-document-${document.name}`;

              const expirationInputId =
                `employee-document-expiration-${document.name}`;

              const documentNumberInputId =
                `employee-document-number-${document.name}`;

              const cameraInputId =
                `employee-document-camera-${document.name}`;

              const uploadInputId =
                `employee-document-upload-${document.name}`;

              return (
                <article
                  key={
                    documentRefKey
                  }
                  ref={(node) => {
                    if (node) {
                      documentCardRefs.current.set(
                        documentRefKey,
                        node
                      );
                    } else {
                      documentCardRefs.current.delete(
                        documentRefKey
                      );
                    }
                  }}
                  tabIndex={-1}
                  aria-current={
                    isNotificationTarget
                      ? "true"
                      : undefined
                  }
                  className={[
                    "scroll-mt-24 rounded-xl border bg-white p-3.5 shadow-sm transition duration-300 focus:outline-none dark:bg-slate-900",
                    isNotificationTarget
                      ? "border-indigo-500 bg-indigo-50/80 ring-4 ring-indigo-500/20 dark:border-indigo-400 dark:bg-indigo-500/10 dark:ring-indigo-400/20"
                      : document.checked
                        ? "border-indigo-300 ring-1 ring-indigo-100 dark:border-indigo-500/40 dark:ring-indigo-500/10"
                        : "border-gray-200 hover:border-indigo-200 dark:border-white/10 dark:hover:border-indigo-500/30",
                  ].join(" ")}
                >
                  <div className="flex items-start gap-3">
                    <input
                      id={documentInputId}
                      type="checkbox"
                      checked={Boolean(document.checked)}
                      disabled={disabled}
                      onChange={() => onDocumentCheck?.(document.name)}
                      className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:cursor-not-allowed"
                    />

                    <div className="min-w-0 flex-1">
                      <label
                        htmlFor={documentInputId}
                        className="flex cursor-pointer items-start justify-between gap-3"
                      >
                        <span className="font-bold text-gray-900 dark:text-white">
                          {document.name}
                        </span>

                        <StatusPill
                          tone={document.expirable ? "amber" : "green"}
                        >
                          {document.expirable
                            ? "With Expiration"
                            : "No Expiration"}
                        </StatusPill>
                      </label>

                      {document.checked && (
                        <div className="mt-4 space-y-4">
                          {document.requiresDocumentNumber && (
                            <div>
                              <label
                                htmlFor={documentNumberInputId}
                                className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400"
                              >
                                {document.documentNumberLabel ||
                                  "Document Number"}
                              </label>

                              <input
                                id={documentNumberInputId}
                                type="text"
                                inputMode="numeric"
                                autoComplete="off"
                                value={document.documentNumber || ""}
                                maxLength={DOCUMENT_NUMBER_MAX_LENGTH}
                                disabled={disabled}
                                placeholder={
                                  document.documentNumberPlaceholder ||
                                  "Enter document number"
                                }
                                aria-invalid={Boolean(documentNumberError)}
                                onChange={(event) =>
                                  onDocumentNumberChange?.(
                                    document.name,
                                    event.target.value
                                  )
                                }
                                className={[
                                  DATE_INPUT_CLASS_NAME,
                                  documentNumberError
                                    ? DATE_ERROR_CLASS_NAME
                                    : "",
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                              />

                              <p className="mt-1.5 text-xs leading-5 text-gray-400">
                                Enter the number shown on the document.
                              </p>

                              <ErrorText>{documentNumberError}</ErrorText>
                            </div>
                          )}

                          {document.expirable && (
                            <div>
                              <label
                                htmlFor={expirationInputId}
                                className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400"
                              >
                                Expiration Date
                              </label>

                              <input
                                id={expirationInputId}
                                type="date"
                                value={document.expirationDate || ""}
                                disabled={disabled}
                                aria-invalid={Boolean(expirationError)}
                                onChange={(event) =>
                                  onExpirationChange?.(
                                    document.name,
                                    event.target.value
                                  )
                                }
                                className={[
                                  DATE_INPUT_CLASS_NAME,
                                  expirationError
                                    ? DATE_ERROR_CLASS_NAME
                                    : "",
                                ]
                                  .filter(Boolean)
                                  .join(" ")}
                              />

                              <ErrorText>{expirationError}</ErrorText>

                              {document.expirationDate && (
                                <p
                                  className={[
                                    "mt-1.5 text-xs font-semibold",
                                    isRisky
                                      ? "text-red-600 dark:text-red-400"
                                      : "text-emerald-600 dark:text-emerald-400",
                                  ].join(" ")}
                                >
                                  Status: {documentStatus}
                                </p>
                              )}
                            </div>
                          )}

                          <div>
                            <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                              Attach File
                            </p>

                            <div
                              onDragEnter={(event) =>
                                onDragEnter?.(event, document.name)
                              }
                              onDragOver={(event) =>
                                onDragOver?.(event, document.name)
                              }
                              onDragLeave={onDragLeave}
                              onDrop={(event) =>
                                onFileDrop?.(event, document.name)
                              }
                              className={[
                                "rounded-xl border border-dashed p-3 transition",
                                disabled ? "opacity-60" : "",
                                isDragging
                                  ? "border-indigo-500 bg-indigo-50 ring-4 ring-indigo-500/10 dark:border-indigo-400 dark:bg-indigo-500/10"
                                  : "border-gray-300 bg-gray-50 dark:border-white/10 dark:bg-slate-800/70",
                              ]
                                .filter(Boolean)
                                .join(" ")}
                            >
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-indigo-600 shadow-sm dark:bg-slate-900 dark:text-indigo-300">
                                  <FiUploadCloud aria-hidden="true" />
                                </div>

                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-bold text-gray-800 dark:text-gray-100">
                                    {hasFile
                                      ? "File attached"
                                      : "Add a file"}
                                  </p>

                                  <p className="mt-0.5 text-xs text-gray-400">
                                    PNG, JPEG or PDF • Max 5MB
                                  </p>
                                </div>
                              </div>

                              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                                <label
                                  htmlFor={
                                    isPreparingCamera
                                      ? undefined
                                      : cameraInputId
                                  }
                                  aria-disabled={
                                    disabled ||
                                    isPreparingCamera
                                  }
                                  className={[
                                    "inline-flex min-h-10 items-center justify-center gap-2",
                                    "rounded-lg border px-3 py-2 text-sm font-bold transition",
                                    "md:hidden",
                                    disabled || isPreparingCamera
                                      ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500"
                                      : "cursor-pointer border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300",
                                  ].join(" ")}
                                >
                                  <FiCamera aria-hidden="true" />
                                  {isPreparingCamera
                                    ? "Preparing..."
                                    : "Take Photo"}
                                </label>

                                <input
                                  id={cameraInputId}
                                  type="file"
                                  accept="image/*"
                                  capture="environment"
                                  disabled={
                                    disabled ||
                                    isPreparingCamera
                                  }
                                  className="hidden"
                                  onChange={async (event) => {
                                    const file =
                                      event.target.files?.[0];

                                    event.target.value = "";

                                    await handleCameraPhoto(
                                      document.name,
                                      file
                                    );
                                  }}
                                />

                                <label
                                  htmlFor={uploadInputId}
                                  className={[
                                    "inline-flex min-h-10 flex-1 items-center justify-center gap-2",
                                    "rounded-lg border px-3 py-2 text-sm font-bold transition",
                                    disabled
                                      ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-500"
                                      : "cursor-pointer border-gray-300 bg-white text-gray-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-indigo-500/40 dark:hover:bg-indigo-500/10",
                                  ].join(" ")}
                                >
                                  <FiUploadCloud aria-hidden="true" />
                                  {hasFile ? "Replace File" : "Upload File"}
                                </label>

                                <input
                                  id={uploadInputId}
                                  type="file"
                                  accept="image/png,image/jpeg,application/pdf"
                                  disabled={disabled}
                                  className="hidden"
                                  onChange={(event) => {
                                    const file =
                                      event.target.files?.[0];

                                    event.target.value = "";

                                    if (!file) {
                                      return;
                                    }

                                    setCameraErrors((current) => ({
                                      ...current,
                                      [document.name]: "",
                                    }));

                                    onFileSelect?.(
                                      document.name,
                                      file
                                    );
                                  }}
                                />
                              </div>

                              <p className="mt-2 hidden text-center text-[11px] font-medium text-gray-400 md:block">
                                You can also drag and drop a file here.
                              </p>

                              {isPreparingCamera && (
                                <p className="mt-2 text-center text-xs font-medium text-indigo-600 dark:text-indigo-300 md:hidden">
                                  Preparing photo...
                                </p>
                              )}
                            </div>

                            {cameraError && (
                              <p
                                role="alert"
                                className="mt-1.5 text-xs font-semibold leading-5 text-red-600 dark:text-red-400"
                              >
                                {cameraError}
                              </p>
                            )}

                            <ErrorText>{fileError}</ErrorText>

                            {hasFile && (
                              <div className="mt-2 flex min-w-0 items-start gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                <FiCheck
                                  aria-hidden="true"
                                  className="mt-0.5 shrink-0"
                                />

                                <span className="min-w-0 break-all leading-5">
                                  {fileName || "File attached"}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}