import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  FiAlertCircle,
  FiCamera,
  FiCheckCircle,
  FiImage,
  FiRefreshCw,
  FiRotateCcw,
  FiShield,
  FiSmartphone,
} from "react-icons/fi";

import {
  INCIDENT_PHONE_CAPTURE_STATUSES,
  getIncidentPhoneCapturePublicStatus,
  getIncidentPhoneCaptureTokenFromHash,
  uploadIncidentPhoneCapturePhoto,
} from "../utils/incidents/incidentPhoneCapture";


const ACCEPTED_PHONE_IMAGE_TYPES =
  new Set([
    "image/jpeg",
    "image/png",
  ]);

const MAX_PHONE_IMAGE_SIZE =
  5 * 1024 * 1024;


function formatFileSize(
  bytes
) {
  const value =
    Number(
      bytes
    );

  if (
    !Number.isFinite(
      value
    ) ||
    value <= 0
  ) {
    return "0 B";
  }

  if (
    value <
    1024
  ) {
    return `${value} B`;
  }

  if (
    value <
    1024 * 1024
  ) {
    return `${(
      value /
      1024
    ).toFixed(
      1
    )} KB`;
  }

  return `${(
    value /
    (
      1024 *
      1024
    )
  ).toFixed(
    1
  )} MB`;
}


function getInitialViewState() {
  return {
    mode:
      "checking",

    title:
      "Opening phone capture...",

    message:
      "Please wait while the secure photo session is checked.",

    retryable:
      false,
  };
}


