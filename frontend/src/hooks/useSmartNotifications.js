import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  canViewSmartAlerts,
  getUserKey,
  requestSmartAlertJson,
} from "../utils/notifications/smartNotifications";

const EMPTY_SUMMARY = {
  total: 0,
  unread: 0,
  high: 0,
  medium: 0,
  low: 0,
};

function getDisplayName(user) {
  return (
    user?.full_name ||
    user?.fullName ||
    user?.fullname ||
    user?.display_name ||
    user?.displayName ||
    user?.name ||
    user?.username ||
    "Unknown User"
  );
}

function getUserId(user) {
  return (
    user?.userId ||
    user?.user_id ||
    user?.id ||
    ""
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
  const role =
    user?.role || "USER";

  const userKey = useMemo(
    () => getUserKey(user),
    [user]
  );

  const canView =
    canViewSmartAlerts(role);

  const pollInterval =
    options.pollInterval ??
    10000;

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

  const [summary, setSummary] =
    useState(EMPTY_SUMMARY);

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
  ] = useState(() => new Set());

  const [error, setError] =
    useState("");

  const visibleAlerts = useMemo(
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

  const readAlerts = useMemo(() => {
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

  const fetchAlerts = useCallback(
    async ({
      silent = false,
    } = {}) => {
      if (!canView) {
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
        return;
      }

      try {
        if (!silent) {
          setIsLoading(true);
        }

        setIsFetching(true);
        setError("");

        const displayName =
          getDisplayName(user);

        const userId = String(
          getUserId(user)
        );

        const query =
          new URLSearchParams({
            userKey,
            role,
            userId,
            id: userId,
            username: String(
              user?.username || ""
            ),
            userName:
              displayName,
            fullName:
              displayName,
            full_name:
              displayName,
            name: displayName,
          }).toString();

        const data =
          await requestSmartAlertJson(
            `/smart-alerts?${query}`
          );

        const nextAlerts =
          normalizeAlerts(
            data?.alerts
          );

        const nextLatestAlerts =
          normalizeAlerts(
            data?.latestAlerts
          );

        setAlerts(nextAlerts);

        setLatestAlerts(
          nextLatestAlerts
        );

        const nextPopupAlert =
          data?.popupAlert ||
          null;

        setPopupAlert(
          nextPopupAlert
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
      } finally {
        setIsLoading(false);
        setIsFetching(false);
      }
    },
    [
      canView,
      role,
      user,
      userKey,
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
                      isRead: true,
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
                      isRead: true,
                    }
                  : alert
            )
        );

        setUnreadCount(
          (currentCount) =>
            Math.max(
              0,
              currentCount - 1
            )
        );

        await requestSmartAlertJson(
          "/smart-alerts/read",
          {
            method: "POST",
            body: JSON.stringify({
              userKey,
              role,
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
        role,
        userKey,
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
              method: "POST",
              body: JSON.stringify(
                {
                  userKey,
                  role,
                  alertKey:
                    normalizedKey,
                }
              ),
            }
          );

          if (refreshAfter) {
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
        role,
        userKey,
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
                  method: "POST",
                  body: JSON.stringify(
                    {
                      userKey,
                      role,
                      alertKey,
                    }
                  ),
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
      role,
      userKey,
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
          body: JSON.stringify({
            userKey,
            role,
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
      role,
      userKey,
      visibleAlerts,
    ]);

  useEffect(() => {
    fetchAlerts();

    const handleDataUpdated =
      () =>
        fetchAlerts({
          silent: true,
        });

    const handleWindowFocus =
      () =>
        fetchAlerts({
          silent: true,
        });

    const intervalId =
      window.setInterval(
        () =>
          fetchAlerts({
            silent: true,
          }),
        pollInterval
      );

    window.addEventListener(
      "dataUpdated",
      handleDataUpdated
    );

    window.addEventListener(
      "focus",
      handleWindowFocus
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

      window.clearInterval(
        intervalId
      );
    };
  }, [
    fetchAlerts,
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
    refresh: fetchAlerts,
    markAlertAsRead,
    dismissAlert,
    clearReadAlerts,
    markAllAsRead,
  };
}