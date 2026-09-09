import {
  useCallback,
  useEffect,
  useMemo,
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

const DEFAULT_POLL_INTERVAL = 30000;
const SMART_ALERT_MIN_REFRESH_GAP_MS = 10000;

const sharedSmartAlertRequests =
  new Map();

const sharedSmartAlertCaches =
  new Map();

function normalizeIdentityPart(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function getSmartAlertSessionKey(
  user
) {
  const role =
    normalizeIdentityPart(
      user?.role
    );

  const identity =
    normalizeIdentityPart(
      user?.id ??
        user?.user_id ??
        user?.userId ??
        user?.username ??
        user?.email
    );

  if (!role || !identity) {
    return "";
  }

  return `${role}:${identity}`;
}

function invalidateSharedSmartAlertCache(
  sessionKey
) {
  if (!sessionKey) {
    return;
  }

  sharedSmartAlertCaches.delete(
    sessionKey
  );
}

async function requestSharedSmartAlerts(
  sessionKey
) {
  if (!sessionKey) {
    return requestSmartAlertJson(
      "/smart-alerts"
    );
  }

  const now = Date.now();

  const cachedEntry =
    sharedSmartAlertCaches.get(
      sessionKey
    );

  if (
    cachedEntry &&
    now - cachedEntry.fetchedAt <
      SMART_ALERT_MIN_REFRESH_GAP_MS
  ) {
    return cachedEntry.data;
  }

  const existingRequest =
    sharedSmartAlertRequests.get(
      sessionKey
    );

  if (existingRequest) {
    return existingRequest;
  }

  const request =
    requestSmartAlertJson(
      "/smart-alerts"
    );

  sharedSmartAlertRequests.set(
    sessionKey,
    request
  );

  try {
    const data =
      await request;

    sharedSmartAlertCaches.set(
      sessionKey,
      {
        data,
        fetchedAt:
          Date.now(),
      }
    );

    return data;
  } finally {
    if (
      sharedSmartAlertRequests.get(
        sessionKey
      ) === request
    ) {
      sharedSmartAlertRequests.delete(
        sessionKey
      );
    }
  }
}

function emitSmartAlertsUpdated(
  sessionKey
) {
  window.dispatchEvent(
    new CustomEvent(
      "smartAlertsUpdated",
      {
        detail: {
          sessionKey,
        },
      }
    )
  );
}

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

  const sessionKey =
    getSmartAlertSessionKey(
      user
    );

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
          return null;
        }

        if (!silent) {
          setIsLoading(true);
        }

        setIsFetching(true);
        setError("");

        try {
          const data =
            await requestSharedSmartAlerts(
              sessionKey
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

          return data;
        } catch (err) {
          console.error(
            "Smart notification fetch error:",
            err
          );

          setError(
            err?.message ||
              "Unable to load smart alerts."
          );

          return null;
        } finally {
          setIsLoading(false);
          setIsFetching(false);
        }
      },
      [
        canView,
        resetAlertState,
        sessionKey,
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

        invalidateSharedSmartAlertCache(
          sessionKey
        );

        await fetchAlerts({
          silent: true,
        });

        emitSmartAlertsUpdated(
          sessionKey
        );
      },
      [
        canView,
        fetchAlerts,
        sessionKey,
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
            invalidateSharedSmartAlertCache(
              sessionKey
            );

            await fetchAlerts({
              silent: true,
            });

            emitSmartAlertsUpdated(
              sessionKey
            );
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
        sessionKey,
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

        invalidateSharedSmartAlertCache(
          sessionKey
        );

        await fetchAlerts({
          silent: true,
        });

        emitSmartAlertsUpdated(
          sessionKey
        );

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
      sessionKey,
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

      invalidateSharedSmartAlertCache(
        sessionKey
      );

      await fetchAlerts({
        silent: true,
      });

      emitSmartAlertsUpdated(
        sessionKey
      );
    }, [
      canView,
      fetchAlerts,
      sessionKey,
      visibleAlerts,
    ]);

  const refreshAlerts =
    useCallback(
      async (
        refreshOptions = {}
      ) => {
        invalidateSharedSmartAlertCache(
          sessionKey
        );

        return fetchAlerts(
          refreshOptions
        );
      },
      [
        fetchAlerts,
        sessionKey,
      ]
    );

  /*
   * One shared GET request is reused by every
   * mounted notification consumer.
   */
  useEffect(() => {
    void fetchAlerts();

    const requestSilentRefresh =
      () => {
        if (
          document.visibilityState !==
          "visible"
        ) {
          return;
        }

        void fetchAlerts({
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

        invalidateSharedSmartAlertCache(
          sessionKey
        );
        requestSilentRefresh();
      };

    const handleSmartAlertsUpdated =
      (event) => {
        const updatedSessionKey =
          String(
            event?.detail?.sessionKey ||
              ""
          );

        if (
          updatedSessionKey &&
          updatedSessionKey !==
            sessionKey
        ) {
          return;
        }

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
      "smartAlertsUpdated",
      handleSmartAlertsUpdated
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
        "smartAlertsUpdated",
        handleSmartAlertsUpdated
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
    sessionKey,
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
      refreshAlerts,

    markAlertAsRead,
    dismissAlert,
    clearReadAlerts,
    markAllAsRead,
  };
}