export default function IncidentPhoneCapture() {
  const fileInputRef =
    useRef(null);

  const selectedPhotoUrlRef =
    useRef("");

  const requestControllerRef =
    useRef(null);

  const [
    captureToken,
    setCaptureToken,
  ] = useState("");

  const [
    selectedPhoto,
    setSelectedPhoto,
  ] = useState(null);

  const [
    selectedPhotoUrl,
    setSelectedPhotoUrl,
  ] = useState("");

  const [
    isUploading,
    setIsUploading,
  ] = useState(false);

  const [
    isDone,
    setIsDone,
  ] = useState(false);

  const [
    viewState,
    setViewState,
  ] = useState(
    getInitialViewState
  );

  const [
    photoValidationError,
    setPhotoValidationError,
  ] = useState("");


  const revokeSelectedPhotoUrl =
    useCallback(() => {
      const currentUrl =
        selectedPhotoUrlRef.current;

      if (currentUrl) {
        URL.revokeObjectURL(
          currentUrl
        );

        selectedPhotoUrlRef.current =
          "";
      }

      setSelectedPhotoUrl(
        ""
      );
    }, []);


  const clearSelectedPhoto =
    useCallback(() => {
      revokeSelectedPhotoUrl();

      setSelectedPhoto(
        null
      );

      if (
        fileInputRef.current
      ) {
        fileInputRef.current.value =
          "";
      }
    }, [
      revokeSelectedPhotoUrl,
    ]);


  const showError =
    useCallback(
      (
        title,
        message,
        {
          retryable = false,
        } = {}
      ) => {
        setPhotoValidationError(
          ""
        );

        setViewState({
          mode:
            "error",

          title,

          message,

          retryable,
        });
      },
      []
    );


  useEffect(() => {
    const token =
      getIncidentPhoneCaptureTokenFromHash();

    if (!token) {
      showError(
        "Invalid phone capture",
        "This QR code is invalid. Return to the desktop form and create a new phone capture."
      );

      return undefined;
    }

    setCaptureToken(
      token
    );

    const controller =
      new AbortController();

    requestControllerRef.current =
      controller;

    const loadSession =
      async () => {
        try {
          const data =
            await getIncidentPhoneCapturePublicStatus(
              token,
              {
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

          const status =
            String(
              data?.status ||
              ""
            ).trim();

          if (
            status ===
              INCIDENT_PHONE_CAPTURE_STATUSES
                .PHOTO_ADDED
          ) {
            setPhotoValidationError(
              ""
            );

            setViewState({
              mode:
                "uploaded",

              title:
                "Photo added",

              message:
                "The photo is already available on the desktop form.",

              retryable:
                false,
            });

            return;
          }

          if (
            status ===
              INCIDENT_PHONE_CAPTURE_STATUSES
                .DONE
          ) {
            setPhotoValidationError(
              ""
            );

            setViewState({
              mode:
                "uploaded",

              title:
                "Photo added",

              message:
                "This photo has already been added to the Incident evidence.",

              retryable:
                false,
            });

            return;
          }

          if (
            status ===
              INCIDENT_PHONE_CAPTURE_STATUSES
                .CANCELLED
          ) {
            showError(
              "Phone capture cancelled",
              "This phone capture is no longer available. Return to the desktop form and create a new one."
            );

            return;
          }

          setPhotoValidationError(
            ""
          );

          setViewState({
            mode:
              "ready",

            title:
              "Add photo from phone",

            message:
              "Take a clear photo of the physical evidence, review it, then tap Use photo.",

            retryable:
              false,
          });
        } catch (error) {
          if (
            error?.name ===
            "AbortError"
          ) {
            return;
          }

          const code =
            String(
              error?.code ||
              ""
            ).trim();

          const isExpired =
            code ===
              "CAPTURE_SESSION_EXPIRED" ||
            Number(
              error?.status
            ) ===
              410;

          const isUnavailable =
            code ===
              "CAPTURE_SESSION_NOT_FOUND" ||
            code ===
              "INVALID_CAPTURE_LINK" ||
            code ===
              "CAPTURE_SESSION_CANCELLED" ||
            Number(
              error?.status
            ) ===
              404;

          showError(
            isExpired
              ? "QR code expired"
              : isUnavailable
                ? "Phone capture unavailable"
                : "Unable to open phone capture",
            isExpired ||
            isUnavailable
              ? "Return to the desktop form and create a new phone capture."
              : "Check your connection, then try opening this phone capture again.",
            {
              retryable:
                !isExpired &&
                !isUnavailable,
            }
          );
        }
      };

    void loadSession();

    return () => {
      controller.abort();

      if (
        requestControllerRef.current ===
        controller
      ) {
        requestControllerRef.current =
          null;
      }
    };
  }, [
    showError,
  ]);


  useEffect(() => {
    selectedPhotoUrlRef.current =
      selectedPhotoUrl;
  }, [
    selectedPhotoUrl,
  ]);


  useEffect(() => {
    return () => {
      const currentUrl =
        selectedPhotoUrlRef.current;

      if (currentUrl) {
        URL.revokeObjectURL(
          currentUrl
        );
      }

      requestControllerRef.current
        ?.abort();
    };
  }, []);


  const handleTakePhoto =
    useCallback(() => {
      if (
        isUploading
      ) {
        return;
      }

      setPhotoValidationError(
        ""
      );

      fileInputRef.current
        ?.click();
    }, [
      isUploading,
    ]);


  const handlePhotoChange =
    useCallback(
      (
        event
      ) => {
        const file =
          Array.from(
            event.target.files ||
              []
          )[0] ||
          null;

        event.target.value =
          "";

        if (!file) {
          return;
        }

        const mimeType =
          String(
            file.type ||
            ""
          )
            .trim()
            .toLowerCase();

        if (
          !ACCEPTED_PHONE_IMAGE_TYPES.has(
            mimeType
          )
        ) {
          clearSelectedPhoto();

          setPhotoValidationError(
            "Use a JPG, JPEG, or PNG photo."
          );

          setViewState({
            mode:
              "ready",

            title:
              "Choose another photo",

            message:
              "The selected file cannot be used. Take or choose a supported photo.",

            retryable:
              false,
          });

          return;
        }

        if (
          file.size <= 0 ||
          file.size >
            MAX_PHONE_IMAGE_SIZE
        ) {
          clearSelectedPhoto();

          setPhotoValidationError(
            "Use a photo no larger than 5 MB."
          );

          setViewState({
            mode:
              "ready",

            title:
              "Choose another photo",

            message:
              "The selected photo is too large. Take or choose a smaller photo.",

            retryable:
              false,
          });

          return;
        }

        setPhotoValidationError(
          ""
        );

        revokeSelectedPhotoUrl();

        const localUrl =
          URL.createObjectURL(
            file
          );

        selectedPhotoUrlRef.current =
          localUrl;

        setSelectedPhotoUrl(
          localUrl
        );

        setSelectedPhoto(
          file
        );

        setViewState({
          mode:
            "preview",

          title:
            "Review photo",

          message:
            "Make sure the document is clear and readable before using this photo.",

          retryable:
            false,
        });
      },
      [
        clearSelectedPhoto,
        revokeSelectedPhotoUrl,
      ]
    );


  const handleRetake =
    useCallback(() => {
      if (
        isUploading
      ) {
        return;
      }

      clearSelectedPhoto();

      setPhotoValidationError(
        ""
      );

      setViewState({
        mode:
          "ready",

        title:
          "Add photo from phone",

        message:
          "Take a new photo of the physical evidence.",

        retryable:
          false,
      });

      window.setTimeout(
        () => {
          fileInputRef.current
            ?.click();
        },
        0
      );
    }, [
      clearSelectedPhoto,
      isUploading,
    ]);


  const handleUsePhoto =
    useCallback(
      async () => {
        if (
          isUploading ||
          !captureToken ||
          !selectedPhoto
        ) {
          return;
        }

        const controller =
          new AbortController();

        requestControllerRef.current =
          controller;

        try {
          setIsUploading(
            true
          );

          setPhotoValidationError(
            ""
          );

          setViewState({
            mode:
              "uploading",

            title:
              "Adding photo...",

            message:
              "Keep this page open while the photo is securely added to the desktop form.",

            retryable:
              false,
          });

          await uploadIncidentPhoneCapturePhoto({
            captureToken,
            file:
              selectedPhoto,
            signal:
              controller.signal,
          });

          if (
            controller.signal
              .aborted
          ) {
            return;
          }

          clearSelectedPhoto();

          setViewState({
            mode:
              "uploaded",

            title:
              "Photo added",

            message:
              "The photo is now available on the desktop form.",

            retryable:
              false,
          });
        } catch (error) {
          if (
            error?.name ===
            "AbortError"
          ) {
            return;
          }

          console.error(
            "Incident phone photo upload error:",
            error
          );

          const code =
            String(
              error?.code ||
              ""
            ).trim();

          const isExpired =
            code ===
              "CAPTURE_SESSION_EXPIRED" ||
            Number(
              error?.status
            ) ===
              410;

          const isUnavailable =
            code ===
              "CAPTURE_SESSION_NOT_FOUND" ||
            code ===
              "INVALID_CAPTURE_LINK" ||
            code ===
              "CAPTURE_SESSION_CANCELLED" ||
            Number(
              error?.status
            ) ===
              404;

          if (
            isExpired ||
            isUnavailable
          ) {
            showError(
              isExpired
                ? "QR code expired"
                : "Phone capture unavailable",
              "Return to the desktop form and create a new phone capture."
            );
          } else {
            setViewState({
              mode:
                "preview",

              title:
                "Photo could not be added",

              message:
                "Check your connection and tap Use photo again. Your selected photo is still available.",

              retryable:
                false,
            });
          }
        } finally {
          if (
            requestControllerRef.current ===
            controller
          ) {
            requestControllerRef.current =
              null;
          }

          setIsUploading(
            false
          );
        }
      },
      [
        captureToken,
        clearSelectedPhoto,
        isUploading,
        selectedPhoto,
        showError,
      ]
    );


  const handleDone =
    useCallback(() => {
      clearSelectedPhoto();

      setIsDone(
        true
      );
    }, [
      clearSelectedPhoto,
    ]);


  const mode =
    viewState.mode;

  const isReady =
    mode ===
      "ready";

  const isPreview =
    mode ===
      "preview";

  const isChecking =
    mode ===
      "checking";

  const isUploaded =
    mode ===
      "uploaded";

  const isError =
    mode ===
      "error";

  const canRetryOpen =
    isError &&
    Boolean(
      viewState.retryable
    );


  if (isDone) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8 dark:bg-slate-950">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center">
          <section className="w-full rounded-3xl border border-emerald-200 bg-white p-6 text-center shadow-xl shadow-slate-200/40 dark:border-emerald-500/30 dark:bg-slate-900 dark:shadow-none">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
              <FiCheckCircle
                size={30}
                aria-hidden="true"
              />
            </div>

            <h1 className="mt-5 text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Done
            </h1>

            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
              You can return to the desktop. Your photo has already been added there.
            </p>
          </section>
        </div>
      </main>
    );
  }


  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 dark:bg-slate-950 sm:py-8">
      <div className="mx-auto max-w-md">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none">
          <div className="border-b border-slate-200 bg-slate-950 px-5 py-5 text-white dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white">
                <FiSmartphone
                  size={21}
                  aria-hidden="true"
                />
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-300">
                  Welljob Incident Evidence
                </p>

                <h1 className="mt-0.5 text-lg font-black">
                  Phone Camera
                </h1>
              </div>
            </div>
          </div>

          <div className="p-5 sm:p-6">
            <input
              ref={
                fileInputRef
              }
              type="file"
              accept="image/jpeg,image/png,.jpg,.jpeg,.png"
              capture="environment"
              onChange={
                handlePhotoChange
              }
              disabled={
                isUploading ||
                isChecking ||
                isUploaded ||
                isError
              }
              className="hidden"
            />

            <div className="text-center">
              <div
                className={[
                  "mx-auto flex h-16 w-16 items-center justify-center rounded-2xl",
                  isUploaded
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                    : isError
                      ? "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300"
                      : "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
                ].join(" ")}
              >
                {isChecking ||
                isUploading ? (
                  <FiRefreshCw
                    className="animate-spin"
                    size={27}
                    aria-hidden="true"
                  />
                ) : isUploaded ? (
                  <FiCheckCircle
                    size={28}
                    aria-hidden="true"
                  />
                ) : isError ? (
                  <FiAlertCircle
                    size={28}
                    aria-hidden="true"
                  />
                ) : isPreview ? (
                  <FiImage
                    size={28}
                    aria-hidden="true"
                  />
                ) : (
                  <FiCamera
                    size={28}
                    aria-hidden="true"
                  />
                )}
              </div>

              <h2 className="mt-4 text-xl font-black tracking-tight text-slate-900 dark:text-white">
                {
                  viewState.title
                }
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
                {
                  viewState.message
                }
              </p>
            </div>

            {isPreview &&
              selectedPhoto &&
              selectedPhotoUrl && (
                <div className="mt-5">
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-950">
                    <img
                      src={
                        selectedPhotoUrl
                      }
                      alt="Selected incident evidence"
                      className="max-h-[55vh] w-full object-contain"
                    />
                  </div>

                  <div className="mt-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-950/60">
                    <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                      {
                        selectedPhoto.name ||
                        "incident-photo.jpg"
                      }
                    </p>

                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {
                        formatFileSize(
                          selectedPhoto.size
                        )
                      }
                    </p>
                  </div>
                </div>
              )}

            {isUploading && (
              <div className="mt-5 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-500/30 dark:bg-indigo-500/10">
                <div className="flex items-start gap-3">
                  <FiShield
                    className="mt-0.5 shrink-0 text-indigo-600 dark:text-indigo-300"
                    aria-hidden="true"
                  />

                  <p className="text-sm leading-6 text-indigo-700 dark:text-indigo-300">
                    The photo is being securely added. Do not close this page yet.
                  </p>
                </div>
              </div>
            )}

            {isReady &&
              photoValidationError && (
                <div
                  role="alert"
                  className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left dark:border-amber-500/30 dark:bg-amber-500/10"
                >
                  <div className="flex items-start gap-3">
                    <FiAlertCircle
                      className="mt-0.5 shrink-0 text-amber-700 dark:text-amber-300"
                      aria-hidden="true"
                    />

                    <p className="text-sm font-semibold leading-6 text-amber-800 dark:text-amber-300">
                      {
                        photoValidationError
                      }
                    </p>
                  </div>
                </div>
              )}

            {isReady && (
              <button
                type="button"
                onClick={
                  handleTakePhoto
                }
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/25"
              >
                <FiCamera
                  aria-hidden="true"
                />
                Take photo
              </button>
            )}

            {isPreview && (
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={
                    handleRetake
                  }
                  disabled={
                    isUploading
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <FiRotateCcw
                    aria-hidden="true"
                  />
                  Retake
                </button>

                <button
                  type="button"
                  onClick={
                    handleUsePhoto
                  }
                  disabled={
                    isUploading
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/25"
                >
                  <FiCheckCircle
                    aria-hidden="true"
                  />
                  Use photo
                </button>
              </div>
            )}

            {isUploaded && (
              <button
                type="button"
                onClick={
                  handleDone
                }
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-emerald-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/25"
              >
                <FiCheckCircle
                  aria-hidden="true"
                />
                Done
              </button>
            )}

            {isError && (
              <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-left dark:border-red-500/30 dark:bg-red-500/10">
                <p className="text-sm font-bold text-red-800 dark:text-red-300">
                  {canRetryOpen
                    ? "Try this phone capture again"
                    : "Return to the desktop form"}
                </p>

                <p className="mt-1 text-xs leading-5 text-red-700 dark:text-red-300">
                  {canRetryOpen
                    ? "If your connection is available, try opening the same capture again."
                    : "Create a new phone capture there, then scan the new QR code."}
                </p>

                {canRetryOpen && (
                  <button
                    type="button"
                    onClick={() =>
                      window.location.reload()
                    }
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-300 bg-white px-4 py-2.5 text-sm font-bold text-red-700 transition hover:bg-red-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-red-500/20 dark:border-red-500/40 dark:bg-slate-900 dark:text-red-300 dark:hover:bg-red-500/10"
                  >
                    <FiRefreshCw
                      aria-hidden="true"
                    />
                    Try again
                  </button>
                )}
              </div>
            )}
          </div>
        </section>

        <p className="mt-4 text-center text-xs leading-5 text-slate-500 dark:text-slate-500">
          This page is only for taking and sending an evidence photo. Incident details remain on the desktop.
        </p>
      </div>
    </main>
  );
}