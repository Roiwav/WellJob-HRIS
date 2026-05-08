import { useCallback, useEffect, useMemo, useState } from "react";
import {
  canViewSmartSuggestions,
  getSmartSuggestionUserKey,
  requestSmartSuggestionJson,
} from "../utils/suggestions/smartSuggestions";

export default function useSmartSuggestions(user, options = {}) {
  const role = user?.role || "USER";
  const userKey = useMemo(() => getSmartSuggestionUserKey(user), [user]);
  const canView = canViewSmartSuggestions(role);
  const pollInterval = options.pollInterval ?? 15000;

  const [suggestions, setSuggestions] = useState([]);
  const [latestSuggestions, setLatestSuggestions] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    active: 0,
    reviewed: 0,
    high: 0,
    medium: 0,
    low: 0,
    workforce: 0,
    incident: 0,
    compliance: 0,
  });
  const [isLoading, setIsLoading] = useState(canView);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState("");

  const fetchSuggestions = useCallback(
    async ({ silent = false } = {}) => {
      if (!canView) {
        setSuggestions([]);
        setLatestSuggestions([]);
        setSummary({
          total: 0,
          active: 0,
          reviewed: 0,
          high: 0,
          medium: 0,
          low: 0,
          workforce: 0,
          incident: 0,
          compliance: 0,
        });
        setIsLoading(false);
        setIsFetching(false);
        return;
      }

      try {
        if (!silent) setIsLoading(true);
        setIsFetching(true);
        setError("");

        const query = new URLSearchParams({
          userKey,
          role,
        }).toString();

        const data = await requestSmartSuggestionJson(
          `/smart-suggestions?${query}`
        );

        setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
        setLatestSuggestions(
          Array.isArray(data.latestSuggestions) ? data.latestSuggestions : []
        );
        setSummary(
          data.summary || {
            total: 0,
            active: 0,
            reviewed: 0,
            high: 0,
            medium: 0,
            low: 0,
            workforce: 0,
            incident: 0,
            compliance: 0,
          }
        );
      } catch (err) {
        console.error("Smart suggestion fetch error:", err);
        setError(err.message || "Unable to load smart suggestions.");
        setSuggestions([]);
        setLatestSuggestions([]);
      } finally {
        setIsLoading(false);
        setIsFetching(false);
      }
    },
    [canView, role, userKey]
  );

  const markSuggestionReviewed = useCallback(
    async (suggestionKey) => {
      if (!suggestionKey || !canView) return;

      await requestSmartSuggestionJson("/smart-suggestions/review", {
        method: "POST",
        body: JSON.stringify({
          userKey,
          role,
          suggestionKey,
        }),
      });

      await fetchSuggestions({ silent: true });
    },
    [canView, fetchSuggestions, role, userKey]
  );

  const dismissSuggestion = useCallback(
    async (suggestionKey) => {
      if (!suggestionKey || !canView) return;

      await requestSmartSuggestionJson("/smart-suggestions/dismiss", {
        method: "POST",
        body: JSON.stringify({
          userKey,
          role,
          suggestionKey,
        }),
      });

      await fetchSuggestions({ silent: true });
    },
    [canView, fetchSuggestions, role, userKey]
  );

  useEffect(() => {
    fetchSuggestions();

    const handleDataUpdated = () => fetchSuggestions({ silent: true });
    const handleWindowFocus = () => fetchSuggestions({ silent: true });

    const intervalId = window.setInterval(
      () => fetchSuggestions({ silent: true }),
      pollInterval
    );

    window.addEventListener("dataUpdated", handleDataUpdated);
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      window.removeEventListener("dataUpdated", handleDataUpdated);
      window.removeEventListener("focus", handleWindowFocus);
      window.clearInterval(intervalId);
    };
  }, [fetchSuggestions, pollInterval]);

  return {
    canView,
    suggestions,
    latestSuggestions,
    summary,
    isLoading,
    isFetching,
    error,
    refresh: fetchSuggestions,
    markSuggestionReviewed,
    dismissSuggestion,
  };
}