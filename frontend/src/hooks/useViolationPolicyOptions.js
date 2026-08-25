import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { API_BASE } from "../config/api";
import authenticatedFetch from "../utils/authenticatedFetch";
import { flattenViolationRules } from "../utils/incidentIntelligence";

const VIOLATION_RULES_API_URL =
  `${API_BASE}/settings/violation-rules`;

const REQUEST_TIMEOUT_MS = 15000;

const INITIAL_STATE = {
  options: [],
  source: "",
  error: "",
  isLoading: false,
};

export default function useViolationPolicyOptions(
  enabled = true
) {
  const abortRef = useRef(null);

  const [state, setState] =
    useState(INITIAL_STATE);

  const abortRequest = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  const loadPolicy = useCallback(async () => {
    abortRequest();

    const controller =
      new AbortController();

    abortRef.current = controller;

    let timedOut = false;

    const timeoutId =
      window.setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, REQUEST_TIMEOUT_MS);

    setState({
      options: [],
      source: "",
      error: "",
      isLoading: true,
    });

    try {
      const response =
        await authenticatedFetch(
          VIOLATION_RULES_API_URL,
          {
            method: "GET",
            signal: controller.signal,
            headers: {
              Accept: "application/json",
            },
          }
        );

      const data =
        await response
          .json()
          .catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.message ||
            data?.error ||
            `Unable to load violation policy (${response.status}).`
        );
      }

      if (
        data?.configured === true &&
        !Array.isArray(data?.rules)
      ) {
        throw new Error(
          "The server returned an invalid violation policy configuration."
        );
      }

      const options =
        data?.configured === true
          ? flattenViolationRules(data.rules)
          : flattenViolationRules();

      if (!options.length) {
        throw new Error(
          "No violation rules are available for incident classification."
        );
      }

      if (controller.signal.aborted) {
        return false;
      }

      setState({
        options,
        source:
          data?.configured === true
            ? "System-wide policy"
            : "Approved default policy",
        error: "",
        isLoading: false,
      });

      return true;
    } catch (error) {
      if (
        error?.name === "AbortError" &&
        !timedOut
      ) {
        return false;
      }

      const message = timedOut
        ? "The server took too long to load the current violation policy. Please retry."
        : error?.message ||
          "Unable to load the current violation policy.";

      console.error(
        "Unable to load violation policy for incident creation:",
        error
      );

      if (!controller.signal.aborted || timedOut) {
        setState({
          options: [],
          source: "",
          error: message,
          isLoading: false,
        });
      }

      return false;
    } finally {
      window.clearTimeout(timeoutId);

      if (abortRef.current === controller) {
        abortRef.current = null;
      }
    }
  }, [abortRequest]);

  useEffect(() => {
    if (!enabled) {
      abortRequest();

      setState(INITIAL_STATE);

      return undefined;
    }

    loadPolicy();

    return abortRequest;
  }, [
    abortRequest,
    enabled,
    loadPolicy,
  ]);

  useEffect(() => {
    return abortRequest;
  }, [abortRequest]);

  return {
    violationOptions: state.options,
    violationPolicySource: state.source,
    violationPolicyError: state.error,
    isLoadingViolationPolicy:
      state.isLoading,
    reloadViolationPolicy: loadPolicy,
  };
}