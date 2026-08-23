import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  canViewSmartAlerts,
  requestSmartAlertJson,
} from "../utils/notifications/smartNotifications";

const EMPTY_SUMMARY = {
  total: 0,
  unread: 0,
  high: 0,
  medium: 0,
  low: 0,
};

const DEFAULT_POLL_INTERVAL = 10000;

const SMART_ALERT_REFRESH_DOMAINS = new Set([
  "incident",
  "incidents",
  "employee",
  "employees",
  "deployment",
  "deployments",
  "dashboard",
]);

function normalizeDataDomain(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function shouldRefreshForDataUpdated(event) {
  const domain = normalizeDataDomain(
    event?.detail?.domain
  );

  /*
   * Preserve compatibility with older
   * dataUpdated events that do not
   * include a domain.
   */
  if (!domain) {
    return true;
  }

  return SMART_ALERT_REFRESH_DOMAINS.has(
    domain
  );
}

function normalizeAlerts(value) {
  return Array.isArray(value)
    ? value.filter(Boolean)
    : [];
}

function getAlertKey(alert) {
  return String(
    alert?.alertKey ||
      alert?.id ||
      ""
  );
}

function isReadAlert(alert) {
  return (
    alert?.isRead === true ||
    alert?.read === true ||
    Boolean(alert?.readAt)
  );
}

function filterClearedAlerts(
  alertList,
  clearedAlertKeys
) {
  return normalizeAlerts(
    alertList
  ).filter((alert) => {
    const alertKey =
      getAlertKey(alert);

    if (!alertKey) {
      return true;
    }

    return !clearedAlertKeys.has(
      alertKey
    );
  });
}

export default function useSmartNotifications(
  user,
  options = {}
) {
  const role = user?.role || "USER";

  const canView =
    canViewSmartAlerts(role);

  const configuredPollInterval =
    Number(
      options.pollInterval ??
        DEFAULT_POLL_INTERVAL
    );

  const pollInterval =
    Number.isFinite(
      configuredPollInterval
    )
      ? configuredPollInterval
      : DEFAULT_POLL_INTERVAL;

  const hasPolling =
    pollInterval > 0;

  /*
   * Prevent overlapping network requests.
   *
   * If another refresh request arrives while
   * a request is already running, we do not
   * discard it. Instead, refreshQueuedRef
   * remembers that another synchronization
   * pass is required immediately afterwards.
   */
  const requestInFlightRef =
    useRef(false);

  const refreshQueuedRef =
    useRef(false);

  const [alerts, setAlerts] =
    useState([]);

  const [
    latestAlerts,
    setLatestAlerts,
  ] = useState([]);

  const [
    popupAlert,
    setPopupAlert,
  ] = useState(null);

  const [
    summary,
    setSummary,
  ] = useState(
    EMPTY_SUMMARY
  );

  const [
    unreadCount,
    setUnreadCount,
  ] = useState(0);

  const [
    isLoading,
    setIsLoading,
  ] = useState(canView);

  const [
    isFetching,
    setIsFetching,
  ] = useState(false);

  const [
    isClearingRead,
    setIsClearingRead,
  ] = useState(false);

  const [
    clearedAlertKeys,
    setClearedAlertKeys,
  ] = useState(
    () => new Set()
  );

  const [
    error,
    setError,
  ] = useState("");

  const visibleAlerts =
    useMemo(
      () =>
        filterClearedAlerts(
          alerts,
          clearedAlertKeys
        ),
      [
        alerts,
        clearedAlertKeys,
      ]
    );

  const visibleLatestAlerts =
    useMemo(
      () =>
        filterClearedAlerts(
          latestAlerts,
          clearedAlertKeys
        ),
      [
        latestAlerts,
        clearedAlertKeys,
      ]
    );

  const readAlerts =
    useMemo(() => {
      const combinedAlerts = [
        ...visibleAlerts,
        ...visibleLatestAlerts,
      ];

      const uniqueReadAlerts =
        new Map();

      combinedAlerts.forEach(
        (alert) => {
          const alertKey =
            getAlertKey(alert);

          if (
            !alertKey ||
            !isReadAlert(alert)
          ) {
            return;
          }

          uniqueReadAlerts.set(
            alertKey,
            alert
          );
        }
      );

      return Array.from(
        uniqueReadAlerts.values()
      );
    }, [
      visibleAlerts,
      visibleLatestAlerts,
    ]);

  const readAlertCount =
    readAlerts.length;

  const hasReadAlerts =
    readAlertCount > 0;

  const resetAlertState =
    useCallback(() => {
      refreshQueuedRef.current =
        false;

      setAlerts([]);
      setLatestAlerts([]);
      setPopupAlert(null);
      setSummary(
        EMPTY_SUMMARY
      );
      setUnreadCount(0);
      setIsLoading(false);
      setIsFetching(false);
      setError("");
    }, []);

  const fetchAlerts =
    useCallback(
      async ({
        silent = false,
      } = {}) => {
        if (!canView) {
          resetAlertState();
          return;
        }

        /*
         * A refresh may be triggered by several
         * sources at nearly the same time:
         *
         * - polling
         * - local dataUpdated event
         * - window focus
         * - tab visibility
         * - network reconnection
         *
         * Never run overlapping requests.
         * Preserve one pending refresh instead.
         */
        if (
          requestInFlightRef.current
        ) {
          refreshQueuedRef.current =
            true;
          return;
        }

        requestInFlightRef.current =
          true;

        let nextRequestSilent =
          silent;

        try {
          do {
            refreshQueuedRef.current =
              false;

            if (
              !nextRequestSilent
            ) {
              setIsLoading(true);
            }

            setIsFetching(true);
            setError("");

            try {
              /*
               * Authenticated identity and role
               * are derived exclusively from
               * the JWT by the backend.
               */
              const data =
                await requestSmartAlertJson(
                  "/smart-alerts"
                );

              const nextAlerts =
                normalizeAlerts(
                  data?.alerts
                );

              const nextLatestAlerts =
                normalizeAlerts(
                  data?.latestAlerts
                );

              setAlerts(
                nextAlerts
              );

              setLatestAlerts(
                nextLatestAlerts
              );

              setPopupAlert(
                data?.popupAlert ||
                  null
              );

              setSummary({
                ...EMPTY_SUMMARY,
                ...(data?.summary ||
                  {}),
              });

              setUnreadCount(
                Math.max(
                  0,
                  Number(
                    data?.unreadCount ||
                      0
                  )
                )
              );
            } catch (err) {
              console.error(
                "Smart notification fetch error:",
                err
              );

              setError(
                err?.message ||
                  "Unable to load smart alerts."
              );
            }

            /*
             * Any queued follow-up refresh is
             * always silent to avoid showing
             * the initial loading state again.
             */
            nextRequestSilent =
              true;
          } while (
            refreshQueuedRef.current &&
            canView
          );
        } finally {
          requestInFlightRef.current =
            false;

          setIsLoading(false);
          setIsFetching(false);
        }
      },
      [
        canView,
        resetAlertState,
      ]
    );

  const markAlertAsRead =
    useCallback(
      async (alertKey) => {
        if (
          !alertKey ||
          !canView
        ) {
          return;
        }

        const normalizedKey =
          String(alertKey);

        setPopupAlert(
          (currentPopup) =>
            getAlertKey(
              currentPopup
            ) === normalizedKey
              ? null
              : currentPopup
        );

        setAlerts(
          (currentAlerts) =>
            currentAlerts.map(
              (alert) =>
                getAlertKey(
                  alert
                ) ===
                normalizedKey
                  ? {
                      ...alert,
                      isRead:
                        true,
                    }
                  : alert
            )
        );

        setLatestAlerts(
          (
            currentLatestAlerts
          ) =>
            currentLatestAlerts.map(
              (alert) =>
                getAlertKey(
                  alert
                ) ===
                normalizedKey
                  ? {
                      ...alert,
                      isRead:
                        true,
                    }
                  : alert
            )
        );

        setUnreadCount(
          (currentCount) =>
            Math.max(
              0,
              currentCount -
                1
            )
        );

        await requestSmartAlertJson(
          "/smart-alerts/read",
          {
            method: "POST",

            body:
              JSON.stringify({
                alertKey:
                  normalizedKey,
              }),
          }
        );

        await fetchAlerts({
          silent: true,
        });
      },
      [
        canView,
        fetchAlerts,
      ]
    );

  const dismissAlert =
    useCallback(
      async (
        alertKey,
        {
          refreshAfter = true,
        } = {}
      ) => {
        if (
          !alertKey ||
          !canView
        ) {
          return;
        }

        const normalizedKey =
          String(alertKey);

        setClearedAlertKeys(
          (currentKeys) => {
            const nextKeys =
              new Set(
                currentKeys
              );

            nextKeys.add(
              normalizedKey
            );

            return nextKeys;
          }
        );

        setAlerts(
          (currentAlerts) =>
            currentAlerts.filter(
              (alert) =>
                getAlertKey(
                  alert
                ) !==
                normalizedKey
            )
        );

        setLatestAlerts(
          (
            currentLatestAlerts
          ) =>
            currentLatestAlerts.filter(
              (alert) =>
                getAlertKey(
                  alert
                ) !==
                normalizedKey
            )
        );

        setPopupAlert(
          (currentPopup) =>
            getAlertKey(
              currentPopup
            ) === normalizedKey
              ? null
              : currentPopup
        );

        try {
          await requestSmartAlertJson(
            "/smart-alerts/dismiss",
            {
              method:
                "POST",

              body:
                JSON.stringify({
                  alertKey:
                    normalizedKey,
                }),
            }
          );

          if (
            refreshAfter
          ) {
            await fetchAlerts({
              silent: true,
            });
          }
        } catch (err) {
          setClearedAlertKeys(
            (currentKeys) => {
              const nextKeys =
                new Set(
                  currentKeys
                );

              nextKeys.delete(
                normalizedKey
              );

              return nextKeys;
            }
          );

          throw err;
        }
      },
      [
        canView,
        fetchAlerts,
      ]
    );

  const clearReadAlerts =
    useCallback(async () => {
      if (
        !canView ||
        isClearingRead
      ) {
        return 0;
      }

      const alertKeys =
        readAlerts
          .map((alert) =>
            getAlertKey(alert)
          )
          .filter(Boolean);

      if (
        alertKeys.length === 0
      ) {
        return 0;
      }

      setIsClearingRead(true);
      setError("");

      const keysToClear =
        new Set(alertKeys);

      setClearedAlertKeys(
        (currentKeys) => {
          const nextKeys =
            new Set(
              currentKeys
            );

          alertKeys.forEach(
            (alertKey) => {
              nextKeys.add(
                alertKey
              );
            }
          );

          return nextKeys;
        }
      );

      setAlerts(
        (currentAlerts) =>
          currentAlerts.filter(
            (alert) =>
              !keysToClear.has(
                getAlertKey(
                  alert
                )
              )
          )
      );

      setLatestAlerts(
        (
          currentLatestAlerts
        ) =>
          currentLatestAlerts.filter(
            (alert) =>
              !keysToClear.has(
                getAlertKey(
                  alert
                )
              )
          )
      );

      setPopupAlert(
        (currentPopup) =>
          keysToClear.has(
            getAlertKey(
              currentPopup
            )
          )
            ? null
            : currentPopup
      );

      try {
        await Promise.all(
          alertKeys.map(
            (alertKey) =>
              requestSmartAlertJson(
                "/smart-alerts/dismiss",
                {
                  method:
                    "POST",

                  body:
                    JSON.stringify({
                      alertKey,
                    }),
                }
              )
          )
        );

        await fetchAlerts({
          silent: true,
        });

        return alertKeys.length;
      } catch (err) {
        console.error(
          "Clear read smart alerts error:",
          err
        );

        setClearedAlertKeys(
          (currentKeys) => {
            const nextKeys =
              new Set(
                currentKeys
              );

            alertKeys.forEach(
              (alertKey) => {
                nextKeys.delete(
                  alertKey
                );
              }
            );

            return nextKeys;
          }
        );

        await fetchAlerts({
          silent: true,
        });

        setError(
          err?.message ||
            "Unable to clear read alerts."
        );

        throw err;
      } finally {
        setIsClearingRead(false);
      }
    }, [
      canView,
      fetchAlerts,
      isClearingRead,
      readAlerts,
    ]);

  const markAllAsRead =
    useCallback(async () => {
      if (!canView) {
        return;
      }

      const alertKeys =
        visibleAlerts
          .map((alert) =>
            getAlertKey(alert)
          )
          .filter(Boolean);

      if (
        alertKeys.length === 0
      ) {
        return;
      }

      setAlerts(
        (currentAlerts) =>
          currentAlerts.map(
            (alert) => ({
              ...alert,
              isRead: true,
            })
          )
      );

      setLatestAlerts(
        (
          currentLatestAlerts
        ) =>
          currentLatestAlerts.map(
            (alert) => ({
              ...alert,
              isRead: true,
            })
          )
      );

      setUnreadCount(0);

      await requestSmartAlertJson(
        "/smart-alerts/read-all",
        {
          method: "POST",

          body:
            JSON.stringify({
              alertKeys,
            }),
        }
      );

      await fetchAlerts({
        silent: true,
      });
    }, [
      canView,
      fetchAlerts,
      visibleAlerts,
    ]);

  /*
   * Notification synchronization lifecycle.
   *
   * Cross-device updates cannot rely on the
   * browser-local dataUpdated CustomEvent.
   *
   * We therefore combine:
   *
   * 1. Initial fetch
   * 2. Local dataUpdated refresh
   * 3. Periodic lightweight polling
   * 4. Window focus refresh
   * 5. Tab visibility refresh
   * 6. Network reconnection refresh
   */
  useEffect(() => {
    fetchAlerts();

    const requestSilentRefresh =
      () => {
        fetchAlerts({
          silent: true,
        });
      };

    const handleDataUpdated =
      (event) => {
        if (
          !shouldRefreshForDataUpdated(
            event
          )
        ) {
          return;
        }

        requestSilentRefresh();
      };

    const handleWindowFocus =
      () => {
        requestSilentRefresh();
      };

    const handleVisibilityChange =
      () => {
        if (
          document.visibilityState !==
          "visible"
        ) {
          return;
        }

        requestSilentRefresh();
      };

    const handleOnline =
      () => {
        requestSilentRefresh();
      };

    let intervalId = null;

    if (hasPolling) {
      intervalId =
        window.setInterval(
          requestSilentRefresh,
          pollInterval
        );
    }

    window.addEventListener(
      "dataUpdated",
      handleDataUpdated
    );

    window.addEventListener(
      "focus",
      handleWindowFocus
    );

    window.addEventListener(
      "online",
      handleOnline
    );

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    return () => {
      window.removeEventListener(
        "dataUpdated",
        handleDataUpdated
      );

      window.removeEventListener(
        "focus",
        handleWindowFocus
      );

      window.removeEventListener(
        "online",
        handleOnline
      );

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );

      if (
        intervalId !== null
      ) {
        window.clearInterval(
          intervalId
        );
      }
    };
  }, [
    fetchAlerts,
    hasPolling,
    pollInterval,
  ]);

  return {
    canView,

    alerts:
      visibleAlerts,

    latestAlerts:
      visibleLatestAlerts,

    popupAlert:
      popupAlert &&
      !clearedAlertKeys.has(
        getAlertKey(
          popupAlert
        )
      )
        ? popupAlert
        : null,

    summary,
    unreadCount,
    readAlertCount,
    hasReadAlerts,
    isLoading,
    isFetching,
    isClearingRead,
    error,

    refresh:
      fetchAlerts,

    markAlertAsRead,
    dismissAlert,
    clearReadAlerts,
    markAllAsRead,
  };
}