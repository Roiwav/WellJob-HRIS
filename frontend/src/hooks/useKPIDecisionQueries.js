import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import authenticatedFetch from "../utils/authenticatedFetch";
import { API_BASE } from "../config/api";

const DECISION_HISTORY_API =
  `${API_BASE}/kpi/decision-history`;

const KPI_EVALUATION_API =
  `${API_BASE}/kpi/evaluation`;

const REQUEST_TIMEOUT_MS =
  60 * 1000;

const DEFAULT_STALE_TIME_MS =
  5 * 60 * 1000;

export const KPI_DECISION_QUERY_KEYS = {
  all: [
    "kpi-decisions",
  ],

  latest: [
    "kpi-decisions",
    "latest",
  ],

  history: [
    "kpi-decisions",
    "history",
  ],

  historyPage: ({
    page,
    pageSize,
    search,
    decisionType,
  }) => [
    "kpi-decisions",
    "history",
    {
      page,
      pageSize,
      search,
      decisionType,
    },
  ],
};

export async function requestKPIDecisionJson(
  url,
  options = {}
) {
  const controller =
    new AbortController();

  const timeoutId =
    globalThis.setTimeout(
      () => {
        controller.abort();
      },
      REQUEST_TIMEOUT_MS
    );

  try {
    const response =
      await authenticatedFetch(
        url,
        {
          ...options,

          signal:
            controller.signal,

          headers: {
            Accept:
              "application/json",

            "Content-Type":
              "application/json",

            ...(options.headers ||
              {}),
          },
        }
      );

    const data =
      await response
        .json()
        .catch(
          () => null
        );

    if (
      !response.ok
    ) {
      const requestError = new Error(
        data?.error ||
          data?.message ||
          `Request failed with status ${response.status}`
      );

      requestError.name =
        "KPIDecisionRequestError";

      requestError.status =
        response.status;

      requestError.data =
        data;

      throw requestError;
    }

    return data;
  } catch (error) {
    if (
      error?.name ===
      "AbortError"
    ) {
      throw new Error(
        "The server took too long to respond. Check that the backend server and database are running, then try again."
      );
    }

    throw error;
  } finally {
    globalThis.clearTimeout(
      timeoutId
    );
  }
}

export function mergeKpiEvaluationSnapshot(
  employee,
  responseData
) {
  const evaluation =
    responseData?.evaluation;

  if (
    !evaluation ||
    typeof evaluation !== "object" ||
    Array.isArray(evaluation)
  ) {
    throw new Error(
      "The refreshed KPI assessment response is invalid."
    );
  }

  const refreshedEmployee =
    responseData?.employee &&
    typeof responseData.employee === "object" &&
    !Array.isArray(responseData.employee)
      ? responseData.employee
      : {};

  return {
    ...(employee || {}),
    ...refreshedEmployee,
    ...evaluation,

    id:
      refreshedEmployee.id ??
      refreshedEmployee.employeeId ??
      employee?.id,

    name:
      refreshedEmployee.name ??
      employee?.name,

    company:
      refreshedEmployee.company ??
      employee?.company,

    violationCount:
      evaluation.activeViolationCount ??
      evaluation.violationCount ??
      employee?.violationCount ??
      0,

    severityScore:
      evaluation.activeSeverityScore ??
      evaluation.severityScore ??
      employee?.severityScore ??
      0,

    criticalIncidentCount:
      evaluation.activeCriticalIncidentCount ??
      evaluation.criticalIncidentCount ??
      employee?.criticalIncidentCount ??
      0,

    recommendation:
      evaluation.systemRecommendation ??
      evaluation.recommendation ??
      employee?.recommendation,

    recommendationReason:
      evaluation.recommendationReason ??
      employee?.recommendationReason,

    correctiveActionReason:
      evaluation.recommendationReason ??
      evaluation.correctiveActionReason ??
      employee?.correctiveActionReason,
  };
}

export async function requestKpiEvaluation(
  employeeId
) {
  const normalizedEmployeeId =
    String(
      employeeId ?? ""
    ).trim();

  if (!normalizedEmployeeId) {
    throw new Error(
      "A valid employee ID is required to refresh the KPI assessment."
    );
  }

  return requestKPIDecisionJson(
    `${KPI_EVALUATION_API}/${encodeURIComponent(
      normalizedEmployeeId
    )}`
  );
}

function buildDecisionHistoryUrl(
  params = {}
) {
  const page =
    Number.isInteger(
      Number(
        params.page
      )
    ) &&
    Number(
      params.page
    ) > 0
      ? Number(
          params.page
        )
      : 1;

  const requestedPageSize =
    Number(
      params.pageSize
    );

  const pageSize =
    Number.isInteger(
      requestedPageSize
    ) &&
    requestedPageSize > 0
      ? Math.min(
          requestedPageSize,
          100
        )
      : 25;

  const search =
    String(
      params.search ||
        ""
    ).trim();

  const decisionType =
    String(
      params.decisionType ||
        "ALL"
    ).trim() ||
    "ALL";

  const query =
    new URLSearchParams({
      view:
        "history",

      page:
        String(page),

      pageSize:
        String(
          pageSize
        ),

      search,

      decisionType,
    });

  return {
    url:
      `${DECISION_HISTORY_API}?${query.toString()}`,

    queryParams: {
      page,
      pageSize,
      search,
      decisionType,
    },
  };
}

export function useKPIDecisionLatestQuery(
  options = {}
) {
  return useQuery({
    queryKey:
      KPI_DECISION_QUERY_KEYS.latest,

    queryFn:
      () =>
        requestKPIDecisionJson(
          `${DECISION_HISTORY_API}?view=latest`
        ),

    refetchInterval:
      false,

    staleTime:
      DEFAULT_STALE_TIME_MS,

    refetchOnWindowFocus:
      false,

    refetchOnReconnect:
      true,

    retry:
      0,

    ...options,
  });
}

export function useKPIDecisionHistoryPageQuery(
  params = {},
  options = {}
) {
  const {
    url,
    queryParams,
  } =
    buildDecisionHistoryUrl(
      params
    );

  return useQuery({
    queryKey:
      KPI_DECISION_QUERY_KEYS.historyPage(
        queryParams
      ),

    queryFn:
      () =>
        requestKPIDecisionJson(
          url
        ),

    refetchInterval:
      false,

    staleTime:
      DEFAULT_STALE_TIME_MS,

    refetchOnWindowFocus:
      false,

    refetchOnReconnect:
      true,

    retry:
      0,

    ...options,
  });
}

export function useCreateKPIDecisionMutation() {
  const queryClient =
    useQueryClient();

  return useMutation({
    mutationFn:
      (payload) =>
        requestKPIDecisionJson(
          DECISION_HISTORY_API,
          {
            method:
              "POST",

            body:
              JSON.stringify(
                payload
              ),
          }
        ),

    onSuccess:
      async () => {
        await queryClient.invalidateQueries({
          queryKey:
            KPI_DECISION_QUERY_KEYS.all,
        });
      },
  });
}

export function useDeleteKPIDecisionMutation() {
  const queryClient =
    useQueryClient();

  return useMutation({
    mutationFn:
      (id) =>
        requestKPIDecisionJson(
          `${DECISION_HISTORY_API}/${encodeURIComponent(
            id
          )}`,
          {
            method:
              "DELETE",
          }
        ),

    onSuccess:
      async () => {
        await queryClient.invalidateQueries({
          queryKey:
            KPI_DECISION_QUERY_KEYS.all,
        });
      },
  });
}
