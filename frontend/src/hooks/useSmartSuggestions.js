import { useCallback, useEffect, useMemo, useState } from "react";
import {
  canViewSmartSuggestions,
  getSmartSuggestionUserKey,
  requestSmartSuggestionJson,
} from "../utils/suggestions/smartSuggestions";

const EMPTY_SUMMARY = {
  total: 0,
  active: 0,
  reviewed: 0,
  high: 0,
  medium: 0,
  low: 0,
  workforce: 0,
  incident: 0,
  compliance: 0,
};

export default function useSmartSuggestions(user, options = {}) {
  const role = user?.role || "USER";
  const userKey = useMemo(() => getSmartSuggestionUserKey(user), [user]);
  const canView = canViewSmartSuggestions(role);
  const pollInterval = options.pollInterval ?? 15000;

  const [suggestions, setSuggestions] = useState([]);
  const [latestSuggestions, setLatestSuggestions] = useState([]);
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [isLoading, setIsLoading] = useState(canView);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState("");

  const fetchSuggestions = useCallback(
    async ({ silent = false } = {}) => {
      if (!canView) {
        setSuggestions([]);
        setLatestSuggestions([]);
        setSummary(EMPTY_SUMMARY);
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
        setSummary(data.summary || EMPTY_SUMMARY);
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

  const takeSuggestionAction = useCallback(
    async (suggestionKey, payload = {}) => {
      if (!suggestionKey || !canView) return;

      await requestSmartSuggestionJson("/smart-suggestions/action", {
        method: "POST",
        body: JSON.stringify({
          userKey,
          role,
          suggestionKey,
          actionType: payload.actionType,
          actionNotes: payload.actionNotes,
        }),
      });

      await fetchSuggestions({ silent: true });
    },
    [canView, fetchSuggestions, role, userKey]
  );

  const markSuggestionReviewed = useCallback(
    async (suggestionKey, payload = {}) => {
      await takeSuggestionAction(suggestionKey, {
        actionType: payload.actionType || "HR Acknowledged",
        actionNotes:
          payload.actionNotes ||
          "HR acknowledged the smart suggestion for monitoring.",
      });
    },
    [takeSuggestionAction]
  );

  const dismissSuggestion = useCallback(
    async (suggestionKey, dismissReason = "") => {
      if (!suggestionKey || !canView) return;

      await requestSmartSuggestionJson("/smart-suggestions/dismiss", {
        method: "POST",
        body: JSON.stringify({
          userKey,
          role,
          suggestionKey,
          dismissReason,
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
    takeSuggestionAction,
    markSuggestionReviewed,
    dismissSuggestion,
  };
}