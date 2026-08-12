import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  canViewSmartSuggestions,
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

const SMART_SUGGESTION_DATA_DOMAINS =
  new Set([
    "employee",
    "employees",

    "employee_document",
    "employee_documents",

    "employee-document",
    "employee-documents",

    "document",
    "documents",

    "compliance",

    "incident",
    "incidents",

    "deployment",
    "deployments",
  ]);

function normalizeDataDomain(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function shouldRefreshForDataUpdated(
  event
) {
  const domain =
    normalizeDataDomain(
      event?.detail?.domain
    );

  /*
   * Preserve compatibility with older
   * unscoped dataUpdated events.
   */
  if (!domain) {
    return true;
  }

  return SMART_SUGGESTION_DATA_DOMAINS.has(
    domain
  );
}

export default function useSmartSuggestions(
  user,
  options = {}
) {
  const role =
    user?.role || "USER";

  const canView =
    canViewSmartSuggestions(
      role
    );

  const pollInterval =
    options.pollInterval ??
    60000;

  const hasPolling =
    Number(pollInterval) > 0;

  const requestInFlightRef =
    useRef(false);

  const [
    suggestions,
    setSuggestions,
  ] = useState([]);

  const [
    latestSuggestions,
    setLatestSuggestions,
  ] = useState([]);

  const [
    summary,
    setSummary,
  ] = useState(
    EMPTY_SUMMARY
  );

  const [
    isLoading,
    setIsLoading,
  ] = useState(
    canView
  );

  const [
    isFetching,
    setIsFetching,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const fetchSuggestions =
    useCallback(
      async ({
        silent = false,
      } = {}) => {
        if (!canView) {
          setSuggestions([]);
          setLatestSuggestions([]);

          setSummary(
            EMPTY_SUMMARY
          );

          setIsLoading(false);
          setIsFetching(false);
          setError("");

          return;
        }

        if (
          requestInFlightRef.current
        ) {
          return;
        }

        requestInFlightRef.current =
          true;

        try {
          if (!silent) {
            setIsLoading(true);
          }

          setIsFetching(true);
          setError("");

          /*
           * Authentication and role authority
           * are derived from the JWT.
           *
           * No userKey or role query parameters
           * are required by the backend.
           */
          const data =
            await requestSmartSuggestionJson(
              "/smart-suggestions"
            );

          setSuggestions(
            Array.isArray(
              data?.suggestions
            )
              ? data.suggestions
              : []
          );

          setLatestSuggestions(
            Array.isArray(
              data?.latestSuggestions
            )
              ? data.latestSuggestions
              : []
          );

          setSummary({
            ...EMPTY_SUMMARY,

            ...(data?.summary ||
              {}),
          });
        } catch (err) {
          console.error(
            "Smart suggestion fetch error:",
            err
          );

          setError(
            err?.message ||
              "Unable to load smart suggestions."
          );

          setSuggestions([]);
          setLatestSuggestions([]);
        } finally {
          requestInFlightRef.current =
            false;

          setIsLoading(false);
          setIsFetching(false);
        }
      },
      [
        canView,
      ]
    );

  useEffect(() => {
    fetchSuggestions();

    const handleDataUpdated =
      (event) => {
        if (
          !shouldRefreshForDataUpdated(
            event
          )
        ) {
          return;
        }

        fetchSuggestions({
          silent: true,
        });
      };

    let intervalId = null;

    if (hasPolling) {
      intervalId =
        window.setInterval(
          () => {
            fetchSuggestions({
              silent: true,
            });
          },
          Number(
            pollInterval
          )
        );
    }

    window.addEventListener(
      "dataUpdated",
      handleDataUpdated
    );

    return () => {
      window.removeEventListener(
        "dataUpdated",
        handleDataUpdated
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
    fetchSuggestions,
    hasPolling,
    pollInterval,
  ]);

  return {
    canView,

    suggestions,

    latestSuggestions,

    summary,

    isLoading,

    isFetching,

    error,

    refresh:
      fetchSuggestions,
  };
}