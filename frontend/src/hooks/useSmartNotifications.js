import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  canViewSmartAlerts,
  getSmartAlertEventTimestamp,
  requestSmartAlertJson,
  sortSmartAlertsByRecency,
} from "../utils/notifications/smartNotifications";

const EMPTY_SUMMARY = {
  total: 0,
  unread: 0,
  high: 0,
  medium: 0,
  low: 0,
};

const DEFAULT_POLL_INTERVAL = 5000;
const SMART_ALERT_MIN_REFRESH_GAP_MS = 1500;

const sharedSmartAlertRequests =
  new Map();

const sharedSmartAlertCaches =
  new Map();

const sharedSmartAlertPopupSessions =
  new Map();

const sharedSmartAlertConsumers =
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
  "compliance",
  "document",
  "documents",
  "employee_documents",
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

function isDismissedAlert(alert) {
  return (
    alert?.isDismissed === true ||
    alert?.dismissed === true ||
    Boolean(
      alert?.dismissedAt
    )
  );
}

function getAlertTimestamp(alert) {
  /*
   * Keep popup ordering aligned with the same
   * notification event timestamp source used by
   * the Navbar and Notifications Center.
   *
   * This prevents a popup from falling back to a
   * business date such as an Incident or Compliance
   * expiration date when the backend already supplied
   * the actual notification timestamp.
   */
  return getSmartAlertEventTimestamp(
    alert
  );
}

function getAlertPriorityRankValue(
  alert
) {
  const directRank =
    Number(
      alert?.priorityRank
    );

  if (
    Number.isFinite(
      directRank
    )
  ) {
    return directRank;
  }

  const priority =
    String(
      alert?.priority ||
        ""
    )
      .trim()
      .toLowerCase();

  if (priority === "high") {
    return 3;
  }

  if (priority === "medium") {
    return 2;
  }

  return 1;
}

function isPopupEligibleAlert(
  alert
) {
  return (
    Boolean(
      getAlertKey(alert)
    ) &&
    !isReadAlert(alert) &&
    !isDismissedAlert(alert)
  );
}

function getSharedPopupSessionState(
  sessionKey
) {
  if (!sessionKey) {
    return null;
  }

  let state =
    sharedSmartAlertPopupSessions.get(
      sessionKey
    );

  if (!state) {
    state = {
      initialized: false,
      knownAlertKeys:
        new Set(),
      activePopupKey: "",
    };

    sharedSmartAlertPopupSessions.set(
      sessionKey,
      state
    );
  }

  return state;
}

function clearSharedPopupAlert(
  sessionKey,
  alertKey = ""
) {
  const state =
    sharedSmartAlertPopupSessions.get(
      sessionKey
    );

  if (!state) {
    return;
  }

  const normalizedKey =
    String(
      alertKey ||
        ""
    );

  if (normalizedKey) {
    state.knownAlertKeys.add(
      normalizedKey
    );
  }

  if (
    !normalizedKey ||
    state.activePopupKey ===
      normalizedKey
  ) {
    state.activePopupKey = "";
  }
}

function retainSharedSmartAlertSession(
  sessionKey
) {
  if (!sessionKey) {
    return;
  }

  const currentCount =
    Number(
      sharedSmartAlertConsumers.get(
        sessionKey
      ) ||
        0
    );

  /*
   * The first mounted consumer starts a fresh login/app
   * session baseline for this account. Additional hook
   * consumers share the same baseline and request cache.
   */
  if (currentCount === 0) {
    sharedSmartAlertPopupSessions.delete(
      sessionKey
    );

    invalidateSharedSmartAlertCache(
      sessionKey
    );
  }

  sharedSmartAlertConsumers.set(
    sessionKey,
    currentCount + 1
  );
}

function releaseSharedSmartAlertSession(
  sessionKey
) {
  if (!sessionKey) {
    return;
  }

  const currentCount =
    Number(
      sharedSmartAlertConsumers.get(
        sessionKey
      ) ||
        0
    );

  if (currentCount <= 1) {
    sharedSmartAlertConsumers.delete(
      sessionKey
    );

    sharedSmartAlertPopupSessions.delete(
      sessionKey
    );

    invalidateSharedSmartAlertCache(
      sessionKey
    );

    return;
  }

  sharedSmartAlertConsumers.set(
    sessionKey,
    currentCount - 1
  );
}

