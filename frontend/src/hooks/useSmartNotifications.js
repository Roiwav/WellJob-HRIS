import { useCallback, useEffect, useMemo, useState } from "react";
import {
  canViewSmartAlerts,
  getUserKey,
  requestSmartAlertJson,
} from "../utils/notifications/smartNotifications";

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
  return user?.userId || user?.user_id || user?.id || "";
}

export default function useSmartNotifications(user, options = {}) {
  const role = user?.role || "USER";
  const userKey = useMemo(() => getUserKey(user), [user]);
  const canView = canViewSmartAlerts(role);

  const pollInterval = options.pollInterval ?? 10000;

  const [alerts, setAlerts] = useState([]);
  const [latestAlerts, setLatestAlerts] = useState([]);
  const [popupAlert, setPopupAlert] = useState(null);
  const [summary, setSummary] = useState({
    total: 0,
    unread: 0,
    high: 0,
    medium: 0,
    low: 0,
  });
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(canView);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState("");

  const fetchAlerts = useCallback(
    async ({ silent = false } = {}) => {
      if (!canView) {
        setAlerts([]);
        setLatestAlerts([]);
        setPopupAlert(null);
        setSummary({
          total: 0,
          unread: 0,
          high: 0,
          medium: 0,
          low: 0,
        });
        setUnreadCount(0);
        setIsLoading(false);
        setIsFetching(false);
        return;
      }

      try {
        if (!silent) setIsLoading(true);
        setIsFetching(true);
        setError("");

        const displayName = getDisplayName(user);

        const query = new URLSearchParams({
          userKey,
          role,
          userId: String(getUserId(user)),
          id: String(getUserId(user)),
          username: String(user?.username || ""),
          userName: displayName,
          fullName: displayName,
          full_name: displayName,
          name: displayName,
        }).toString();

        const data = await requestSmartAlertJson(`/smart-alerts?${query}`);

        setAlerts(Array.isArray(data.alerts) ? data.alerts : []);
        setLatestAlerts(
          Array.isArray(data.latestAlerts) ? data.latestAlerts : []
        );
        setPopupAlert(data.popupAlert || null);
        setSummary(
          data.summary || {
            total: 0,
            unread: 0,
            high: 0,
            medium: 0,
            low: 0,
          }
        );
        setUnreadCount(Number(data.unreadCount || 0));
      } catch (err) {
        console.error("Smart notification fetch error:", err);
        setError(err.message || "Unable to load smart alerts.");
        setAlerts([]);
        setLatestAlerts([]);
        setPopupAlert(null);
        setUnreadCount(0);
      } finally {
        setIsLoading(false);
        setIsFetching(false);
      }
    },
    [canView, role, user, userKey]
  );

  const markAlertAsRead = useCallback(
    async (alertKey) => {
      if (!alertKey || !canView) return;

      await requestSmartAlertJson("/smart-alerts/read", {
        method: "POST",
        body: JSON.stringify({
          userKey,
          role,
          alertKey,
        }),
      });

      await fetchAlerts({ silent: true });
    },
    [canView, fetchAlerts, role, userKey]
  );

  const dismissAlert = useCallback(
    async (alertKey) => {
      if (!alertKey || !canView) return;

      await requestSmartAlertJson("/smart-alerts/dismiss", {
        method: "POST",
        body: JSON.stringify({
          userKey,
          role,
          alertKey,
        }),
      });

      await fetchAlerts({ silent: true });
    },
    [canView, fetchAlerts, role, userKey]
  );

  const markAllAsRead = useCallback(async () => {
    if (!canView) return;

    await requestSmartAlertJson("/smart-alerts/read-all", {
      method: "POST",
      body: JSON.stringify({
        userKey,
        role,
        alertKeys: alerts.map((alert) => alert.alertKey),
      }),
    });

    await fetchAlerts({ silent: true });
  }, [alerts, canView, fetchAlerts, role, userKey]);

  useEffect(() => {
    fetchAlerts();

    const handleDataUpdated = () => fetchAlerts({ silent: true });
    const handleWindowFocus = () => fetchAlerts({ silent: true });

    const intervalId = window.setInterval(
      () => fetchAlerts({ silent: true }),
      pollInterval
    );

    window.addEventListener("dataUpdated", handleDataUpdated);
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      window.removeEventListener("dataUpdated", handleDataUpdated);
      window.removeEventListener("focus", handleWindowFocus);
      window.clearInterval(intervalId);
    };
  }, [fetchAlerts, pollInterval]);

  return {
    canView,
    alerts,
    latestAlerts,
    popupAlert,
    summary,
    unreadCount,
    isLoading,
    isFetching,
    error,
    refresh: fetchAlerts,
    markAlertAsRead,
    dismissAlert,
    markAllAsRead,
  };
}