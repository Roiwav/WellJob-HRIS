import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

const API_BASE =
  "http://localhost:5000/api";

const DECISION_HISTORY_API =
  `${API_BASE}/kpi/decision-history`;

const REQUEST_TIMEOUT_MS =
  60 * 1000;

const DEFAULT_STALE_TIME_MS =
  5 * 60 * 1000;

export const KPI_DECISION_QUERY_KEYS = {
  all: ["kpi-decisions"],
  history: [
    "kpi-decisions",
    "history",
  ],
};

async function requestJson(
  url,
  options = {}
) {
  const controller =
    new AbortController();

  const timeoutId =
    globalThis.setTimeout(() => {
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,

      signal: controller.signal,

      headers: {
        Accept: "application/json",
        "Content-Type":
          "application/json",
        ...(options.headers || {}),
      },
    });

    const data = await response
      .json()
      .catch(() => null);

    if (!response.ok) {
      throw new Error(
        data?.error ||
          data?.message ||
          `Request failed with status ${response.status}`
      );
    }

    return data;
  } catch (error) {
    if (
      error?.name === "AbortError"
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

export function useKPIDecisionHistoryQuery(
  options = {}
) {
  return useQuery({
    queryKey:
      KPI_DECISION_QUERY_KEYS.history,

    queryFn: () =>
      requestJson(
        DECISION_HISTORY_API
      ),

    refetchInterval: false,

    staleTime:
      DEFAULT_STALE_TIME_MS,

    refetchOnWindowFocus:
      false,

    refetchOnReconnect:
      true,

    retry: 0,

    ...options,
  });
}

export function useCreateKPIDecisionMutation() {
  const queryClient =
    useQueryClient();

  return useMutation({
    mutationFn: (payload) =>
      requestJson(
        DECISION_HISTORY_API,
        {
          method: "POST",

          body:
            JSON.stringify(
              payload
            ),
        }
      ),

    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey:
            KPI_DECISION_QUERY_KEYS.all,
        }),

        queryClient.invalidateQueries({
          queryKey: ["kpi"],
        }),
      ]);
    },
  });
}

export function useDeleteKPIDecisionMutation() {
  const queryClient =
    useQueryClient();

  return useMutation({
    mutationFn: (id) =>
      requestJson(
        `${DECISION_HISTORY_API}/${encodeURIComponent(
          id
        )}`,
        {
          method: "DELETE",
        }
      ),

    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey:
            KPI_DECISION_QUERY_KEYS.all,
        }),

        queryClient.invalidateQueries({
          queryKey: ["kpi"],
        }),
      ]);
    },
  });
}