function resolveSharedPopupAlert({
  sessionKey,
  alerts,
  backendPopupAlert,
}) {
  const state =
    getSharedPopupSessionState(
      sessionKey
    );

  /*
   * A trusted account identity is required to maintain
   * a per-account popup baseline. Notification Center
   * data still loads normally when this key is absent,
   * but automatic popups stay suppressed.
   */
  if (!state) {
    return null;
  }

  const combinedAlerts =
    normalizeAlerts([
      ...normalizeAlerts(alerts),
      backendPopupAlert,
    ]);

  const alertsByKey =
    new Map();

  combinedAlerts.forEach(
    (alert) => {
      const alertKey =
        getAlertKey(alert);

      if (!alertKey) {
        return;
      }

      alertsByKey.set(
        alertKey,
        alert
      );
    }
  );

  /*
   * First successful load establishes the session
   * baseline. Existing unread/history alerts remain
   * available in the Notification Center but are never
   * treated as newly-arrived toast popups.
   */
  if (!state.initialized) {
    alertsByKey.forEach(
      (
        _alert,
        alertKey
      ) => {
        state.knownAlertKeys.add(
          alertKey
        );
      }
    );

    state.initialized = true;
    state.activePopupKey = "";

    return null;
  }

  /*
   * Keep one currently-active popup stable across
   * polling refreshes. This prevents a refresh from
   * replacing or reopening the same notification.
   */
  if (state.activePopupKey) {
    const activeAlert =
      alertsByKey.get(
        state.activePopupKey
      );

    if (
      activeAlert &&
      isPopupEligibleAlert(
        activeAlert
      )
    ) {
      return activeAlert;
    }

    state.activePopupKey = "";
  }

  const newlyDiscoveredAlerts =
    [];

  alertsByKey.forEach(
    (
      alert,
      alertKey
    ) => {
      if (
        state.knownAlertKeys.has(
          alertKey
        )
      ) {
        return;
      }

      state.knownAlertKeys.add(
        alertKey
      );

      newlyDiscoveredAlerts.push(
        alert
      );
    }
  );

  /*
   * If several alerts arrive in one polling window,
   * show at most one popup. All of them remain visible
   * in the Notification Center, which prevents a
   * frustrating popup cascade.
   */
  const nextPopup =
    newlyDiscoveredAlerts
      .filter(
        isPopupEligibleAlert
      )
      .sort(
        (a, b) => {
          const timestampDiff =
            getAlertTimestamp(b) -
            getAlertTimestamp(a);

          if (timestampDiff !== 0) {
            return timestampDiff;
          }

          return (
            getAlertPriorityRankValue(
              b
            ) -
            getAlertPriorityRankValue(
              a
            )
          );
        }
      )[0] ||
    null;

  if (nextPopup) {
    state.activePopupKey =
      getAlertKey(
        nextPopup
      );
  }

  return nextPopup;
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
            sortSmartAlertsByRecency(
              normalizeAlerts(
                data?.alerts
              )
            );

          /*
           * Keep the quick-list source aligned with the
           * full alert collection instead of trusting a
           * backend priority-sliced latestAlerts array.
           * This prevents "2 unread" with an empty
           * Unread tab when those unread items fall
           * outside a priority-based slice.
           */
          const nextLatestAlerts =
            nextAlerts.slice(
              0,
              12
            );

          setAlerts(
            nextAlerts
          );

          setLatestAlerts(
            nextLatestAlerts
          );

          const nextPopupAlert =
            resolveSharedPopupAlert({
              sessionKey,
              alerts:
                nextAlerts,
              backendPopupAlert:
                data?.popupAlert ||
                null,
            });

          setPopupAlert(
            nextPopupAlert
          );

          setSummary({
            ...EMPTY_SUMMARY,
            ...(data?.summary ||
              {}),
          });

          setUnreadCount(
            nextAlerts.filter(
              (alert) =>
                !isReadAlert(
                  alert
                )
            ).length
          );

          return data;
        } catch (err) {
          console.error(
            "Smart notification fetch error:",
            err
          );

          setError(
            "Unable to load notifications. Please try again."
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

        const currentTarget =
          [
            ...visibleAlerts,
            ...visibleLatestAlerts,
          ].find(
            (alert) =>
              getAlertKey(
                alert
              ) ===
              normalizedKey
          );

        const wasUnread =
          Boolean(
            currentTarget &&
            !isReadAlert(
              currentTarget
            )
          );

        clearSharedPopupAlert(
          sessionKey,
          normalizedKey
        );

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

        if (wasUnread) {
          setUnreadCount(
            (currentCount) =>
              Math.max(
                0,
                currentCount -
                  1
              )
          );
        }

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
        visibleAlerts,
        visibleLatestAlerts,
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
          String(
            alertKey
          );

        /*
         * Dismissing a toast is NOT the same as deleting
         * a notification. Keep the record in All/history
         * and only suppress this automatic popup.
         */
        clearSharedPopupAlert(
          sessionKey,
          normalizedKey
        );

        setPopupAlert(
          (currentPopup) =>
            getAlertKey(
              currentPopup
            ) ===
              normalizedKey
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
                      isDismissed:
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
                      isDismissed:
                        true,
                    }
                  : alert
            )
        );

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
      },
      [
        canView,
        fetchAlerts,
        sessionKey,
      ]
    );

  /*
   * Backward-compatible alias retained for older
   * consumers. "Clear Read" is no longer destructive:
   * it now behaves as Mark All As Read so notification
   * history always remains available.
   */
  const clearReadAlerts =
    useCallback(async () => {
      if (
        !canView ||
        isClearingRead
      ) {
        return 0;
      }

      const combinedAlerts = [
        ...visibleAlerts,
        ...visibleLatestAlerts,
      ];

      const unreadKeys =
        Array.from(
          new Set(
            combinedAlerts
              .filter(
                (alert) =>
                  !isReadAlert(
                    alert
                  )
              )
              .map(
                getAlertKey
              )
              .filter(
                Boolean
              )
          )
        );

      if (
        unreadKeys.length ===
        0
      ) {
        return 0;
      }

      setIsClearingRead(
        true
      );

      setError(
        ""
      );

      setAlerts(
        (
          currentAlerts
        ) =>
          currentAlerts.map(
            (alert) => ({
              ...alert,
              isRead:
                true,
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
              isRead:
                true,
            })
          )
      );

      setUnreadCount(
        0
      );

      clearSharedPopupAlert(
        sessionKey
      );

      setPopupAlert(
        null
      );

      try {
        await requestSmartAlertJson(
          "/smart-alerts/read-all",
          {
            method:
              "POST",

            body:
              JSON.stringify({
                alertKeys:
                  unreadKeys,
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

        return unreadKeys.length;
      } catch (err) {
        console.error(
          "Mark all notifications as read error:",
          err
        );

        await fetchAlerts({
          silent: true,
        });

        setError(
          "Unable to mark all notifications as read. Please try again."
        );

        throw err;
      } finally {
        setIsClearingRead(
          false
        );
      }
    }, [
      canView,
      fetchAlerts,
      isClearingRead,
      sessionKey,
      visibleAlerts,
      visibleLatestAlerts,
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

      clearSharedPopupAlert(
        sessionKey
      );

      setPopupAlert(null);

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
   * Keep per-account popup baselines isolated across
   * login/logout/account switching while allowing every
   * mounted notification consumer for the same account
   * to share one baseline.
   */
  useEffect(() => {
    setClearedAlertKeys(
      new Set()
    );

    setPopupAlert(null);

    if (
      !canView ||
      !sessionKey
    ) {
      return undefined;
    }

    retainSharedSmartAlertSession(
      sessionKey
    );

    return () => {
      releaseSharedSmartAlertSession(
        sessionKey
      );
    };
  }, [
    canView,
    sessionKey,
  ]);

  /*
   * One shared GET request is reused by every
   * mounted notification consumer.
   */
  useEffect(() => {
    void fetchAlerts();

    const requestSilentRefresh =
      ({
        force = false,
      } = {}) => {
        if (
          document.visibilityState !==
          "visible"
        ) {
          return;
        }

        if (force) {
          invalidateSharedSmartAlertCache(
            sessionKey
          );
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

        requestSilentRefresh({
          force: true,
        });
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

        requestSilentRefresh({
          force: true,
        });
      };

    const handleFocus =
      () => {
        requestSilentRefresh({
          force: true,
        });
      };

    const handleOnline =
      () => {
        requestSilentRefresh({
          force: true,
        });
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

    window.addEventListener(
      "focus",
      handleFocus
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

      window.removeEventListener(
        "focus",
        handleFocus
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