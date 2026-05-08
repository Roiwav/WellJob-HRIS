import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const API_BASE = "http://localhost:5000/api";
const DECISION_HISTORY_API = `${API_BASE}/kpi/decision-history`;

export const KPI_DECISION_QUERY_KEYS = {
  all: ["kpi-decisions"],
  history: ["kpi-decisions", "history"],
};

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.error ||
        data?.message ||
        `Request failed with status ${response.status}`
    );
  }

  return data;
}

export function useKPIDecisionHistoryQuery(options = {}) {
  return useQuery({
    queryKey: KPI_DECISION_QUERY_KEYS.history,
    queryFn: () => requestJson(DECISION_HISTORY_API),
    refetchInterval: options.refetchInterval ?? 10000,
    staleTime: options.staleTime ?? 15000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 1,
    ...options,
  });
}

export function useCreateKPIDecisionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) =>
      requestJson(DECISION_HISTORY_API, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: KPI_DECISION_QUERY_KEYS.all,
      });

      queryClient.invalidateQueries({
        queryKey: ["kpi"],
      });
    },
  });
}

export function useDeleteKPIDecisionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) =>
      requestJson(`${DECISION_HISTORY_API}/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: KPI_DECISION_QUERY_KEYS.all,
      });

      queryClient.invalidateQueries({
        queryKey: ["kpi"],
      });
    },
  });
}