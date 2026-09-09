import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import authenticatedFetch from "../utils/authenticatedFetch";
import { API_BASE } from "../config/api";

const DECISION_HISTORY_API =
  `${API_BASE}/kpi/decision-history`;

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

async function requestJson(
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
      throw new Error(
        data?.error ||
          data?.message ||
          `Request failed with status ${response.status}`
      );
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
        requestJson(
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
        requestJson(
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
        requestJson(
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
        requestJson(
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