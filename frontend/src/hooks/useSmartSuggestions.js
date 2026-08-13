import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  canViewSmartSuggestions,
  requestSmartSuggestionJson,
  takeSmartSuggestionAction as requestTakeSmartSuggestionAction,
  dismissSmartSuggestion as requestDismissSmartSuggestion,
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

function mergeSuggestionState(
  suggestion,
  suggestionKey,
  state
) {
  if (
    !suggestion ||
    suggestion.suggestionKey !==
      suggestionKey ||
    !state
  ) {
    return suggestion;
  }

  return {
    ...suggestion,
    ...state,
  };
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

  const mutationInFlightRef =
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
    isMutating,
    setIsMutating,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    mutationError,
    setMutationError,
  ] = useState("");

  const applyMutationState =
    useCallback(
      (
        suggestionKey,
        state
      ) => {
        if (
          !suggestionKey ||
          !state
        ) {
          return;
        }

        setSuggestions(
          (current) =>
            current.map(
              (suggestion) =>
                mergeSuggestionState(
                  suggestion,
                  suggestionKey,
                  state
                )
            )
        );

        setLatestSuggestions(
          (current) =>
            current.map(
              (suggestion) =>
                mergeSuggestionState(
                  suggestion,
                  suggestionKey,
                  state
                )
            )
        );
      },
      []
    );

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

          return null;
        }

        if (
          requestInFlightRef.current
        ) {
          return null;
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
           * are required by the GET endpoint.
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

          return data;
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

          return null;
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

  /*
   * Save a human action/review decision
   * for one generated suggestion.
   *
   * Backend ownership comes from req.user.
   * The helper still sends the existing
   * compatibility payload expected by Phase 5.
   */
  const takeSuggestionAction =
    useCallback(
      async ({
        suggestionKey,
        actionType,
        actionNotes = "",
      }) => {
        if (!canView) {
          throw new Error(
            "You do not have permission to update smart suggestions."
          );
        }

        if (
          mutationInFlightRef.current
        ) {
          return null;
        }

        mutationInFlightRef.current =
          true;

        setIsMutating(true);
        setMutationError("");

        try {
          const data =
            await requestTakeSmartSuggestionAction({
              user,
              suggestionKey,
              actionType,
              actionNotes,
            });

          /*
           * Update current UI immediately using
           * the trusted state returned by backend.
           */
          applyMutationState(
            suggestionKey,
            data?.state
          );

          /*
           * Re-fetch from backend so the UI is
           * synchronized with persisted state.
           *
           * If another GET is already running,
           * the local state above still keeps
           * the mutation visible immediately,
           * while the existing poll/event refresh
           * will retrieve the persisted state later.
           */
          await fetchSuggestions({
            silent: true,
          });

          return data;
        } catch (err) {
          console.error(
            "Smart suggestion action error:",
            err
          );

          const message =
            err?.message ||
            "Unable to save smart suggestion action.";

          setMutationError(
            message
          );

          throw err;
        } finally {
          mutationInFlightRef.current =
            false;

          setIsMutating(false);
        }
      },
      [
        applyMutationState,
        canView,
        fetchSuggestions,
        user,
      ]
    );

  /*
   * Persist dismissal state for one generated
   * suggestion.
   *
   * The suggestion itself remains part of the
   * rule-based DSS output. Its per-user dismissal
   * state is merged by the backend on future GETs.
   */
  const dismissSuggestion =
    useCallback(
      async ({
        suggestionKey,
        dismissReason = "",
      }) => {
        if (!canView) {
          throw new Error(
            "You do not have permission to update smart suggestions."
          );
        }

        if (
          mutationInFlightRef.current
        ) {
          return null;
        }

        mutationInFlightRef.current =
          true;

        setIsMutating(true);
        setMutationError("");

        try {
          const data =
            await requestDismissSmartSuggestion({
              user,
              suggestionKey,
              dismissReason,
            });

          /*
           * Apply persisted backend state to
           * the current browser view immediately.
           */
          applyMutationState(
            suggestionKey,
            data?.state
          );

          /*
           * Fresh backend synchronization.
           */
          await fetchSuggestions({
            silent: true,
          });

          return data;
        } catch (err) {
          console.error(
            "Smart suggestion dismiss error:",
            err
          );

          const message =
            err?.message ||
            "Unable to dismiss smart suggestion.";

          setMutationError(
            message
          );

          throw err;
        } finally {
          mutationInFlightRef.current =
            false;

          setIsMutating(false);
        }
      },
      [
        applyMutationState,
        canView,
        fetchSuggestions,
        user,
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

    isMutating,

    error,

    mutationError,

    refresh:
      fetchSuggestions,

    takeSuggestionAction,

    dismissSuggestion,
  };
}