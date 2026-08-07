import {
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  isSameEmployee,
  normalizeStatus,
} from "../utils/kpi/kpiHelpers";

const API_BASE =
  "http://localhost:5000/api";

const EMPLOYEE_API_URL =
  `${API_BASE}/employees`;

const INCIDENT_API_URL =
  `${API_BASE}/incidents`;

const REQUEST_TIMEOUT_MS =
  60 * 1000;

const DEFAULT_STALE_TIME_MS =
  5 * 60 * 1000;

export const KPI_QUERY_KEYS = {
  all: ["kpi"],
  data: ["kpi", "data"],
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

function isArchivedEmployee(
  employee
) {
  return (
    employee?.archived === true ||
    Number(employee?.archived) ===
      1
  );
}

function normalizeBackendEmployee(
  employee = {}
) {
  const employeeId =
    employee?.id ||
    employee?.employeeId ||
    employee?.employee_id ||
    "";

  return {
    ...employee,

    id: employeeId,
    employeeId,

    name:
      employee?.name ||
      employee?.full_name ||
      employee?.fullName ||
      "Unknown Employee",

    company:
      employee?.company ||
      employee?.clientCompany ||
      employee?.client_company ||
      "Unassigned",

    status:
      employee?.status ||
      "Unknown",

    employmentType:
      employee?.employmentType ||
      employee?.employment_type ||
      "",

    contractStart:
      employee?.contractStart ||
      employee?.contract_start ||
      null,

    contractEnd:
      employee?.contractEnd ||
      employee?.contract_end ||
      null,

    archived:
      isArchivedEmployee(
        employee
      ),

    documents:
      Array.isArray(
        employee?.documents
      )
        ? employee.documents
        : [],
  };
}

function normalizeBackendIncident(
  incident = {}
) {
  const employeeId =
    incident?.employeeId ||
    incident?.employee_id ||
    incident?.empId ||
    incident?.employeeID ||
    "";

  const violation =
    incident?.violation ||
    incident?.violationType ||
    incident?.violation_type ||
    "No violation type";

  const date =
    incident?.reportedAt ||
    incident?.reported_at ||
    incident?.date ||
    incident?.incidentDate ||
    incident?.incident_date ||
    incident?.createdAt ||
    incident?.created_at ||
    new Date().toISOString();

  return {
    ...incident,

    id: incident?.id,

    employeeId,
    employee_id: employeeId,

    employee:
      incident?.employee ||
      incident?.employeeName ||
      incident?.employee_name ||
      "Unknown Employee",

    employeeName:
      incident?.employeeName ||
      incident?.employee ||
      incident?.employee_name ||
      "Unknown Employee",

    company:
      incident?.company ||
      "",

    violation,
    violationType: violation,

    severity:
      incident?.severity ||
      "Minor",

    status:
      normalizeStatus(
        incident?.status ||
          "Open"
      ),

    date,

    incidentDate:
      incident?.incidentDate ||
      incident?.incident_date ||
      date,

    reportedAt:
      incident?.reportedAt ||
      incident?.reported_at ||
      date,

    createdAt:
      incident?.createdAt ||
      incident?.created_at ||
      date,

    recommendation:
      incident?.recommendation ||
      "",

    sanction:
      incident?.sanction ||
      incident?.actionTaken ||
      incident?.action_taken ||
      "",

    description:
      incident?.description ||
      "",
  };
}

export async function fetchKPIBackendData() {
  const [
    employeeData,
    incidentData,
  ] = await Promise.all([
    requestJson(
      EMPLOYEE_API_URL
    ),

    requestJson(
      INCIDENT_API_URL
    ),
  ]);

  const employeesRaw =
    Array.isArray(employeeData)
      ? employeeData
          .filter(Boolean)
          .map(
            normalizeBackendEmployee
          )
          .filter(
            (employee) =>
              !employee.archived
          )
      : [];

  const normalizedIncidents =
    Array.isArray(incidentData)
      ? incidentData
          .filter(Boolean)
          .map(
            normalizeBackendIncident
          )
      : [];

  const incidentsRaw =
    normalizedIncidents.filter(
      (incident) =>
        employeesRaw.some(
          (employee, index) =>
            isSameEmployee(
              employee,
              incident,
              index
            )
        )
    );

  return {
    employeesRaw,
    incidentsRaw,
    fetchedAt:
      new Date().toISOString(),
  };
}

export function useKPIDataQuery(
  options = {}
) {
  return useQuery({
    queryKey:
      KPI_QUERY_KEYS.data,

    queryFn:
      fetchKPIBackendData,

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

export function useInvalidateKPIQueries() {
  const queryClient =
    useQueryClient();

  return () =>
    queryClient.invalidateQueries({
      queryKey:
        KPI_QUERY_KEYS.all,
    });
}